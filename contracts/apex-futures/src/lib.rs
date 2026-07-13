#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

mod storage;
mod vamm;
mod margin;
mod oracle;
mod liquidation;

use storage::{
    get_admin, set_admin, set_usdc_token, set_vamm_reserves, get_vamm_reserves,
    set_margin_ratios, set_oracle_updater, get_position, set_position,
    remove_position, get_margin_account, set_margin_account, Position
};
use vamm::{swap, calculate_pnl, fp_div, SCALE};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Reserves {
    pub base: i128,
    pub quote: i128,
}

#[contract]
pub struct ApexFuturesContract;

#[contractimpl]
impl ApexFuturesContract {
    /// Initialize contract configuration and vAMM reserves.
    /// - `admin`: Contract administrator.
    /// - `usdc_token`: Address of the USDC Stellar Asset Contract (SAC).
    /// - `init_base`: Initial virtual base asset reserve (e.g., 1,000,000 * 10^7).
    /// - `init_quote`: Initial virtual quote asset reserve (e.g., 5,000,000 * 10^7).
    /// - `init_margin`: Initial margin ratio in basis points (e.g., 2000 = 20% = 5x leverage max).
    /// - `maint_margin`: Maintenance margin ratio in basis points (e.g., 1000 = 10% = 10x leverage max).
    /// - `oracle_updater`: Account authorized to publish price updates.
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        init_base: i128,
        init_quote: i128,
        init_margin: i128,
        maint_margin: i128,
        oracle_updater: Address,
    ) {
        assert!(get_admin(&env).is_none(), "Contract already initialized");
        assert!(init_base > 0 && init_quote > 0, "Reserves must be positive");
        assert!(init_margin > maint_margin, "Initial margin ratio must exceed maintenance margin ratio");

        set_admin(&env, &admin);
        set_usdc_token(&env, &usdc_token);
        set_vamm_reserves(&env, init_base, init_quote);
        set_margin_ratios(&env, init_margin, maint_margin);
        set_oracle_updater(&env, &oracle_updater);

        // Pre-populate oracle price with initial vAMM price
        let initial_price = (init_quote * SCALE) / init_base;
        storage::set_oracle_price(&env, initial_price);
    }

    /// Deposits USDC as collateral for the user.
    pub fn deposit_margin(env: Env, user: Address, amount: i128) {
        user.require_auth();
        margin::deposit_margin(&env, &user, amount);
    }

    /// Withdraws USDC collateral from the user's free margin balance.
    pub fn withdraw_margin(env: Env, user: Address, amount: i128) {
        user.require_auth();
        margin::withdraw_margin(&env, &user, amount);
    }

    /// Opens a leveraged position on virtual compute power.
    /// - `user`: The trader's address.
    /// - `size`: The amount of virtual base asset (compute hours) to trade (7 decimals).
    /// - `is_long`: True for Long (buying base asset), False for Short (selling base asset).
    pub fn open_position(env: Env, user: Address, size: i128, is_long: bool) {
        user.require_auth();

        let current_position = get_position(&env, &user);
        assert!(current_position.size == 0, "User already has an active position; close it first");
        assert!(size > 0, "Position size must be positive");

        // 1. Simulate the swap on the vAMM to find entry value and updated reserves
        let (quote_amount, new_base, new_quote) = swap(&env, size, is_long);

        // 2. Determine the required initial margin: entry_value * init_margin_ratio / 10000
        let (init_ratio, _) = storage::get_margin_ratios(&env);
        let required_margin = (quote_amount * init_ratio) / 10000;

        // 3. Verify user has enough free margin
        let free_margin = get_margin_account(&env, &user);
        assert!(free_margin >= required_margin, "Insufficient free margin to meet initial margin requirement");

        // 4. Lock margin & save new position
        let entry_price = fp_div(quote_amount, size);
        let new_position = Position {
            size: if is_long { size } else { -size },
            entry_price,
            margin_allocated: required_margin,
        };

        set_position(&env, &user, &new_position);
        set_margin_account(&env, &user, free_margin - required_margin);

        // 5. Update vAMM reserves
        set_vamm_reserves(&env, new_base, new_quote);
    }

    /// Closes an active leveraged position and returns collateral +/- PnL.
    pub fn close_position(env: Env, user: Address) {
        user.require_auth();

        let position = get_position(&env, &user);
        assert!(position.size != 0, "No active position to close");

        // 1. Swap the position size back to the vAMM to get exit value
        let size_abs = position.size.abs();
        let is_long = position.size > 0;
        let (quote_amount, new_base, new_quote) = swap(&env, size_abs, !is_long);

        // 2. Compute PnL
        let pnl = calculate_pnl(&position, quote_amount);

        // 3. Compute returned collateral (Allocated + PnL)
        let returned_collateral = position.margin_allocated + pnl;
        
        // 4. Free up margin, capped at 0 (loss cannot exceed locked margin)
        let capped_return = if returned_collateral < 0 { 0 } else { returned_collateral };
        let free_margin = get_margin_account(&env, &user);
        set_margin_account(&env, &user, free_margin + capped_return);

        // 5. Update reserves & delete position
        set_vamm_reserves(&env, new_base, new_quote);
        remove_position(&env, &user);
    }

    /// Liquidates an underwater position (health factor < 1.0)
    pub fn liquidate(env: Env, liquidator: Address, user: Address) {
        liquidation::liquidate_position(&env, &liquidator, &user);
    }

    /// Permissioned oracle endpoint to inject GRC-validated prices
    pub fn update_oracle(env: Env, updater: Address, price: i128) {
        oracle::update_price(&env, &updater, price);
    }

    // --- READ ONLY QUERIES ---

    /// Retrieve the user's free margin balance
    pub fn get_margin_balance(env: Env, user: Address) -> i128 {
        get_margin_account(&env, &user)
    }

    /// Retrieve the user's active position details
    pub fn get_position_details(env: Env, user: Address) -> Position {
        get_position(&env, &user)
    }

    /// Get current vAMM mark price (quote_reserves / base_reserves)
    pub fn get_mark_price(env: Env) -> i128 {
        vamm::get_mark_price(&env)
    }

    /// Get last updated GRC Oracle spot price
    pub fn get_oracle_price(env: Env) -> i128 {
        oracle::get_price(&env)
    }

    /// Get the health factor of a user's position (scaled by 10^7)
    pub fn get_health_factor(env: Env, user: Address) -> i128 {
        margin::calculate_health_factor(&env, &user)
    }

    /// Get the current virtual reserves of the AMM
    pub fn get_reserves(env: Env) -> Reserves {
        let (base, quote) = get_vamm_reserves(&env);
        Reserves { base, quote }
    }
}

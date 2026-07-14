#![no_std]
//! # APEX Futures — Soroban cash-settled compute-futures exchange
//!
//! A vAMM (x·y=k) perpetual-style futures market on virtual GPU/compute units,
//! collateralized and settled in USDC via the Stellar Asset Contract (SAC).
//!
//! Security model (see module docs for detail):
//! - Typed `#[contracterror]` failures, never bare panics/asserts.
//! - RBAC: admin (2-step handover), pauser, oracle updater, fee collector.
//! - Circuit breaker: pausing blocks new risk (open) but never traps funds
//!   (close/withdraw/liquidate stay open).
//! - Risk decisions use the *fresh oracle index price*, not the manipulable mark.
//! - Solvency by construction: three accounting buckets (TotalCollateral,
//!   FeeVault, InsuranceFund) whose sum the USDC vault always backs.
//! - Checks-Effects-Interactions ordering around every token transfer.

// The constructor and `open_position` legitimately take several parameters that
// mirror the on-chain interface; splitting them into structs would only obscure
// the contract's public ABI.
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};

mod admin;
mod errors;
mod events;
mod funding;
mod liquidation;
mod margin;
mod oracle;
mod storage;
mod vamm;

#[cfg(test)]
mod test;

#[cfg(test)]
mod fuzz;

use errors::Error;
use storage::{Config, Position, PricePoint, BPS_DENOM};
use vamm::{fp_div, mul_div_floor, swap};

/// vAMM virtual reserves, returned to callers/frontend.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Reserves {
    pub base: i128,
    pub quote: i128,
}

/// Solvency accounting snapshot.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Buckets {
    pub total_collateral: i128,
    pub fee_vault: i128,
    pub insurance_fund: i128,
}

#[contract]
pub struct ApexFuturesContract;

#[contractimpl]
impl ApexFuturesContract {
    // ----------------------------------------------------------------------
    // Construction
    // ----------------------------------------------------------------------

    /// Contract constructor — runs exactly once at deploy time, closing the
    /// classic "anyone can call initialize first" front-running window.
    ///
    /// - `admin`/`pauser`/`fee_collector`/`oracle_updater`: RBAC principals.
    /// - `usdc`: USDC SAC address used for all settlement.
    /// - `init_base`/`init_quote`: initial virtual reserves (7 dp).
    /// - `config`: risk, fee and oracle parameters.
    /// - `timelock_delay`: seconds an `upgrade`/`config` change must wait between
    ///   proposal and execution. Set to a governance-appropriate value on mainnet
    ///   (e.g. 24–48h); may be 0 on testnet for demos.
    pub fn __constructor(
        env: Env,
        admin: Address,
        pauser: Address,
        fee_collector: Address,
        usdc: Address,
        oracle_updater: Address,
        init_base: i128,
        init_quote: i128,
        config: Config,
        timelock_delay: u64,
    ) {
        if storage::is_initialized(&env) {
            panic_err(&env, Error::AlreadyInitialized);
        }
        if init_base <= 0 || init_quote <= 0 {
            panic_err(&env, Error::InvalidAmount);
        }
        admin::validate_config(&env, &config);

        storage::set_admin(&env, &admin);
        storage::set_pauser(&env, &pauser);
        storage::set_fee_collector(&env, &fee_collector);
        storage::set_usdc_token(&env, &usdc);
        storage::set_oracle_updater(&env, &oracle_updater);
        storage::set_config(&env, &config);
        storage::set_timelock_delay(&env, timelock_delay);
        storage::set_paused(&env, false);
        storage::set_reserves(&env, init_base, init_quote);

        let now = env.ledger().timestamp();
        // Seed the oracle with the initial vAMM-implied price so risk checks work
        // immediately after deploy.
        let initial_price = fp_div(&env, init_quote, init_base);
        storage::set_oracle_price(&env, initial_price);
        storage::set_oracle_ts(&env, now);
        storage::set_cum_funding(&env, 0);
        storage::set_last_funding_ts(&env, now);
        storage::set_total_collateral(&env, 0);
        storage::set_fee_vault(&env, 0);
        storage::set_insurance_fund(&env, 0);
        storage::extend_instance(&env);

        events::init(&env, &admin);
    }

    // ----------------------------------------------------------------------
    // Collateral
    // ----------------------------------------------------------------------

    /// Deposit USDC as free collateral.
    pub fn deposit_margin(env: Env, user: Address, amount: i128) {
        user.require_auth();
        margin::deposit(&env, &user, amount);
    }

    /// Withdraw free collateral (subject to initial-margin coverage if a position
    /// is open).
    pub fn withdraw_margin(env: Env, user: Address, amount: i128) {
        user.require_auth();
        margin::withdraw(&env, &user, amount);
    }

    /// Seed the insurance fund with USDC (permissionless). Backs trader profits
    /// and absorbs bad debt; admins should seed this before opening the market.
    pub fn seed_insurance(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_err(&env, Error::InvalidAmount);
        }
        let usdc = storage::get_usdc_token(&env);
        soroban_sdk::token::Client::new(&env, &usdc).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        storage::set_insurance_fund(&env, storage::get_insurance_fund(&env) + amount);
        storage::extend_instance(&env);
        events::insurance_seed(&env, &from, amount);
    }

    // ----------------------------------------------------------------------
    // Trading
    // ----------------------------------------------------------------------

    /// Open a leveraged position on virtual compute power.
    /// - `size`: virtual base units (7 dp), always positive; direction is `is_long`.
    /// - `slippage_limit`: for a long, the max acceptable entry notional; for a
    ///   short, the min acceptable notional. Pass 0 to skip the check.
    pub fn open_position(env: Env, user: Address, size: i128, is_long: bool, slippage_limit: i128) {
        user.require_auth();
        admin::require_not_paused(&env);

        if storage::get_position(&env, &user).size != 0 {
            panic_err(&env, Error::PositionExists);
        }
        let cfg = storage::get_config(&env);
        if size < cfg.min_position_size {
            panic_err(&env, Error::BelowMinPositionSize);
        }

        // Price the trade on the vAMM.
        let (notional, new_base, new_quote) = swap(&env, size, is_long);
        if slippage_limit > 0 {
            if is_long && notional > slippage_limit {
                panic_err(&env, Error::SlippageExceeded);
            }
            if !is_long && notional < slippage_limit {
                panic_err(&env, Error::SlippageExceeded);
            }
        }

        let fee = mul_div_floor(&env, notional, cfg.trading_fee_bps, BPS_DENOM);
        let required_margin = mul_div_floor(&env, notional, cfg.init_margin_bps, BPS_DENOM);
        let free = storage::get_margin(&env, &user);
        if free < required_margin + fee {
            panic_err(&env, Error::InsufficientFreeMargin);
        }

        let entry_price = fp_div(&env, notional, size);

        // Effects: lock margin, collect fee, record position, move reserves.
        storage::set_margin(&env, &user, free - required_margin - fee);
        storage::set_fee_vault(&env, storage::get_fee_vault(&env) + fee);
        storage::set_total_collateral(&env, storage::get_total_collateral(&env) - fee);

        let position = Position {
            size: if is_long { size } else { -size },
            entry_price,
            margin_allocated: required_margin,
            entry_funding: storage::get_cum_funding(&env),
        };
        storage::set_position(&env, &user, &position);
        storage::set_reserves(&env, new_base, new_quote);
        storage::extend_instance(&env);

        events::open(
            &env,
            &user,
            position.size,
            entry_price,
            required_margin,
            fee,
        );
    }

    /// Close the caller's active position at market and settle PnL/funding/fees.
    /// `slippage_limit`: closing a long, the min proceeds; closing a short, the
    /// max cost. Pass 0 to skip. Allowed even while paused so users can always exit.
    pub fn close_position(env: Env, user: Address, slippage_limit: i128) {
        user.require_auth();

        let pos = storage::get_position(&env, &user);
        if pos.size == 0 {
            panic_err(&env, Error::NoPosition);
        }
        let cfg = storage::get_config(&env);
        let size_abs = pos.size.abs();
        let is_long = pos.size > 0;

        let (exit_value, new_base, new_quote) = swap(&env, size_abs, !is_long);
        if slippage_limit > 0 {
            if is_long && exit_value < slippage_limit {
                panic_err(&env, Error::SlippageExceeded);
            }
            if !is_long && exit_value > slippage_limit {
                panic_err(&env, Error::SlippageExceeded);
            }
        }

        let pnl = vamm::calculate_pnl(&env, &pos, exit_value);
        let funding_owed = funding::pending_funding(&env, &pos);
        let fee = mul_div_floor(&env, exit_value, cfg.trading_fee_bps, BPS_DENOM);

        let credited = margin::settle_close(&env, pos.margin_allocated, pnl, funding_owed, fee);
        storage::set_margin(&env, &user, storage::get_margin(&env, &user) + credited);
        storage::set_reserves(&env, new_base, new_quote);
        storage::remove_position(&env, &user);
        storage::extend_instance(&env);

        events::close(&env, &user, pnl, funding_owed, fee, credited);
    }

    /// Liquidate an underwater position (health factor < 1.0 at the fresh index).
    pub fn liquidate(env: Env, liquidator: Address, user: Address) {
        liquidation::liquidate(&env, &liquidator, &user);
    }

    /// Settle funding globally. Permissionless; advances only once the funding
    /// interval has elapsed. Returns the applied premium.
    pub fn settle_funding(env: Env) -> i128 {
        funding::settle(&env, true)
    }

    // ----------------------------------------------------------------------
    // Oracle
    // ----------------------------------------------------------------------

    /// Permissioned endpoint to inject GRC-validated APAC GPU Index prices.
    pub fn update_oracle(env: Env, updater: Address, price: i128) {
        oracle::update_price(&env, &updater, price);
    }

    /// Set the TWAP window (seconds) applied to the risk price. `0` disables
    /// smoothing and the risk engine reads the latest index, as it did before
    /// this feature existed.
    ///
    /// Admin-gated and event-emitting, but **not** timelocked: this is the lever
    /// that blunts an oracle manipulation already under way, and a 24h delay on
    /// reaching for it would defeat the point.
    ///
    /// Residual risk, stated plainly: while the index is moving, a longer window
    /// holds the risk price above spot on a fall — which shields longs but brings
    /// *shorts* closer to liquidation. A hostile admin could time a change to
    /// favour one side. Bounding the window limits the blast radius; removing the
    /// risk needs the admin key in a multisig (see SECURITY.md §4).
    pub fn set_twap_window(env: Env, caller: Address, window: u64) {
        admin::set_twap_window(&env, &caller, window);
    }

    // ----------------------------------------------------------------------
    // Administration (RBAC)
    // ----------------------------------------------------------------------

    pub fn pause(env: Env, caller: Address) {
        admin::pause(&env, &caller);
    }

    pub fn unpause(env: Env, caller: Address) {
        admin::unpause(&env, &caller);
    }

    pub fn transfer_admin(env: Env, caller: Address, new_admin: Address) {
        admin::transfer_admin(&env, &caller, &new_admin);
    }

    pub fn accept_admin(env: Env, caller: Address) {
        admin::accept_admin(&env, &caller);
    }

    pub fn set_pauser(env: Env, caller: Address, pauser: Address) {
        admin::set_pauser(&env, &caller, &pauser);
    }

    pub fn set_fee_collector(env: Env, caller: Address, collector: Address) {
        admin::set_fee_collector(&env, &caller, &collector);
    }

    pub fn set_oracle_updater(env: Env, caller: Address, updater: Address) {
        admin::set_oracle_updater(&env, &caller, &updater);
    }

    // --- Timelocked governance (propose → wait timelock_delay → execute) ---

    /// Queue a risk/fee config change behind the timelock.
    pub fn propose_config(env: Env, caller: Address, config: Config) {
        admin::propose_config(&env, &caller, &config);
    }

    /// Execute a queued config change once its timelock has elapsed.
    pub fn execute_config(env: Env, caller: Address) {
        admin::execute_config(&env, &caller);
    }

    /// Abort a queued config change.
    pub fn cancel_config(env: Env, caller: Address) {
        admin::cancel_config(&env, &caller);
    }

    /// Queue a WASM upgrade behind the timelock.
    pub fn propose_upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        admin::propose_upgrade(&env, &caller, new_wasm_hash);
    }

    /// Execute a queued WASM upgrade once its timelock has elapsed.
    pub fn execute_upgrade(env: Env, caller: Address) {
        admin::execute_upgrade(&env, &caller);
    }

    /// Abort a queued WASM upgrade.
    pub fn cancel_upgrade(env: Env, caller: Address) {
        admin::cancel_upgrade(&env, &caller);
    }

    /// Sweep accrued protocol fees to the fee collector.
    pub fn collect_fees(env: Env, caller: Address) -> i128 {
        caller.require_auth();
        let collector = storage::get_fee_collector(&env);
        if caller != collector && caller != storage::get_admin(&env) {
            panic_err(&env, Error::Unauthorized);
        }
        let amount = storage::get_fee_vault(&env);
        if amount > 0 {
            let usdc = storage::get_usdc_token(&env);
            soroban_sdk::token::Client::new(&env, &usdc).transfer(
                &env.current_contract_address(),
                &collector,
                &amount,
            );
            storage::set_fee_vault(&env, 0);
            storage::extend_instance(&env);
            events::fees_collected(&env, &collector, amount);
        }
        amount
    }

    // ----------------------------------------------------------------------
    // Read-only queries
    // ----------------------------------------------------------------------

    pub fn get_margin_balance(env: Env, user: Address) -> i128 {
        storage::get_margin(&env, &user)
    }

    pub fn get_position(env: Env, user: Address) -> Position {
        storage::get_position(&env, &user)
    }

    pub fn get_mark_price(env: Env) -> i128 {
        vamm::get_mark_price(&env)
    }

    pub fn get_oracle_price(env: Env) -> i128 {
        oracle::get_price(&env)
    }

    /// The price the risk engine actually acts on: the TWAP when smoothing is
    /// enabled, otherwise the latest index. Compare against `get_oracle_price`
    /// to see how far a spike has been damped.
    pub fn get_risk_price(env: Env) -> i128 {
        oracle::risk_price(&env)
    }

    /// TWAP over an arbitrary trailing window, for charting and what-if queries.
    /// Does not have to match the configured window.
    pub fn get_twap(env: Env, window: u64) -> i128 {
        oracle::twap(&env, window)
    }

    /// Configured TWAP window in seconds; `0` means smoothing is off.
    pub fn get_twap_window(env: Env) -> u64 {
        storage::get_twap_window(&env)
    }

    /// Retained index observations backing the TWAP (oldest first, max 24).
    pub fn get_price_history(env: Env) -> Vec<PricePoint> {
        storage::get_price_history(&env)
    }

    pub fn get_health_factor(env: Env, user: Address) -> i128 {
        margin::health_factor(&env, &user)
    }

    pub fn get_reserves(env: Env) -> Reserves {
        let (base, quote) = storage::get_reserves(&env);
        Reserves { base, quote }
    }

    pub fn get_config(env: Env) -> Config {
        storage::get_config(&env)
    }

    /// Governance timelock delay in seconds.
    pub fn get_timelock_delay(env: Env) -> u64 {
        storage::get_timelock_delay(&env)
    }

    /// The queued upgrade awaiting its timelock, if any.
    pub fn get_pending_upgrade(env: Env) -> Option<storage::PendingUpgrade> {
        storage::get_pending_upgrade(&env)
    }

    /// The queued config change awaiting its timelock, if any.
    pub fn get_pending_config(env: Env) -> Option<storage::PendingConfig> {
        storage::get_pending_config(&env)
    }

    pub fn get_buckets(env: Env) -> Buckets {
        Buckets {
            total_collateral: storage::get_total_collateral(&env),
            fee_vault: storage::get_fee_vault(&env),
            insurance_fund: storage::get_insurance_fund(&env),
        }
    }

    /// (cumulative_funding_index, last_settlement_timestamp)
    pub fn get_funding(env: Env) -> (i128, u64) {
        (
            storage::get_cum_funding(&env),
            storage::get_last_funding_ts(&env),
        )
    }

    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }

    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }
}

/// Small helper so entrypoints read cleanly while still emitting typed errors.
fn panic_err(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}

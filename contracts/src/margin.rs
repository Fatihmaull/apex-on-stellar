use soroban_sdk::{token, Address, Env};
use crate::storage::{
    get_margin_account, set_margin_account, get_position, get_margin_ratios,
    get_usdc_token
};
use crate::vamm::{get_position_value, calculate_pnl, SCALE};

/// Deposit USDC margin into the user's free margin balance
pub fn deposit_margin(env: &Env, user: &Address, amount: i128) {
    assert!(amount > 0, "deposit amount must be positive");
    
    // Transfer USDC from user to contract
    let usdc_addr = get_usdc_token(env).expect("USDC token not set");
    let usdc_client = token::Client::new(env, &usdc_addr);
    usdc_client.transfer(user, &env.current_contract_address(), &amount);

    // Increase user's free margin balance
    let current_balance = get_margin_account(env, user);
    set_margin_account(env, user, current_balance + amount);
}

/// Withdraw USDC margin from the user's free margin balance
pub fn withdraw_margin(env: &Env, user: &Address, amount: i128) {
    assert!(amount > 0, "withdraw amount must be positive");
    
    let current_balance = get_margin_account(env, user);
    assert!(current_balance >= amount, "insufficient free margin balance");

    // If user has an active position, make sure their remaining free + allocated margin meets initial margin requirement
    let position = get_position(env, user);
    if position.size != 0 {
        let position_value = get_position_value(env, &position);
        let pnl = calculate_pnl(&position, position_value);
        let (init_ratio, _) = get_margin_ratios(env);
        
        // Total Equity = free_margin + allocated_margin + PnL
        let total_equity = (current_balance - amount) + position.margin_allocated + pnl;
        let required_init_margin = (position_value * init_ratio) / 10000;
        
        assert!(
            total_equity >= required_init_margin,
            "cannot withdraw: remaining equity falls below initial margin requirement"
        );
    }

    // Deduct and transfer
    set_margin_account(env, user, current_balance - amount);
    let usdc_addr = get_usdc_token(env).expect("USDC token not set");
    let usdc_client = token::Client::new(env, &usdc_addr);
    usdc_client.transfer(&env.current_contract_address(), user, &amount);
}

/// Calculates the health factor of a user's position.
/// - Returns: Health factor scaled by 10^7.
///   - 1.0 (10^7) is the liquidation threshold.
///   - If no position exists, returns a safe value (100 * 10^7).
pub fn calculate_health_factor(env: &Env, user: &Address) -> i128 {
    let position = get_position(env, user);
    if position.size == 0 {
        return SCALE * 100; // No position = fully healthy
    }

    let position_value = get_position_value(env, &position);
    let pnl = calculate_pnl(&position, position_value);
    
    // Position Equity = Margin Allocated + Unrealized PnL
    let equity = position.margin_allocated + pnl;
    if equity <= 0 {
        return 0; // Completely wiped out
    }

    let (_, maint_ratio) = get_margin_ratios(env);
    // Maintenance Margin Requirement = Position Value * Maintenance Ratio
    let maint_margin_requirement = (position_value * maint_ratio) / 10000;
    
    if maint_margin_requirement == 0 {
        return SCALE * 100;
    }

    // Health Factor = Equity / Maintenance Margin Requirement
    (equity * SCALE) / maint_margin_requirement
}

/// Checks if a user's position can be liquidated.
/// - Returns true if health factor is strictly less than 1.0 (SCALE).
pub fn is_liquidatable(env: &Env, user: &Address) -> bool {
    let position = get_position(env, user);
    if position.size == 0 {
        return false;
    }
    let hf = calculate_health_factor(env, user);
    hf < SCALE
}

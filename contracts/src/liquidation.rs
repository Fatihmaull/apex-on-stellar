use soroban_sdk::{token, Address, Env};
use crate::storage::{
    get_margin_account, set_margin_account, get_position, remove_position,
    get_usdc_token, set_vamm_reserves
};
use crate::vamm::{get_position_value, calculate_pnl, swap};
use crate::margin::is_liquidatable;

/// Liquidates an underwater position (health factor < 1.0).
/// - `liquidator`: The address initiating the liquidation.
/// - `user`: The address of the position owner.
pub fn liquidate_position(env: &Env, liquidator: &Address, user: &Address) {
    liquidator.require_auth();

    // Verify the position is indeed liquidatable
    assert!(is_liquidatable(env, user), "position is not liquidatable");

    let position = get_position(env, user);
    assert!(position.size != 0, "no active position to liquidate");

    // 1. Calculate exit value and PnL
    let position_value = get_position_value(env, &position);
    let pnl = calculate_pnl(&position, position_value);
    
    // Position Equity = Margin Allocated + PnL
    let equity = position.margin_allocated + pnl;

    // 2. Calculate the 5% slashing penalty from the position's current value
    let penalty = (position_value * 500) / 10000; // 5% = 500 bps
    
    // Ensure we don't slash more than the remaining equity
    let actual_slashed = if penalty > equity { equity } else { penalty };
    
    // Liquidator bounty: 50% of the slashed penalty
    let liquidator_bounty = actual_slashed / 2;
    
    // Protocol share: remaining 50% stays in the contract
    let _protocol_share = actual_slashed - liquidator_bounty;

    // 3. Close the position in the vAMM (update the reserves)
    let size_abs = position.size.abs();
    let is_long = position.size > 0;
    // Closing swap: if user was long, we sell (is_long=false). If short, we buy (is_long=true).
    let (_, new_base, new_quote) = swap(env, size_abs, !is_long);
    set_vamm_reserves(env, new_base, new_quote);

    // 4. Pay the liquidator bounty in USDC
    let usdc_addr = get_usdc_token(env).expect("USDC token not set");
    if liquidator_bounty > 0 {
        let usdc_client = token::Client::new(env, &usdc_addr);
        usdc_client.transfer(&env.current_contract_address(), liquidator, &liquidator_bounty);
    }

    // 5. Return remaining collateral (equity - actual_slashed) to the user's free margin
    let remaining_collateral = equity - actual_slashed;
    if remaining_collateral > 0 {
        let current_free_margin = get_margin_account(env, user);
        set_margin_account(env, user, current_free_margin + remaining_collateral);
    }

    // 6. Delete user's position record
    remove_position(env, user);
}

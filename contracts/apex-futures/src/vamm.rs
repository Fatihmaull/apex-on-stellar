use soroban_sdk::Env;
use crate::storage::{get_vamm_reserves, Position};

pub const SCALE: i128 = 10_000_000; // 7 decimals (matches USDC)

/// Fixed-point multiplication: (a * b) / SCALE
pub fn fp_mul(a: i128, b: i128) -> i128 {
    a.checked_mul(b).unwrap() / SCALE
}

/// Fixed-point division: (a * SCALE) / b
pub fn fp_div(a: i128, b: i128) -> i128 {
    a.checked_mul(SCALE).unwrap() / b
}

/// Get the current virtual mark price: y / x
pub fn get_mark_price(env: &Env) -> i128 {
    let (base_reserve, quote_reserve) = get_vamm_reserves(env);
    if base_reserve == 0 {
        return 0;
    }
    fp_div(quote_reserve, base_reserve)
}

/// Simulates or executes a swap on the vAMM.
/// - `size`: Quantity of virtual base asset (compute hours) to trade (scaled by SCALE). Must be positive.
/// - `is_long`: True if buying base asset (Long), False if selling base asset (Short).
/// Returns `(quote_amount, new_base_reserve, new_quote_reserve)` where `quote_amount` is the total entry/exit value in USDC.
pub fn swap(
    env: &Env,
    size: i128,
    is_long: bool,
) -> (i128, i128, i128) {
    let (base_reserve, quote_reserve) = get_vamm_reserves(env);
    assert!(size > 0, "swap size must be positive");
    assert!(base_reserve > 0 && quote_reserve > 0, "vAMM not initialized");

    if is_long {
        // User buys base asset (size) -> base reserve decreases by size
        assert!(base_reserve > size, "insufficient base reserve liquidity");
        let new_base_reserve = base_reserve - size;
        // y_new = (x * y) / x_new
        let new_quote_reserve = (base_reserve * quote_reserve) / new_base_reserve;
        // quote_amount = y_new - y
        let quote_amount = new_quote_reserve - quote_reserve;
        (quote_amount, new_base_reserve, new_quote_reserve)
    } else {
        // User sells base asset (size) -> base reserve increases by size
        let new_base_reserve = base_reserve + size;
        // y_new = (x * y) / x_new
        let new_quote_reserve = (base_reserve * quote_reserve) / new_base_reserve;
        // quote_amount = y - y_new
        let quote_amount = quote_reserve - new_quote_reserve;
        (quote_amount, new_base_reserve, new_quote_reserve)
    }
}

/// Calculates the current exit value in USDC (7 decimals) for a given position.
/// - To close a Long position: we sell the base asset size back to the vAMM.
/// - To close a Short position: we buy the base asset size back from the vAMM.
pub fn get_position_value(env: &Env, position: &Position) -> i128 {
    if position.size == 0 {
        return 0;
    }
    
    let is_long = position.size > 0;
    let size_abs = position.size.abs();
    
    // Simulate the swap to close. 
    // If we are Long, we sell the base asset (is_long = false for closing swap).
    // If we are Short, we buy the base asset (is_long = true for closing swap).
    let (quote_amount, _, _) = swap(env, size_abs, !is_long);
    quote_amount
}

/// Calculates the PnL of a position.
/// - `position`: The user's active position structure.
/// - `current_value`: The current exit value of the position in USDC (from `get_position_value`).
/// Returns PnL in USDC (7 decimals, can be negative for losses).
pub fn calculate_pnl(position: &Position, current_value: i128) -> i128 {
    let entry_value = fp_mul(position.size.abs(), position.entry_price);
    if position.size > 0 {
        // Long PnL: Exit Value - Entry Value
        current_value - entry_value
    } else if position.size < 0 {
        // Short PnL: Entry Value - Exit Value
        entry_value - current_value
    } else {
        0
    }
}

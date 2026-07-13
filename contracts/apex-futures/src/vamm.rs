use soroban_sdk::{panic_with_error, Env};

use crate::errors::Error;
use crate::storage::{get_reserves, Position, SCALE};

// --- Overflow-safe fixed-point primitives ----------------------------------
//
// All operands here are non-negative unless noted. We use `checked_mul` on i128
// and surface `MathOverflow` on overflow rather than silently wrapping. For the
// realistic reserve/price magnitudes used by APEX (reserves ~1e13, prices ~1e8)
// the intermediate products stay far below i128::MAX (~1.7e38), so overflow only
// triggers on genuinely pathological inputs — which we correctly reject.

/// floor(a * b / denom). Requires denom > 0.
pub fn mul_div_floor(env: &Env, a: i128, b: i128, denom: i128) -> i128 {
    if denom <= 0 {
        panic_with_error!(env, Error::MathOverflow);
    }
    match a.checked_mul(b) {
        Some(p) => p / denom,
        None => panic_with_error!(env, Error::MathOverflow),
    }
}

/// ceil(a * b / denom) for non-negative inputs. Requires denom > 0.
pub fn mul_div_ceil(env: &Env, a: i128, b: i128, denom: i128) -> i128 {
    if denom <= 0 {
        panic_with_error!(env, Error::MathOverflow);
    }
    match a.checked_mul(b) {
        Some(p) => {
            // (p + denom - 1) / denom, guarding the addition too.
            match p.checked_add(denom - 1) {
                Some(n) => n / denom,
                None => panic_with_error!(env, Error::MathOverflow),
            }
        }
        None => panic_with_error!(env, Error::MathOverflow),
    }
}

/// Fixed-point multiply: a * b / SCALE (floor).
pub fn fp_mul(env: &Env, a: i128, b: i128) -> i128 {
    mul_div_floor(env, a, b, SCALE)
}

/// Fixed-point divide: a * SCALE / b (floor).
pub fn fp_div(env: &Env, a: i128, b: i128) -> i128 {
    mul_div_floor(env, a, SCALE, b)
}

/// Current virtual mark price: quote / base (USDC per base unit, 7 dp).
pub fn get_mark_price(env: &Env) -> i128 {
    let (base, quote) = get_reserves(env);
    if base == 0 {
        return 0;
    }
    fp_div(env, quote, base)
}

/// Simulate/execute a constant-product (x*y=k) swap on the vAMM.
///
/// - `size`: positive quantity of virtual base units traded.
/// - `is_long`: true = buy base (long/close-short), false = sell base (short/close-long).
///
/// Rounding always favors the protocol: buyers pay the ceiling, sellers receive
/// the floor. Returns `(quote_amount, new_base, new_quote)` where `quote_amount`
/// is the notional (USDC, 7 dp) moved by the trade.
pub fn swap(env: &Env, size: i128, is_long: bool) -> (i128, i128, i128) {
    let (base, quote) = get_reserves(env);
    if size <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    if base <= 0 || quote <= 0 {
        panic_with_error!(env, Error::NotInitialized);
    }

    if is_long {
        // Buying base: base reserve shrinks. Must retain strictly positive liquidity.
        if base <= size {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        let new_base = base - size;
        // y_new = ceil(x*y / x_new) => buyer pays the rounded-up cost.
        let new_quote = mul_div_ceil(env, base, quote, new_base);
        let quote_amount = new_quote - quote;
        (quote_amount, new_base, new_quote)
    } else {
        // Selling base: base reserve grows.
        let new_base = base + size;
        // y_new = floor(x*y / x_new) => seller receives the rounded-down proceeds.
        let new_quote = mul_div_floor(env, base, quote, new_base);
        let quote_amount = quote - new_quote;
        (quote_amount, new_base, new_quote)
    }
}

/// Realized PnL (USDC, 7 dp, signed) of `position` given a realized `exit_value`.
/// Long: exit - entry_notional. Short: entry_notional - exit.
pub fn calculate_pnl(env: &Env, position: &Position, exit_value: i128) -> i128 {
    let entry_notional = fp_mul(env, position.size.abs(), position.entry_price);
    if position.size > 0 {
        exit_value - entry_notional
    } else if position.size < 0 {
        entry_notional - exit_value
    } else {
        0
    }
}

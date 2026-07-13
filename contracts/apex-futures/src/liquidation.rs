use soroban_sdk::{panic_with_error, token, Address, Env};

use crate::errors::Error;
use crate::events;
use crate::funding;
use crate::margin;
use crate::oracle;
use crate::storage::{self, BPS_DENOM, SCALE};
use crate::vamm;

/// Force-close an underwater position (health factor < 1.0 at the fresh index).
///
/// Security-critical choices:
/// - Eligibility is judged on the *fresh oracle index price*, not the vAMM mark,
///   so an attacker cannot swing the mark to trigger (or dodge) liquidations.
/// - Realized settlement flows through `settle_close`, preserving the solvency
///   invariant; the 5% penalty is split explicitly between liquidator reward and
///   the insurance fund.
pub fn liquidate(env: &Env, liquidator: &Address, user: &Address) {
    liquidator.require_auth();

    let price = oracle::get_fresh_price(env);
    let pos = storage::get_position(env, user);
    if pos.size == 0 {
        panic_with_error!(env, Error::NoPosition);
    }
    // Gate on index-priced health factor.
    if margin::health_factor_at(env, &pos, price) >= SCALE {
        panic_with_error!(env, Error::NotLiquidatable);
    }

    let cfg = storage::get_config(env);

    // 1. Realize the position against the vAMM (actual execution price).
    let size_abs = pos.size.abs();
    let is_long = pos.size > 0;
    let (exit_value, new_base, new_quote) = vamm::swap(env, size_abs, !is_long);
    let pnl = vamm::calculate_pnl(env, &pos, exit_value);
    let funding_owed = funding::pending_funding(env, &pos);

    // 2. Settle PnL/funding into a notional "credited" equity (no trading fee on
    //    liquidations — the penalty replaces it).
    let credited = margin::settle_close(env, pos.margin_allocated, pnl, funding_owed, 0);

    // 3. Apply the liquidation penalty and split it (reward vs. insurance).
    let penalty = vamm::mul_div_floor(env, credited, cfg.liq_penalty_bps, BPS_DENOM);
    let reward = vamm::mul_div_floor(env, penalty, cfg.liq_reward_bps, BPS_DENOM);
    let user_return = credited - penalty;

    // Move the penalty out of the user's claim; insurance keeps the protocol share.
    storage::set_total_collateral(env, storage::get_total_collateral(env) - penalty);
    storage::set_insurance_fund(env, storage::get_insurance_fund(env) + penalty - reward);

    // 4. Effects: credit the user's remaining equity, update reserves, drop position.
    storage::set_margin(env, user, storage::get_margin(env, user) + user_return);
    storage::set_reserves(env, new_base, new_quote);
    storage::remove_position(env, user);
    storage::extend_instance(env);

    // 5. Interaction: pay the liquidator's bounty in USDC.
    if reward > 0 {
        let usdc = storage::get_usdc_token(env);
        token::Client::new(env, &usdc).transfer(
            &env.current_contract_address(),
            liquidator,
            &reward,
        );
    }

    events::liquidate(env, user, liquidator, penalty, reward, user_return);
}

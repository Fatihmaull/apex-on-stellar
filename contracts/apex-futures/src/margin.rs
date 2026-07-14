use soroban_sdk::{panic_with_error, token, Address, Env};

use crate::errors::Error;
use crate::events;
use crate::funding;
use crate::oracle;
use crate::storage::{self, Position, BPS_DENOM, SCALE};
use crate::vamm::{self, fp_mul, mul_div_floor};

// --- Collateral deposit / withdrawal ---------------------------------------

/// Deposit USDC as free collateral. Follows checks-effects-interactions: we
/// validate, pull the SAC transfer, then update internal claims.
pub fn deposit(env: &Env, user: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    // Interaction: pull USDC into the contract (authorized by the SAC/user).
    let usdc = storage::get_usdc_token(env);
    token::Client::new(env, &usdc).transfer(user, &env.current_contract_address(), &amount);

    // Effects: credit the user and the global collateral bucket.
    storage::set_margin(env, user, storage::get_margin(env, user) + amount);
    storage::set_total_collateral(env, storage::get_total_collateral(env) + amount);
    storage::extend_instance(env);
    events::deposit(env, user, amount);
}

/// Withdraw free collateral. If the user holds a position, the remaining equity
/// (valued at the *fresh index price*, not the manipulable mark) must still meet
/// the initial-margin requirement.
pub fn withdraw(env: &Env, user: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let free = storage::get_margin(env, user);
    if free < amount {
        panic_with_error!(env, Error::InsufficientFreeMargin);
    }

    let pos = storage::get_position(env, user);
    if pos.size != 0 {
        let price = oracle::get_fresh_price(env); // reject risk decisions on stale data
        let cfg = storage::get_config(env);
        let notional = fp_mul(env, pos.size.abs(), price);
        let ipnl = index_pnl(env, &pos, price);
        let funding_owed = funding::pending_funding(env, &pos);
        let equity_after = (free - amount) + pos.margin_allocated + ipnl - funding_owed;
        let required = mul_div_floor(env, notional, cfg.init_margin_bps, BPS_DENOM);
        if equity_after < required {
            panic_with_error!(env, Error::InsufficientMargin);
        }
    }

    // Effects then interaction.
    storage::set_margin(env, user, free - amount);
    storage::set_total_collateral(env, storage::get_total_collateral(env) - amount);
    let usdc = storage::get_usdc_token(env);
    token::Client::new(env, &usdc).transfer(&env.current_contract_address(), user, &amount);
    storage::extend_instance(env);
    events::withdraw(env, user, amount);
}

// --- Risk valuation --------------------------------------------------------

/// Unrealized PnL valued at `price` (typically the index). Signed.
pub fn index_pnl(env: &Env, pos: &Position, price: i128) -> i128 {
    let size_abs = pos.size.abs();
    let mark_notional = fp_mul(env, size_abs, price);
    let entry_notional = fp_mul(env, size_abs, pos.entry_price);
    if pos.size > 0 {
        mark_notional - entry_notional
    } else if pos.size < 0 {
        entry_notional - mark_notional
    } else {
        0
    }
}

/// Health factor (scaled by SCALE; 1.0 == SCALE is the liquidation threshold),
/// evaluated at `price`. Includes accrued funding so funding debt can trigger
/// liquidation. Returns a large value when there is no position.
pub fn health_factor_at(env: &Env, pos: &Position, price: i128) -> i128 {
    if pos.size == 0 {
        return SCALE * 100;
    }
    let cfg = storage::get_config(env);
    let notional = fp_mul(env, pos.size.abs(), price);
    let ipnl = index_pnl(env, pos, price);
    let funding_owed = funding::pending_funding(env, pos);
    let equity = pos.margin_allocated + ipnl - funding_owed;
    if equity <= 0 {
        return 0;
    }
    let maint_req = mul_div_floor(env, notional, cfg.maint_margin_bps, BPS_DENOM);
    if maint_req == 0 {
        return SCALE * 100;
    }
    mul_div_floor(env, equity, SCALE, maint_req)
}

/// Health factor for display/queries. Reads the same risk price liquidation acts
/// on (TWAP-smoothed once enabled), so what a user is shown matches what the
/// chain will do; falls back to the vAMM mark only if no index is set yet.
pub fn health_factor(env: &Env, user: &Address) -> i128 {
    let pos = storage::get_position(env, user);
    if pos.size == 0 {
        return SCALE * 100;
    }
    let index = oracle::risk_price(env);
    let price = if index > 0 {
        index
    } else {
        vamm::get_mark_price(env)
    };
    health_factor_at(env, &pos, price)
}

// --- Settlement helper (solvency-preserving) -------------------------------

/// Realize a position closure into the user's free margin while keeping the
/// solvency invariant `vault == TotalCollateral + FeeVault + InsuranceFund`.
///
/// Given the `released` allocated margin, realized `pnl`, `funding_owed` (signed)
/// and `fee`, this computes the amount to credit the user and routes the
/// remainder between the fee vault and insurance fund. Profit payouts are capped
/// so the insurance fund can never be driven negative — the system never pays
/// out more USDC than it holds (bad debt surfaces as capped winner profits, the
/// standard vAMM/insurance backstop). Returns the amount credited to the user;
/// the caller is responsible for adding it to the user's free margin.
pub fn settle_close(env: &Env, released: i128, pnl: i128, funding_owed: i128, fee: i128) -> i128 {
    let cfg = storage::get_config(env);

    // Protocol keeps a small cut of funding *paid by* the position.
    let funding_admin_cut = if funding_owed > 0 {
        mul_div_floor(env, funding_owed, cfg.funding_admin_cut_bps, BPS_DENOM)
    } else {
        0
    };
    let delta_fee_vault = fee + funding_admin_cut;

    let mut credited = released + pnl - funding_owed - fee;
    if credited < 0 {
        credited = 0;
    }

    // Cap credit so insurance stays >= 0:
    //   insurance_new = insurance + (released - credited) - delta_fee_vault >= 0
    let insurance = storage::get_insurance_fund(env);
    let mut max_credit = released - delta_fee_vault + insurance;
    if max_credit < 0 {
        max_credit = 0;
    }
    if credited > max_credit {
        credited = max_credit;
    }

    // Apply buckets. By construction the three buckets' sum is unchanged, so the
    // USDC vault (untouched here) still fully backs all claims.
    storage::set_fee_vault(env, storage::get_fee_vault(env) + delta_fee_vault);
    storage::set_insurance_fund(env, insurance + (released - credited) - delta_fee_vault);
    storage::set_total_collateral(
        env,
        storage::get_total_collateral(env) + (credited - released),
    );
    credited
}

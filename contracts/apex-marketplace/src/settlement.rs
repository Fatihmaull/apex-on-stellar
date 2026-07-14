//! Cash-settle redemption and CU oracle reads.

use soroban_sdk::{panic_with_error, Address, Env, Symbol, Vec};

use crate::cu_token;
use crate::errors::Error;
use crate::events;
use crate::series::{mul_div_floor, mul_div_ceil};
use crate::storage::{self, BPS_DENOM, SCALE};

/// Fresh CU (ACPI) price: prefers cross-call to futures, falls back to local.
pub fn get_fresh_cu_price(env: &Env) -> i128 {
    let futures = storage::get_futures_oracle(env);
    // Cross-call when futures address is set to a real contract; on failure /
    // zero we use the locally mirrored price (keeper-synced).
    let remote: i128 = env.try_invoke_contract::<i128, Error>(
        &futures,
        &Symbol::new(env, "get_oracle_price"),
        Vec::new(env),
    )
    .unwrap_or(Ok(0))
    .unwrap_or(0);

    let price = if remote > 0 {
        // Mirror for staleness accounting.
        storage::set_oracle_price(env, remote);
        storage::set_oracle_ts(env, env.ledger().timestamp());
        remote
    } else {
        storage::get_oracle_price(env)
    };

    if price <= 0 {
        panic_with_error!(env, Error::StaleOracle);
    }
    let cfg = storage::get_config(env);
    let ts = storage::get_oracle_ts(env);
    let now = env.ledger().timestamp();
    if now > ts && now - ts > cfg.oracle_staleness {
        panic_with_error!(env, Error::StaleOracle);
    }
    price
}

/// Series reference price = ACPI × (coeff / SCALE).
pub fn series_ref_price(env: &Env, series_id: u64) -> i128 {
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    let acpi = get_fresh_cu_price(env);
    mul_div_floor(env, acpi, s.coefficient, SCALE)
}

/// Burn CU and pay USDC at oracle series ref price.
pub fn redeem_cu(env: &Env, holder: &Address, series_id: u64, amount: i128) {
    holder.require_auth();
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));

    let price = series_ref_price(env, series_id);
    let gross = mul_div_floor(env, amount, price, SCALE);
    let cfg = storage::get_config(env);
    let fee = mul_div_floor(env, gross, cfg.settlement_fee_bps, BPS_DENOM);
    let payout = gross - fee;

    cu_token::burn(env, series_id, holder, amount);

    // Reduce provider minted outstanding.
    let mut p = storage::get_provider(env, &s.provider)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    if p.minted_cu < amount {
        panic_with_error!(env, Error::InvalidAmount);
    }
    p.minted_cu -= amount;
    storage::set_provider(env, &s.provider, &p);

    debit_payout(env, &s.provider, payout, fee);

    let usdc = storage::get_usdc_token(env);
    soroban_sdk::token::Client::new(env, &usdc).transfer(
        &env.current_contract_address(),
        holder,
        &payout,
    );

    storage::extend_instance(env);
    events::cash_redeemed(env, holder, series_id, amount, payout);
}

/// Debit provider collateral then insurance; credit fee vault.
fn debit_payout(env: &Env, provider: &Address, payout: i128, fee: i128) {
    let needed = payout
        .checked_add(fee)
        .unwrap_or_else(|| panic_with_error!(env, Error::MathOverflow));
    let mut p = storage::get_provider(env, provider)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));

    let from_collateral = needed.min(p.collateral);
    p.collateral -= from_collateral;
    storage::set_provider(env, provider, &p);
    storage::set_provider_collateral_total(
        env,
        storage::get_provider_collateral_total(env) - from_collateral,
    );

    let remaining = needed - from_collateral;
    if remaining > 0 {
        let ins = storage::get_insurance_fund(env);
        if ins < remaining {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        storage::set_insurance_fund(env, ins - remaining);
    }

    if fee > 0 {
        storage::set_fee_vault(env, storage::get_fee_vault(env) + fee);
    }
}

/// Local oracle update (keeper sync from ACPI when cross-call unavailable).
pub fn update_cu_oracle(env: &Env, caller: &Address, price: i128) {
    caller.require_auth();
    if *caller != storage::get_admin(env) && *caller != storage::get_verifier(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
    if price <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    storage::set_oracle_price(env, price);
    storage::set_oracle_ts(env, env.ledger().timestamp());
    storage::extend_instance(env);
    events::oracle(env, price, env.ledger().timestamp());
}

#[allow(dead_code)]
pub fn mul_ceil_export(env: &Env, a: i128, b: i128, d: i128) -> i128 {
    mul_div_ceil(env, a, b, d)
}

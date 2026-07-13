use soroban_sdk::{panic_with_error, Address, Env};

use crate::errors::Error;
use crate::events;
use crate::storage::{self, BPS_DENOM};

/// Permissioned endpoint for injecting GRC-validated APAC GPU Index prices.
///
/// Hardening vs. the naive version:
/// - Authenticates AND authorizes the updater against the registered role.
/// - Rejects non-positive prices.
/// - Enforces a deviation band vs. the last price to blunt a single compromised
///   or fat-fingered update from moving the mark far enough to mass-liquidate.
/// - Stamps the ledger timestamp so downstream risk checks can reject stale data.
pub fn update_price(env: &Env, updater: &Address, new_price: i128) {
    updater.require_auth();
    if *updater != storage::get_oracle_updater(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
    if new_price <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }

    let last = storage::get_oracle_price(env);
    if last > 0 {
        let cfg = storage::get_config(env);
        // Enforce |new - last| <= last * max_deviation_bps / BPS_DENOM.
        let diff = (new_price - last).abs();
        let bound = last
            .checked_mul(cfg.oracle_max_deviation_bps)
            .unwrap_or(i128::MAX)
            / BPS_DENOM;
        if diff > bound {
            panic_with_error!(env, Error::OracleDeviationTooHigh);
        }
    }

    let now = env.ledger().timestamp();
    storage::set_oracle_price(env, new_price);
    storage::set_oracle_ts(env, now);
    storage::extend_instance(env);
    events::oracle(env, new_price, now);
}

/// Read the latest index price without freshness enforcement (for display/queries).
pub fn get_price(env: &Env) -> i128 {
    storage::get_oracle_price(env)
}

/// Read the index price, rejecting it if older than the staleness window.
/// Used by risk-critical paths (liquidation, withdrawal-with-position) so
/// decisions are never made on outdated data.
pub fn get_fresh_price(env: &Env) -> i128 {
    let price = storage::get_oracle_price(env);
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

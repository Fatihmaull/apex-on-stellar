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
    storage::push_price_point(env, new_price, now);
    storage::extend_instance(env);
    events::oracle(env, new_price, now);
}

/// Read the latest index price without freshness enforcement (for display/queries).
pub fn get_price(env: &Env) -> i128 {
    storage::get_oracle_price(env)
}

/// Time-weighted average of the index over the trailing `window` seconds.
///
/// Each observation is taken to be the prevailing price from the moment it was
/// published until the next one lands (or until `now`, for the newest), so a
/// price that stood for an hour outweighs one that stood for a second. That is
/// what stops a single spike — the shape of the Feb-2026 Blend oracle exploit,
/// where the feed reported the last trade with no smoothing — from moving the
/// risk price far enough to mass-liquidate.
///
/// Falls back to the latest index whenever the window covers no elapsed time
/// (fresh deploy, empty history, or every observation inside one ledger), so the
/// risk engine can never be starved of a price.
pub fn twap(env: &Env, window: u64) -> i128 {
    let spot = storage::get_oracle_price(env);
    if window == 0 {
        return spot;
    }
    let hist = storage::get_price_history(env);
    let n = hist.len();
    if n == 0 {
        return spot;
    }

    let now = env.ledger().timestamp();
    let start = now.saturating_sub(window);

    let mut weighted: i128 = 0; // Σ price × seconds held
    let mut elapsed: i128 = 0; // Σ seconds held

    for i in 0..n {
        let p = hist.get(i).unwrap();
        // An observation prevails until the next one lands (or until now).
        let seg_end = if i + 1 < n {
            hist.get(i + 1).unwrap().ts
        } else {
            now
        };
        if seg_end <= start {
            continue; // fell entirely outside the window
        }
        let seg_start = if p.ts > start { p.ts } else { start };
        if seg_end <= seg_start {
            continue;
        }
        let dt = (seg_end - seg_start) as i128;
        let contrib = match p.price.checked_mul(dt) {
            Some(v) => v,
            None => panic_with_error!(env, Error::MathOverflow),
        };
        weighted = match weighted.checked_add(contrib) {
            Some(v) => v,
            None => panic_with_error!(env, Error::MathOverflow),
        };
        elapsed += dt;
    }

    if elapsed == 0 {
        return spot;
    }
    weighted / elapsed
}

/// The price the risk engine trades on. Equals the latest index when TWAP is
/// switched off (`twap_window == 0`) — the pre-upgrade behaviour, and the default
/// for any contract whose storage predates this key.
pub fn risk_price(env: &Env) -> i128 {
    let window = storage::get_twap_window(env);
    if window == 0 {
        storage::get_oracle_price(env)
    } else {
        twap(env, window)
    }
}

/// Read the risk price, rejecting it if the feed has gone stale. Used by
/// risk-critical paths (liquidation, withdrawal-with-position) so decisions are
/// never made on outdated data.
///
/// Staleness is judged on the *latest* observation, never on the TWAP: smoothing
/// must not be able to disguise a feed that has stopped publishing.
pub fn get_fresh_price(env: &Env) -> i128 {
    let spot = storage::get_oracle_price(env);
    if spot <= 0 {
        panic_with_error!(env, Error::StaleOracle);
    }
    let cfg = storage::get_config(env);
    let ts = storage::get_oracle_ts(env);
    let now = env.ledger().timestamp();
    if now > ts && now - ts > cfg.oracle_staleness {
        panic_with_error!(env, Error::StaleOracle);
    }
    risk_price(env)
}

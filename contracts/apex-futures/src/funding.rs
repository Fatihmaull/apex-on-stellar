use soroban_sdk::Env;

use crate::events;
use crate::storage::{self, Position, BPS_DENOM, SCALE};
use crate::vamm;

/// Funding keeps the vAMM mark price tethered to the real-world APAC GPU index.
///
/// We maintain a global cumulative funding index `CumFunding` (USDC per base
/// unit, 7 dp). Each settlement adds the (capped) premium `mark - index` scaled
/// by the number of elapsed intervals. A position's funding owed is then
/// `size * (CumFunding_now - entry_funding) / SCALE` — longs pay when the mark
/// trades above the index, shorts pay when below.
///
/// This is permissionless and idempotent-per-interval: anyone can poke it, but
/// it only advances once a full `funding_interval` has elapsed.

/// Pending funding owed by `position` (signed; positive = position owes the
/// protocol, negative = protocol owes the position).
pub fn pending_funding(env: &Env, position: &Position) -> i128 {
    if position.size == 0 {
        return 0;
    }
    let cum = storage::get_cum_funding(env);
    // size is signed, so the sign of the payment follows the side automatically.
    vamm::mul_div_floor(env, position.size, cum - position.entry_funding, SCALE)
}

/// Settle funding globally. Returns the premium applied (0 if not yet due).
/// `enforce` = true surfaces `FundingTooEarly` when called before the interval
/// elapses; the contract's public entrypoint uses that, internal callers pass false.
pub fn settle(env: &Env, enforce: bool) -> i128 {
    let cfg = storage::get_config(env);
    let now = env.ledger().timestamp();
    let last = storage::get_last_funding_ts(env);

    let elapsed = now.saturating_sub(last);
    let periods = (elapsed / cfg.funding_interval) as i128;
    if periods == 0 {
        if enforce {
            soroban_sdk::panic_with_error!(env, crate::errors::Error::FundingTooEarly);
        }
        return 0;
    }

    let mark = vamm::get_mark_price(env);
    let index = storage::get_oracle_price(env);
    if mark == 0 || index <= 0 {
        // Market not ready; just advance the clock so we don't accumulate a huge
        // backlog once prices exist.
        storage::set_last_funding_ts(env, last + (periods as u64) * cfg.funding_interval);
        return 0;
    }

    // Raw premium per interval = mark - index (USDC per base unit).
    let raw_premium = mark - index;
    // Cap magnitude at index * max_funding_bps / BPS_DENOM to bound extreme moves.
    let cap = index
        .checked_mul(cfg.max_funding_bps)
        .unwrap_or(i128::MAX)
        / BPS_DENOM;
    let premium = if raw_premium > cap {
        cap
    } else if raw_premium < -cap {
        -cap
    } else {
        raw_premium
    };

    let delta = premium * periods;
    let cum = storage::get_cum_funding(env) + delta;
    storage::set_cum_funding(env, cum);
    storage::set_last_funding_ts(env, last + (periods as u64) * cfg.funding_interval);
    storage::extend_instance(env);

    events::funding(env, premium, cum, now);
    premium
}

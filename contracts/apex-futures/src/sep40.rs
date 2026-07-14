//! SEP-40 price-feed interface — APEX as a compute-price oracle.
//!
//! APEX already discovers a price nothing else on Stellar does: what an hour of
//! APAC GPU compute costs. Reflector, the ecosystem's oracle network, publishes
//! crypto, Stellar-asset and FX feeds — there is **no compute feed anywhere**.
//! That makes this the first one.
//!
//! Exposing it behind [SEP-40](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md)
//! is what turns "you may call our getters" into "we are a drop-in oracle": any
//! protocol already reading a SEP-40 feed points at APEX by swapping the contract
//! address, with no integration code at all.
//!
//! Everything here is **read-only** and sits entirely beside the risk engine — it
//! reads the same observation ring the TWAP is built on and writes nothing.
//!
//! What SEP-40 does *not* fix: trust. The index is still published by a single
//! permissioned key, by hand. A standard interface makes the number reachable, not
//! true. See SECURITY.md §4.

use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

use crate::oracle;
use crate::storage;

/// Fixed-point precision of every price reported here (`SCALE` = 10^7).
pub const DECIMALS: u32 = 7;

/// Publish cadence advertised to consumers, in seconds.
///
/// Nothing in the contract *enforces* it: the index is pushed by a permissioned
/// updater, not a keeper on a timer. Treat this as the intended poll interval and
/// judge freshness from `lastprice().timestamp` against your own staleness policy.
pub const RESOLUTION: u32 = 300;

/// SEP-40 asset identifier.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum Asset {
    /// An asset issued on Stellar, identified by its contract address.
    Stellar(Address),
    /// Anything else, identified by symbol — how the compute index is named.
    Other(Symbol),
}

/// SEP-40 price record.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// The single asset this feed quotes: the APAC Compute Price Index.
pub fn acpi() -> Asset {
    Asset::Other(symbol_short!("ACPI"))
}

fn is_acpi(asset: &Asset) -> bool {
    *asset == acpi()
}

/// The denomination every price is quoted in — the collateral asset, USDC.
pub fn base(env: &Env) -> Asset {
    Asset::Stellar(storage::get_usdc_token(env))
}

/// Every asset this feed quotes. APEX runs a single market, so: one.
pub fn assets(env: &Env) -> Vec<Asset> {
    let mut v = Vec::new(env);
    v.push_back(acpi());
    v
}

/// Latest index price. `None` for an unknown asset, or before the first publish.
pub fn lastprice(env: &Env, asset: &Asset) -> Option<PriceData> {
    if !is_acpi(asset) {
        return None;
    }
    let price = storage::get_oracle_price(env);
    if price <= 0 {
        return None;
    }
    Some(PriceData {
        price,
        timestamp: storage::get_oracle_ts(env),
    })
}

/// The last `records` observations, **newest first**.
///
/// Bounded by the retained ring (`MAX_PRICE_POINTS`), so asking for more than we
/// keep returns what we have rather than failing.
pub fn prices(env: &Env, asset: &Asset, records: u32) -> Option<Vec<PriceData>> {
    if !is_acpi(asset) || records == 0 {
        return None;
    }
    let hist = storage::get_price_history(env);
    let n = hist.len();
    if n == 0 {
        return None;
    }
    let take = if records < n { records } else { n };

    let mut out = Vec::new(env);
    for i in 0..take {
        let p = hist.get(n - 1 - i).unwrap();
        out.push_back(PriceData {
            price: p.price,
            timestamp: p.ts,
        });
    }
    Some(out)
}

/// The price that prevailed at `timestamp`: the newest observation published at
/// or before it. `None` if `timestamp` predates everything we still retain.
///
/// Unlike bucketed feeds, any timestamp is accepted — no alignment to
/// [`RESOLUTION`] is required.
pub fn price(env: &Env, asset: &Asset, timestamp: u64) -> Option<PriceData> {
    if !is_acpi(asset) {
        return None;
    }
    let hist = storage::get_price_history(env);
    let mut found: Option<PriceData> = None;
    // The ring is chronological, so walk forward and keep the last one in range.
    for i in 0..hist.len() {
        let p = hist.get(i).unwrap();
        if p.ts > timestamp {
            break;
        }
        found = Some(PriceData {
            price: p.price,
            timestamp: p.ts,
        });
    }
    found
}

/// Time-weighted average over the span covered by the last `records` observations.
///
/// Not part of SEP-40 proper — it is the Reflector extension consumers reach for,
/// and the one that matters: Blend was drained for ~$10.8M in Feb 2026 reading a
/// feed's last trade with no smoothing.
pub fn twap(env: &Env, asset: &Asset, records: u32) -> Option<i128> {
    if !is_acpi(asset) || records == 0 {
        return None;
    }
    let hist = storage::get_price_history(env);
    let n = hist.len();
    if n == 0 {
        return None;
    }
    let take = if records < n { records } else { n };
    let oldest = hist.get(n - take).unwrap();
    let window = env.ledger().timestamp().saturating_sub(oldest.ts);
    Some(oracle::twap(env, window))
}

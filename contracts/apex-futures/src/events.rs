//! Structured event emission for full on-chain auditability (GRC requirement).
//!
//! Every critical state change publishes a typed event. Topics are short symbols
//! plus (where relevant) the subject address so indexers/frontends can filter by
//! user. The data payload carries the numeric detail of the action.

use soroban_sdk::{symbol_short, Address, Env};

pub fn init(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("init"),), admin.clone());
}

pub fn deposit(env: &Env, user: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("deposit"), user.clone()), amount);
}

pub fn withdraw(env: &Env, user: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("withdraw"), user.clone()), amount);
}

/// (size, entry_price, margin_allocated, fee)
pub fn open(env: &Env, user: &Address, size: i128, entry_price: i128, margin: i128, fee: i128) {
    env.events().publish(
        (symbol_short!("open"), user.clone()),
        (size, entry_price, margin, fee),
    );
}

/// (pnl, funding_owed, fee, credited)
pub fn close(env: &Env, user: &Address, pnl: i128, funding: i128, fee: i128, credited: i128) {
    env.events().publish(
        (symbol_short!("close"), user.clone()),
        (pnl, funding, fee, credited),
    );
}

/// (liquidator, penalty, reward, user_return)
pub fn liquidate(
    env: &Env,
    user: &Address,
    liquidator: &Address,
    penalty: i128,
    reward: i128,
    user_return: i128,
) {
    env.events().publish(
        (symbol_short!("liquidate"), user.clone()),
        (liquidator.clone(), penalty, reward, user_return),
    );
}

/// (price, timestamp)
pub fn oracle(env: &Env, price: i128, ts: u64) {
    env.events()
        .publish((symbol_short!("oracle"),), (price, ts));
}

/// (premium, cum_funding, timestamp)
pub fn funding(env: &Env, premium: i128, cum_funding: i128, ts: u64) {
    env.events()
        .publish((symbol_short!("funding"),), (premium, cum_funding, ts));
}

/// (by, new_window_seconds) — 0 means TWAP smoothing was switched off.
pub fn twap_window_set(env: &Env, by: &Address, window: u64) {
    env.events()
        .publish((symbol_short!("twapwin"),), (by.clone(), window));
}

/// (collector, amount)
pub fn fees_collected(env: &Env, to: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("fees"), to.clone()), amount);
}

/// (from, amount)
pub fn insurance_seed(env: &Env, from: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("insurance"), from.clone()), amount);
}

pub fn paused(env: &Env, by: &Address) {
    env.events().publish((symbol_short!("paused"),), by.clone());
}

pub fn unpaused(env: &Env, by: &Address) {
    env.events()
        .publish((symbol_short!("unpaused"),), by.clone());
}

pub fn admin_transferred(env: &Env, new_admin: &Address) {
    env.events()
        .publish((symbol_short!("admin_set"),), new_admin.clone());
}

pub fn config_updated(env: &Env, by: &Address) {
    env.events().publish((symbol_short!("param"),), by.clone());
}

pub fn upgraded(env: &Env, by: &Address) {
    env.events()
        .publish((symbol_short!("upgrade"),), by.clone());
}

// --- Governance timelock lifecycle ----------------------------------------

/// (by, eta) — a WASM upgrade was queued behind the timelock.
pub fn upgrade_proposed(env: &Env, by: &Address, eta: u64) {
    env.events()
        .publish((symbol_short!("up_prop"),), (by.clone(), eta));
}

/// (by, eta) — a config change was queued behind the timelock.
pub fn config_proposed(env: &Env, by: &Address, eta: u64) {
    env.events()
        .publish((symbol_short!("cfg_prop"),), (by.clone(), eta));
}

/// A queued governance action was cancelled before execution.
pub fn gov_cancelled(env: &Env, by: &Address) {
    env.events()
        .publish((symbol_short!("gov_cxl"),), by.clone());
}

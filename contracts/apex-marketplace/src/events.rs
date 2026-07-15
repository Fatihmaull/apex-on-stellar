//! Structured events for marketplace state changes.

use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};

pub fn init(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("init"),), admin.clone());
}

pub fn provider_registered(env: &Env, owner: &Address) {
    env.events()
        .publish((symbol_short!("prov_reg"), owner.clone()), ());
}

pub fn collateral_posted(env: &Env, owner: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("coll_post"), owner.clone()), amount);
}

pub fn provider_approved(env: &Env, owner: &Address, capacity_cu: i128) {
    env.events()
        .publish((symbol_short!("prov_ok"), owner.clone()), capacity_cu);
}

pub fn provider_slashed(env: &Env, owner: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("slash"), owner.clone()), amount);
}

pub fn coefficient_set(env: &Env, model: &Symbol, coeff: i128) {
    env.events()
        .publish((symbol_short!("coeff"),), (model.clone(), coeff));
}

pub fn series_created(env: &Env, series_id: u64, owner: &Address) {
    env.events()
        .publish((symbol_short!("series"), owner.clone()), series_id);
}

pub fn cu_minted(env: &Env, series_id: u64, to: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("mint"), to.clone()), (series_id, amount));
}

pub fn cu_burned(env: &Env, series_id: u64, from: &Address, amount: i128) {
    env.events()
        .publish((symbol_short!("burn"), from.clone()), (series_id, amount));
}

pub fn cu_transfer(env: &Env, series_id: u64, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("xfer"), from.clone()),
        (series_id, to.clone(), amount),
    );
}

pub fn ask_set(env: &Env, series_id: u64, price: i128) {
    env.events()
        .publish((symbol_short!("ask"),), (series_id, price));
}

pub fn cu_bought(env: &Env, buyer: &Address, series_id: u64, amount: i128, cost: i128) {
    env.events().publish(
        (symbol_short!("buy"), buyer.clone()),
        (series_id, amount, cost),
    );
}

pub fn cu_sold(env: &Env, seller: &Address, series_id: u64, amount: i128, proceeds: i128) {
    env.events().publish(
        (symbol_short!("sell"), seller.clone()),
        (series_id, amount, proceeds),
    );
}

pub fn cash_redeemed(env: &Env, holder: &Address, series_id: u64, amount: i128, usdc: i128) {
    env.events().publish(
        (symbol_short!("redeem"), holder.clone()),
        (series_id, amount, usdc),
    );
}

pub fn access_granted(
    env: &Env,
    voucher_id: &BytesN<32>,
    holder: &Address,
    series_id: u64,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("access"), holder.clone()),
        (voucher_id.clone(), series_id, amount),
    );
}

pub fn index_created(env: &Env, symbol: &Symbol) {
    env.events()
        .publish((symbol_short!("idx_new"),), symbol.clone());
}

pub fn index_updated(env: &Env, symbol: &Symbol, nav_factor: i128) {
    env.events()
        .publish((symbol_short!("idx_upd"),), (symbol.clone(), nav_factor));
}

pub fn index_bought(env: &Env, buyer: &Address, symbol: &Symbol, usdc: i128, shares: i128) {
    env.events().publish(
        (symbol_short!("idx_buy"), buyer.clone()),
        (symbol.clone(), usdc, shares),
    );
}

pub fn index_redeemed(env: &Env, holder: &Address, symbol: &Symbol, shares: i128, usdc: i128) {
    env.events().publish(
        (symbol_short!("idx_rdm"), holder.clone()),
        (symbol.clone(), shares, usdc),
    );
}

pub fn oracle(env: &Env, price: i128, ts: u64) {
    env.events()
        .publish((symbol_short!("oracle"),), (price, ts));
}

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

pub fn upgrade_proposed(env: &Env, by: &Address, eta: u64) {
    env.events()
        .publish((symbol_short!("up_prop"),), (by.clone(), eta));
}

pub fn config_proposed(env: &Env, by: &Address, eta: u64) {
    env.events()
        .publish((symbol_short!("cfg_prop"),), (by.clone(), eta));
}

pub fn gov_cancelled(env: &Env, by: &Address) {
    env.events()
        .publish((symbol_short!("gov_cxl"),), by.clone());
}

//! Synthetic NAV index vaults (CU-INDEX, CUNVDA).

use soroban_sdk::{panic_with_error, Address, Env, Symbol};

use crate::admin;
use crate::errors::Error;
use crate::events;
use crate::series::mul_div_floor;
use crate::settlement;
use crate::storage::{self, IndexPool, SCALE};

pub fn create_index(env: &Env, caller: &Address, symbol: Symbol, nav_factor: i128) {
    admin::require_admin(env, caller);
    if nav_factor <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    if storage::get_index(env, &symbol).is_some() {
        panic_with_error!(env, Error::InvalidParams);
    }
    let pool = IndexPool {
        symbol: symbol.clone(),
        nav_factor,
        usdc_balance: 0,
        total_shares: 0,
    };
    storage::set_index(env, &symbol, &pool);
    storage::push_index_symbol(env, &symbol);
    storage::extend_instance(env);
    events::index_created(env, &symbol);
}

/// NAV = ACPI × (nav_factor / SCALE). Synthetic cash vault — no CU custody.
pub fn get_index_nav(env: &Env, symbol: &Symbol) -> i128 {
    let pool = storage::get_index(env, symbol)
        .unwrap_or_else(|| panic_with_error!(env, Error::IndexNotFound));
    let acpi = settlement::get_fresh_cu_price(env);
    mul_div_floor(env, acpi, pool.nav_factor, SCALE)
}

pub fn buy_index(env: &Env, buyer: &Address, symbol: Symbol, usdc_amount: i128) {
    buyer.require_auth();
    admin::require_not_paused(env);
    if usdc_amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut pool = storage::get_index(env, &symbol)
        .unwrap_or_else(|| panic_with_error!(env, Error::IndexNotFound));

    let nav = get_index_nav(env, &symbol);
    if nav <= 0 {
        panic_with_error!(env, Error::StaleOracle);
    }
    // shares = usdc / nav
    let shares = mul_div_floor(env, usdc_amount, SCALE, nav);
    if shares <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }

    let usdc = storage::get_usdc_token(env);
    soroban_sdk::token::Client::new(env, &usdc).transfer(
        buyer,
        &env.current_contract_address(),
        &usdc_amount,
    );

    pool.usdc_balance += usdc_amount;
    pool.total_shares += shares;
    storage::set_index(env, &symbol, &pool);
    storage::set_index_pool_usdc(env, storage::get_index_pool_usdc(env) + usdc_amount);

    let held = storage::get_index_shares(env, &symbol, buyer);
    storage::set_index_shares(env, &symbol, buyer, held + shares);

    storage::extend_instance(env);
    events::index_bought(env, buyer, &symbol, usdc_amount, shares);
}

pub fn redeem_index(env: &Env, holder: &Address, symbol: Symbol, shares: i128) {
    holder.require_auth();
    if shares <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut pool = storage::get_index(env, &symbol)
        .unwrap_or_else(|| panic_with_error!(env, Error::IndexNotFound));
    let held = storage::get_index_shares(env, &symbol, holder);
    if held < shares {
        panic_with_error!(env, Error::InsufficientBalance);
    }

    let nav = get_index_nav(env, &symbol);
    let payout = mul_div_floor(env, shares, nav, SCALE);
    if payout > pool.usdc_balance {
        panic_with_error!(env, Error::InsufficientLiquidity);
    }

    pool.usdc_balance -= payout;
    pool.total_shares -= shares;
    storage::set_index(env, &symbol, &pool);
    storage::set_index_pool_usdc(env, storage::get_index_pool_usdc(env) - payout);
    storage::set_index_shares(env, &symbol, holder, held - shares);

    let usdc = storage::get_usdc_token(env);
    soroban_sdk::token::Client::new(env, &usdc).transfer(
        &env.current_contract_address(),
        holder,
        &payout,
    );

    storage::extend_instance(env);
    events::index_redeemed(env, holder, &symbol, shares, payout);
}

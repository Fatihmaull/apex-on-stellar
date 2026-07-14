//! Per-provider CU series lifecycle + fixed-ask spot trading.

use soroban_sdk::{panic_with_error, Address, BytesN, Env, Symbol};

use crate::admin;
use crate::cu_token;
use crate::errors::Error;
use crate::events;
use crate::normalization;
use crate::registry;
use crate::storage::{self, Series};

pub fn create_series(
    env: &Env,
    owner: &Address,
    gpu_model: Symbol,
    spec_hash: BytesN<32>,
    ask_price: i128,
) -> u64 {
    owner.require_auth();
    admin::require_not_paused(env);
    registry::require_approved(env, owner);
    if ask_price <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let coeff = normalization::get_coefficient(env, &gpu_model);
    let id = storage::next_series_id(env);
    let series = Series {
        provider: owner.clone(),
        gpu_model,
        coefficient: coeff,
        spec_hash,
        ask_price,
        active: true,
    };
    storage::set_series(env, id, &series);
    storage::push_series_id(env, id);
    storage::extend_instance(env);
    events::series_created(env, id, owner);
    id
}

pub fn set_ask(env: &Env, owner: &Address, series_id: u64, price: i128) {
    owner.require_auth();
    if price <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    if s.provider != *owner {
        panic_with_error!(env, Error::Unauthorized);
    }
    s.ask_price = price;
    storage::set_series(env, series_id, &s);
    events::ask_set(env, series_id, price);
}

/// Mint CU into the series inventory (contract-held sale inventory).
pub fn mint_cu(env: &Env, owner: &Address, series_id: u64, amount: i128) {
    owner.require_auth();
    admin::require_not_paused(env);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    if s.provider != *owner {
        panic_with_error!(env, Error::Unauthorized);
    }
    if !s.active {
        panic_with_error!(env, Error::SeriesInactive);
    }
    let mut p = registry::require_approved(env, owner);
    if p.minted_cu.checked_add(amount).unwrap_or(i128::MAX) > p.capacity_cu {
        panic_with_error!(env, Error::InsufficientCapacity);
    }
    p.minted_cu += amount;
    storage::set_provider(env, owner, &p);

    let inv = storage::get_inventory(env, series_id);
    storage::set_inventory(env, series_id, inv + amount);
    // Also mint ledger units to the contract address as inventory marker.
    let contract = env.current_contract_address();
    cu_token::mint(env, series_id, &contract, amount);
    storage::extend_instance(env);
}

/// Buyer swaps USDC → CU at the provider's fixed ask. CU moves from inventory to buyer.
pub fn buy_cu(env: &Env, buyer: &Address, series_id: u64, amount: i128, max_cost: i128) {
    buyer.require_auth();
    admin::require_not_paused(env);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    if !s.active {
        panic_with_error!(env, Error::SeriesInactive);
    }
    let inv = storage::get_inventory(env, series_id);
    if inv < amount {
        panic_with_error!(env, Error::InsufficientLiquidity);
    }

    let cost = mul_div_ceil(env, amount, s.ask_price, storage::SCALE);
    if max_cost > 0 && cost > max_cost {
        panic_with_error!(env, Error::SlippageExceeded);
    }

    let usdc = storage::get_usdc_token(env);
    let contract = env.current_contract_address();
    soroban_sdk::token::Client::new(env, &usdc).transfer(buyer, &contract, &cost);

    // Credit provider collateral as proceeds (provider can later be paid out).
    let mut p = storage::get_provider(env, &s.provider)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    p.collateral += cost;
    storage::set_provider(env, &s.provider, &p);
    storage::set_provider_collateral_total(
        env,
        storage::get_provider_collateral_total(env) + cost,
    );

    storage::set_inventory(env, series_id, inv - amount);
    // Transfer CU from contract inventory to buyer on the ledger.
    let cbal = storage::get_balance(env, series_id, &contract);
    if cbal < amount {
        panic_with_error!(env, Error::InsufficientBalance);
    }
    storage::set_balance(env, series_id, &contract, cbal - amount);
    let bbal = storage::get_balance(env, series_id, buyer);
    storage::set_balance(env, series_id, buyer, bbal + amount);

    storage::extend_instance(env);
    events::cu_bought(env, buyer, series_id, amount, cost);
}

/// Seller sells CU back to inventory at ask (MVP simplification: market maker = provider ask).
pub fn sell_cu(env: &Env, seller: &Address, series_id: u64, amount: i128, min_proceeds: i128) {
    seller.require_auth();
    admin::require_not_paused(env);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    if !s.active {
        panic_with_error!(env, Error::SeriesInactive);
    }
    let bal = storage::get_balance(env, series_id, seller);
    if bal < amount {
        panic_with_error!(env, Error::InsufficientBalance);
    }

    let proceeds = mul_div_floor(env, amount, s.ask_price, storage::SCALE);
    if min_proceeds > 0 && proceeds < min_proceeds {
        panic_with_error!(env, Error::SlippageExceeded);
    }

    let mut p = storage::get_provider(env, &s.provider)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    if p.collateral < proceeds {
        panic_with_error!(env, Error::InsufficientCollateral);
    }
    p.collateral -= proceeds;
    storage::set_provider(env, &s.provider, &p);
    storage::set_provider_collateral_total(
        env,
        storage::get_provider_collateral_total(env) - proceeds,
    );

    let usdc = storage::get_usdc_token(env);
    soroban_sdk::token::Client::new(env, &usdc).transfer(
        &env.current_contract_address(),
        seller,
        &proceeds,
    );

    storage::set_balance(env, series_id, seller, bal - amount);
    let contract = env.current_contract_address();
    let cbal = storage::get_balance(env, series_id, &contract);
    storage::set_balance(env, series_id, &contract, cbal + amount);
    storage::set_inventory(env, series_id, storage::get_inventory(env, series_id) + amount);

    storage::extend_instance(env);
    events::cu_sold(env, seller, series_id, amount, proceeds);
}

pub fn mul_div_floor(env: &Env, a: i128, b: i128, d: i128) -> i128 {
    a.checked_mul(b)
        .and_then(|x| x.checked_div(d))
        .unwrap_or_else(|| panic_with_error!(env, Error::MathOverflow))
}

pub fn mul_div_ceil(env: &Env, a: i128, b: i128, d: i128) -> i128 {
    let prod = a
        .checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::MathOverflow));
    let q = prod / d;
    if prod % d == 0 {
        q
    } else {
        q + 1
    }
}

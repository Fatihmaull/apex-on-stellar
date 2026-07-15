#![no_std]
//! # APEX Marketplace — tokenized compute (CU) spot + index vaults
//!
//! Multi-asset CU ledger, provider registry, fixed-ask spot, cash-settle
//! redemption, mock compute-access seam, and synthetic NAV index pools.
//! See `docs/cu-spec.md` and `docs/implementation-plan.md`.

#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, Symbol, Vec,
};

mod admin;
mod cu_token;
mod errors;
mod events;
mod index_pool;
mod normalization;
mod redemption;
mod registry;
mod series;
mod settlement;
mod storage;

#[cfg(test)]
mod test;

#[cfg(test)]
mod fuzz;

use errors::Error;
use storage::{Config, IndexPool, Provider, Series, SCALE};

/// Solvency accounting snapshot.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Buckets {
    pub provider_collateral_total: i128,
    pub index_pool_usdc: i128,
    pub escrow_usdc: i128,
    pub insurance_fund: i128,
    pub fee_vault: i128,
}

#[contract]
pub struct ApexMarketplaceContract;

fn panic_err(env: &Env, e: Error) -> ! {
    panic_with_error!(env, e);
}

#[contractimpl]
impl ApexMarketplaceContract {
    /// Deploy-time constructor.
    ///
    /// - `futures_oracle`: apex-futures address for ACPI cross-call (may be a
    ///   placeholder; local `update_cu_oracle` keeps prices fresh for tests).
    /// - `initial_cu_price`: seed ACPI (USDC per CU, 7 dp).
    pub fn __constructor(
        env: Env,
        admin: Address,
        verifier: Address,
        pauser: Address,
        usdc: Address,
        futures_oracle: Address,
        initial_cu_price: i128,
        config: Config,
        timelock_delay: u64,
    ) {
        if storage::is_initialized(&env) {
            panic_err(&env, Error::AlreadyInitialized);
        }
        if initial_cu_price <= 0 {
            panic_err(&env, Error::InvalidAmount);
        }
        admin::validate_config(&env, &config);

        storage::set_admin(&env, &admin);
        storage::set_verifier(&env, &verifier);
        storage::set_pauser(&env, &pauser);
        storage::set_usdc_token(&env, &usdc);
        storage::set_futures_oracle(&env, &futures_oracle);
        storage::set_config(&env, &config);
        storage::set_timelock_delay(&env, timelock_delay);
        storage::set_paused(&env, false);

        storage::set_oracle_price(&env, initial_cu_price);
        storage::set_oracle_ts(&env, env.ledger().timestamp());

        storage::set_provider_collateral_total(&env, 0);
        storage::set_index_pool_usdc(&env, 0);
        storage::set_escrow_usdc(&env, 0);
        storage::set_insurance_fund(&env, 0);
        storage::set_fee_vault(&env, 0);

        normalization::seed_defaults(&env);
        storage::extend_instance(&env);
        events::init(&env, &admin);
    }

    // --- Admin / pause / timelock ------------------------------------------

    pub fn pause(env: Env, caller: Address) {
        admin::pause(&env, &caller);
    }
    pub fn unpause(env: Env, caller: Address) {
        admin::unpause(&env, &caller);
    }
    pub fn transfer_admin(env: Env, caller: Address, new_admin: Address) {
        admin::transfer_admin(&env, &caller, &new_admin);
    }
    pub fn accept_admin(env: Env, caller: Address) {
        admin::accept_admin(&env, &caller);
    }
    pub fn set_pauser(env: Env, caller: Address, pauser: Address) {
        admin::set_pauser(&env, &caller, &pauser);
    }
    pub fn set_verifier(env: Env, caller: Address, verifier: Address) {
        admin::set_verifier(&env, &caller, &verifier);
    }
    pub fn set_futures_oracle(env: Env, caller: Address, futures: Address) {
        admin::set_futures_oracle(&env, &caller, &futures);
    }
    pub fn set_coefficient(env: Env, caller: Address, model: Symbol, coeff: i128) {
        normalization::set_coefficient(&env, &caller, model, coeff);
    }
    pub fn propose_config(env: Env, caller: Address, config: Config) {
        admin::propose_config(&env, &caller, &config);
    }
    pub fn execute_config(env: Env, caller: Address) {
        admin::execute_config(&env, &caller);
    }
    pub fn cancel_config(env: Env, caller: Address) {
        admin::cancel_config(&env, &caller);
    }
    pub fn propose_upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        admin::propose_upgrade(&env, &caller, new_wasm_hash);
    }
    pub fn execute_upgrade(env: Env, caller: Address) {
        admin::execute_upgrade(&env, &caller);
    }
    pub fn cancel_upgrade(env: Env, caller: Address) {
        admin::cancel_upgrade(&env, &caller);
    }

    pub fn update_cu_oracle(env: Env, caller: Address, price: i128) {
        settlement::update_cu_oracle(&env, &caller, price);
    }

    pub fn seed_insurance(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_err(&env, Error::InvalidAmount);
        }
        let usdc = storage::get_usdc_token(&env);
        soroban_sdk::token::Client::new(&env, &usdc).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        storage::set_insurance_fund(&env, storage::get_insurance_fund(&env) + amount);
        storage::extend_instance(&env);
        events::insurance_seed(&env, &from, amount);
    }

    // --- Provider lifecycle ------------------------------------------------

    pub fn register_provider(env: Env, owner: Address, metadata_hash: BytesN<32>) {
        registry::register_provider(&env, &owner, metadata_hash);
    }
    pub fn post_collateral(env: Env, owner: Address, amount: i128) {
        registry::post_collateral(&env, &owner, amount);
    }
    pub fn approve_provider(env: Env, verifier: Address, owner: Address, capacity_cu: i128) {
        registry::approve_provider(&env, &verifier, &owner, capacity_cu);
    }
    pub fn slash_provider(env: Env, caller: Address, owner: Address, amount: i128) {
        registry::slash_provider(&env, &caller, &owner, amount);
    }

    // --- Series + spot -----------------------------------------------------

    pub fn create_series(
        env: Env,
        owner: Address,
        gpu_model: Symbol,
        spec_hash: BytesN<32>,
        ask_price: i128,
    ) -> u64 {
        series::create_series(&env, &owner, gpu_model, spec_hash, ask_price)
    }
    pub fn set_ask(env: Env, owner: Address, series_id: u64, price: i128) {
        series::set_ask(&env, &owner, series_id, price);
    }
    pub fn mint_cu(env: Env, owner: Address, series_id: u64, amount: i128) {
        series::mint_cu(&env, &owner, series_id, amount);
    }
    pub fn buy_cu(env: Env, buyer: Address, series_id: u64, amount: i128, max_cost: i128) {
        series::buy_cu(&env, &buyer, series_id, amount, max_cost);
    }
    pub fn sell_cu(env: Env, seller: Address, series_id: u64, amount: i128, min_proceeds: i128) {
        series::sell_cu(&env, &seller, series_id, amount, min_proceeds);
    }
    pub fn transfer_cu(env: Env, series_id: u64, from: Address, to: Address, amount: i128) {
        cu_token::transfer(&env, series_id, &from, &to, amount);
    }

    // --- Redemption --------------------------------------------------------

    pub fn redeem_cu(env: Env, holder: Address, series_id: u64, amount: i128) {
        settlement::redeem_cu(&env, &holder, series_id, amount);
    }
    pub fn redeem_cu_for_access(
        env: Env,
        holder: Address,
        series_id: u64,
        amount: i128,
    ) -> BytesN<32> {
        redemption::redeem_cu_for_access(&env, &holder, series_id, amount)
    }

    // --- Index -------------------------------------------------------------

    pub fn create_index(env: Env, caller: Address, symbol: Symbol, nav_factor: i128) {
        index_pool::create_index(&env, &caller, symbol, nav_factor);
    }
    pub fn set_index_nav_factor(env: Env, caller: Address, symbol: Symbol, nav_factor: i128) {
        index_pool::set_index_nav_factor(&env, &caller, symbol, nav_factor);
    }
    pub fn buy_index(env: Env, buyer: Address, symbol: Symbol, usdc_amount: i128) {
        index_pool::buy_index(&env, &buyer, symbol, usdc_amount);
    }
    pub fn redeem_index(env: Env, holder: Address, symbol: Symbol, shares: i128) {
        index_pool::redeem_index(&env, &holder, symbol, shares);
    }
    pub fn get_index_nav(env: Env, symbol: Symbol) -> i128 {
        index_pool::get_index_nav(&env, &symbol)
    }

    // --- Reads -------------------------------------------------------------

    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }
    pub fn get_verifier(env: Env) -> Address {
        storage::get_verifier(&env)
    }
    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }
    pub fn get_config(env: Env) -> Config {
        storage::get_config(&env)
    }
    pub fn get_coefficient(env: Env, model: Symbol) -> i128 {
        normalization::get_coefficient(&env, &model)
    }
    pub fn get_provider(env: Env, owner: Address) -> Provider {
        storage::get_provider(&env, &owner)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ProviderNotFound))
    }
    pub fn get_series(env: Env, series_id: u64) -> Series {
        storage::get_series(&env, series_id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::SeriesNotFound))
    }
    pub fn list_series(env: Env) -> Vec<u64> {
        storage::get_series_ids(&env)
    }
    pub fn cu_balance(env: Env, series_id: u64, holder: Address) -> i128 {
        storage::get_balance(&env, series_id, &holder)
    }
    pub fn get_inventory(env: Env, series_id: u64) -> i128 {
        storage::get_inventory(&env, series_id)
    }
    pub fn get_index(env: Env, symbol: Symbol) -> IndexPool {
        storage::get_index(&env, &symbol)
            .unwrap_or_else(|| panic_with_error!(&env, Error::IndexNotFound))
    }
    pub fn index_shares(env: Env, symbol: Symbol, holder: Address) -> i128 {
        storage::get_index_shares(&env, &symbol, &holder)
    }
    pub fn get_oracle_price(env: Env) -> i128 {
        storage::get_oracle_price(&env)
    }
    pub fn get_buckets(env: Env) -> Buckets {
        Buckets {
            provider_collateral_total: storage::get_provider_collateral_total(&env),
            index_pool_usdc: storage::get_index_pool_usdc(&env),
            escrow_usdc: storage::get_escrow_usdc(&env),
            insurance_fund: storage::get_insurance_fund(&env),
            fee_vault: storage::get_fee_vault(&env),
        }
    }
    pub fn scale(_env: Env) -> i128 {
        SCALE
    }
}

//! Provider registration, collateral, approval, and slashing.

use soroban_sdk::{panic_with_error, Address, BytesN, Env};

use crate::admin;
use crate::errors::Error;
use crate::events;
use crate::storage::{self, Provider, ProviderStatus};

pub fn register_provider(env: &Env, owner: &Address, metadata_hash: BytesN<32>) {
    owner.require_auth();
    admin::require_not_paused(env);
    if storage::get_provider(env, owner).is_some() {
        panic_with_error!(env, Error::InvalidParams);
    }
    let p = Provider {
        owner: owner.clone(),
        status: ProviderStatus::Pending,
        collateral: 0,
        capacity_cu: 0,
        minted_cu: 0,
        metadata_hash,
    };
    storage::set_provider(env, owner, &p);
    storage::extend_instance(env);
    events::provider_registered(env, owner);
}

pub fn post_collateral(env: &Env, owner: &Address, amount: i128) {
    owner.require_auth();
    admin::require_not_paused(env);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut p = storage::get_provider(env, owner)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));

    let usdc = storage::get_usdc_token(env);
    soroban_sdk::token::Client::new(env, &usdc).transfer(
        owner,
        &env.current_contract_address(),
        &amount,
    );

    p.collateral += amount;
    storage::set_provider(env, owner, &p);
    storage::set_provider_collateral_total(
        env,
        storage::get_provider_collateral_total(env) + amount,
    );
    storage::extend_instance(env);
    events::collateral_posted(env, owner, amount);
}

pub fn approve_provider(env: &Env, verifier: &Address, owner: &Address, capacity_cu: i128) {
    admin::require_verifier(env, verifier);
    if capacity_cu <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut p = storage::get_provider(env, owner)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    p.status = ProviderStatus::Approved;
    p.capacity_cu = capacity_cu;
    storage::set_provider(env, owner, &p);
    storage::extend_instance(env);
    events::provider_approved(env, owner, capacity_cu);
}

pub fn slash_provider(env: &Env, caller: &Address, owner: &Address, amount: i128) {
    admin::require_admin(env, caller);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let mut p = storage::get_provider(env, owner)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    if p.collateral < amount {
        panic_with_error!(env, Error::InsufficientCollateral);
    }
    p.collateral -= amount;
    storage::set_provider(env, owner, &p);
    storage::set_provider_collateral_total(
        env,
        storage::get_provider_collateral_total(env) - amount,
    );
    storage::set_insurance_fund(env, storage::get_insurance_fund(env) + amount);
    storage::extend_instance(env);
    events::provider_slashed(env, owner, amount);
}

pub fn require_approved(env: &Env, owner: &Address) -> Provider {
    let p = storage::get_provider(env, owner)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    if p.status != ProviderStatus::Approved {
        panic_with_error!(env, Error::ProviderNotApproved);
    }
    p
}

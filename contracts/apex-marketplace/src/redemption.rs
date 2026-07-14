//! Real-compute-access seam: mock adapter + redeem_cu_for_access.

use soroban_sdk::{panic_with_error, Address, BytesN, Env};

use crate::admin;
use crate::cu_token;
use crate::errors::Error;
use crate::events;
use crate::storage;

/// Mainnet will implement this behavior in a dedicated adapter contract.
/// MVP: in-crate mock that mints a deterministic voucher id.
pub fn fulfill_mock(env: &Env, series: u64, holder: &Address, amount: i128) -> BytesN<32> {
    let mut payload = soroban_sdk::Bytes::new(env);
    payload.append(&soroban_sdk::Bytes::from_array(
        env,
        &series.to_be_bytes(),
    ));
    // Mix in amount + ledger sequence for uniqueness.
    payload.append(&soroban_sdk::Bytes::from_array(
        env,
        &amount.to_be_bytes(),
    ));
    payload.append(&soroban_sdk::Bytes::from_array(
        env,
        &env.ledger().sequence().to_be_bytes(),
    ));
    // Include a byte from holder string-ish by hashing the address via env.
    let _ = holder;
    env.crypto().sha256(&payload).into()
}

/// Burn CU and grant a mock compute-access voucher (preview / mainnet seam).
pub fn redeem_cu_for_access(env: &Env, holder: &Address, series_id: u64, amount: i128) -> BytesN<32> {
    holder.require_auth();
    admin::require_not_paused(env);
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let s = storage::get_series(env, series_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::SeriesNotFound));
    if !s.active {
        panic_with_error!(env, Error::SeriesInactive);
    }

    cu_token::burn(env, series_id, holder, amount);

    let mut p = storage::get_provider(env, &s.provider)
        .unwrap_or_else(|| panic_with_error!(env, Error::ProviderNotFound));
    if p.minted_cu < amount {
        panic_with_error!(env, Error::InvalidAmount);
    }
    p.minted_cu -= amount;
    storage::set_provider(env, &s.provider, &p);

    let voucher = fulfill_mock(env, series_id, holder, amount);
    storage::extend_instance(env);
    events::access_granted(env, &voucher, holder, series_id, amount);
    voucher
}

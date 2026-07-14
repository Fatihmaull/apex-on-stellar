//! Multi-asset CU ledger (ERC-1155-style).

use soroban_sdk::{panic_with_error, Address, Env};

use crate::errors::Error;
use crate::events;
use crate::storage;

#[allow(dead_code)]
pub fn balance(env: &Env, series: u64, holder: &Address) -> i128 {
    storage::get_balance(env, series, holder)
}

pub fn mint(env: &Env, series: u64, to: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let bal = storage::get_balance(env, series, to);
    storage::set_balance(
        env,
        series,
        to,
        bal.checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, Error::MathOverflow)),
    );
    events::cu_minted(env, series, to, amount);
}

pub fn burn(env: &Env, series: u64, from: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let bal = storage::get_balance(env, series, from);
    if bal < amount {
        panic_with_error!(env, Error::InsufficientBalance);
    }
    storage::set_balance(env, series, from, bal - amount);
    events::cu_burned(env, series, from, amount);
}

pub fn transfer(env: &Env, series: u64, from: &Address, to: &Address, amount: i128) {
    from.require_auth();
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    let bal = storage::get_balance(env, series, from);
    if bal < amount {
        panic_with_error!(env, Error::InsufficientBalance);
    }
    storage::set_balance(env, series, from, bal - amount);
    let to_bal = storage::get_balance(env, series, to);
    storage::set_balance(
        env,
        series,
        to,
        to_bal
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, Error::MathOverflow)),
    );
    events::cu_transfer(env, series, from, to, amount);
}

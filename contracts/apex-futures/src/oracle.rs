use soroban_sdk::{Address, Env};
use crate::storage::{get_oracle_price, set_oracle_price, get_oracle_updater};


/// Permissioned endpoint for injecting GRC-validated APAC GPU Index prices.
/// - Requires signature auth from the registered Oracle updater.
/// - `price` is scaled by 10^7 (7 decimals).
pub fn update_price(env: &Env, updater: &Address, new_price: i128) {
    updater.require_auth();
    
    let authorized_updater = get_oracle_updater(env).expect("oracle updater not initialized");
    assert!(updater == &authorized_updater, "unauthorized oracle updater");
    assert!(new_price > 0, "price must be positive");

    set_oracle_price(env, new_price);
}

/// Retrieve the current oracle price
pub fn get_price(env: &Env) -> i128 {
    get_oracle_price(env)
}

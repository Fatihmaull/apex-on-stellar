use soroban_sdk::{contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Instance storage
    Admin,
    UsdcToken,
    VammBaseReserve,  // x (in 7 decimals)
    VammQuoteReserve, // y (in 7 decimals)
    OraclePrice,      // spot price of base asset in terms of USDC (7 decimals)
    OracleUpdater,    // Address authorized to update the oracle
    InitMarginRatio,  // scaled by 10000 (e.g., 2000 = 20% = 5x max leverage)
    MaintMarginRatio, // maintenance margin ratio scaled by 10000 (e.g., 1000 = 10% = 10x max leverage)

    // Persistent storage
    MarginAccount(Address), // User's free collateral (USDC in 7 decimals)
    Position(Address),      // User's active futures position
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Position {
    pub size: i128,              // Virtual compute units (positive = long, negative = short, 7 decimals)
    pub entry_price: i128,       // Virtual price at entry (USDC per compute unit, 7 decimals)
    pub margin_allocated: i128,  // Collateral locked for this position (USDC, 7 decimals)
}

// Storage Helpers
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_usdc_token(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::UsdcToken)
}

pub fn set_usdc_token(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, token);
}

pub fn get_vamm_reserves(env: &Env) -> (i128, i128) {
    let base: i128 = env.storage().instance().get(&DataKey::VammBaseReserve).unwrap_or(0);
    let quote: i128 = env.storage().instance().get(&DataKey::VammQuoteReserve).unwrap_or(0);
    (base, quote)
}

pub fn set_vamm_reserves(env: &Env, base: i128, quote: i128) {
    env.storage().instance().set(&DataKey::VammBaseReserve, &base);
    env.storage().instance().set(&DataKey::VammQuoteReserve, &quote);
}

pub fn get_oracle_price(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::OraclePrice).unwrap_or(0)
}

pub fn set_oracle_price(env: &Env, price: i128) {
    env.storage().instance().set(&DataKey::OraclePrice, &price);
}

pub fn get_oracle_updater(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::OracleUpdater)
}

pub fn set_oracle_updater(env: &Env, updater: &Address) {
    env.storage().instance().set(&DataKey::OracleUpdater, updater);
}

pub fn get_margin_ratios(env: &Env) -> (i128, i128) {
    // Defaults: initial margin = 20% (5x leverage), maintenance = 10% (10x leverage)
    let init: i128 = env.storage().instance().get(&DataKey::InitMarginRatio).unwrap_or(2000);
    let maint: i128 = env.storage().instance().get(&DataKey::MaintMarginRatio).unwrap_or(1000);
    (init, maint)
}

pub fn set_margin_ratios(env: &Env, init: i128, maint: i128) {
    env.storage().instance().set(&DataKey::InitMarginRatio, &init);
    env.storage().instance().set(&DataKey::MaintMarginRatio, &maint);
}

pub fn get_margin_account(env: &Env, user: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::MarginAccount(user.clone())).unwrap_or(0)
}

pub fn set_margin_account(env: &Env, user: &Address, balance: i128) {
    env.storage().persistent().set(&DataKey::MarginAccount(user.clone()), &balance);
}

pub fn get_position(env: &Env, user: &Address) -> Position {
    env.storage().persistent().get(&DataKey::Position(user.clone())).unwrap_or(Position {
        size: 0,
        entry_price: 0,
        margin_allocated: 0,
    })
}

pub fn set_position(env: &Env, user: &Address, position: &Position) {
    env.storage().persistent().set(&DataKey::Position(user.clone()), position);
}

pub fn remove_position(env: &Env, user: &Address) {
    env.storage().persistent().remove(&DataKey::Position(user.clone()));
}

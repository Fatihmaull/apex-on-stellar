use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, Vec};

pub const SCALE: i128 = 10_000_000;
pub const BPS_DENOM: i128 = 10_000;

const DAY_IN_LEDGERS: u32 = 17_280;
pub const INSTANCE_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
pub const INSTANCE_BUMP: u32 = DAY_IN_LEDGERS * 60;
pub const PERSISTENT_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
pub const PERSISTENT_BUMP: u32 = DAY_IN_LEDGERS * 60;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Roles & config
    Admin,
    PendingAdmin,
    Pauser,
    Verifier,
    UsdcToken,
    FuturesOracle,
    Paused,
    Config,
    TimelockDelay,
    PendingUpgrade,
    PendingConfig,

    // Oracle (local CU price; optionally synced from futures)
    OraclePrice,
    OracleTs,

    // Solvency buckets
    ProviderCollateralTotal,
    IndexPoolUsdc,
    EscrowUsdc,
    InsuranceFund,
    FeeVault,

    // Counters
    NextSeriesId,
    SeriesIds,
    IndexSymbols,

    // Normalization: GPU model → coefficient
    Coefficient(Symbol),

    // Registry
    Provider(Address),

    // Series metadata
    Series(u64),

    // Multi-asset ledger: balance of (series, holder)
    Balance(u64, Address),
    // Provider inventory escrowed for sale (unsold minted CU sitting in contract inventory)
    Inventory(u64),

    // Index vault
    Index(Symbol),
    IndexShares(Symbol, Address),
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum ProviderStatus {
    Pending = 0,
    Approved = 1,
    Suspended = 2,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Provider {
    pub owner: Address,
    pub status: ProviderStatus,
    pub collateral: i128,
    pub capacity_cu: i128,
    pub minted_cu: i128,
    pub metadata_hash: BytesN<32>,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Series {
    pub provider: Address,
    pub gpu_model: Symbol,
    pub coefficient: i128,
    pub spec_hash: BytesN<32>,
    pub ask_price: i128,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct IndexPool {
    pub symbol: Symbol,
    /// Nav price override multiplier vs ACPI (SCALE = 1.0). MVP uses ACPI directly.
    pub nav_factor: i128,
    pub usdc_balance: i128,
    pub total_shares: i128,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Config {
    /// Seconds after which CU oracle is stale for settlement.
    pub oracle_staleness: u64,
    /// Settlement fee on cash redeem, in bps.
    pub settlement_fee_bps: i128,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PendingUpgrade {
    pub wasm_hash: BytesN<32>,
    pub eta: u64,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PendingConfig {
    pub config: Config,
    pub eta: u64,
}

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn extend_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

// --- Config / timelock -----------------------------------------------------

pub fn get_config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}
pub fn set_config(env: &Env, cfg: &Config) {
    env.storage().instance().set(&DataKey::Config, cfg);
}

pub fn get_timelock_delay(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::TimelockDelay)
        .unwrap_or(0)
}
pub fn set_timelock_delay(env: &Env, secs: u64) {
    env.storage().instance().set(&DataKey::TimelockDelay, &secs);
}

pub fn get_pending_upgrade(env: &Env) -> Option<PendingUpgrade> {
    env.storage().instance().get(&DataKey::PendingUpgrade)
}
pub fn set_pending_upgrade(env: &Env, p: &PendingUpgrade) {
    env.storage().instance().set(&DataKey::PendingUpgrade, p);
}
pub fn clear_pending_upgrade(env: &Env) {
    env.storage().instance().remove(&DataKey::PendingUpgrade);
}

pub fn get_pending_config(env: &Env) -> Option<PendingConfig> {
    env.storage().instance().get(&DataKey::PendingConfig)
}
pub fn set_pending_config(env: &Env, p: &PendingConfig) {
    env.storage().instance().set(&DataKey::PendingConfig, p);
}
pub fn clear_pending_config(env: &Env) {
    env.storage().instance().remove(&DataKey::PendingConfig);
}

// --- Roles -----------------------------------------------------------------

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}
pub fn get_pending_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}
pub fn set_pending_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::PendingAdmin, admin);
}
pub fn clear_pending_admin(env: &Env) {
    env.storage().instance().remove(&DataKey::PendingAdmin);
}
pub fn get_pauser(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Pauser).unwrap()
}
pub fn set_pauser(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::Pauser, addr);
}
pub fn get_verifier(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Verifier).unwrap()
}
pub fn set_verifier(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::Verifier, addr);
}
pub fn get_usdc_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::UsdcToken).unwrap()
}
pub fn set_usdc_token(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, addr);
}
pub fn get_futures_oracle(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::FuturesOracle)
        .unwrap()
}
pub fn set_futures_oracle(env: &Env, addr: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::FuturesOracle, addr);
}

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

// --- Oracle ----------------------------------------------------------------

pub fn get_oracle_price(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::OraclePrice)
        .unwrap_or(0)
}
pub fn set_oracle_price(env: &Env, price: i128) {
    env.storage().instance().set(&DataKey::OraclePrice, &price);
}
pub fn get_oracle_ts(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::OracleTs)
        .unwrap_or(0)
}
pub fn set_oracle_ts(env: &Env, ts: u64) {
    env.storage().instance().set(&DataKey::OracleTs, &ts);
}

// --- Buckets ---------------------------------------------------------------

pub fn get_provider_collateral_total(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::ProviderCollateralTotal)
        .unwrap_or(0)
}
pub fn set_provider_collateral_total(env: &Env, v: i128) {
    env.storage()
        .instance()
        .set(&DataKey::ProviderCollateralTotal, &v);
}
pub fn get_index_pool_usdc(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::IndexPoolUsdc)
        .unwrap_or(0)
}
pub fn set_index_pool_usdc(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::IndexPoolUsdc, &v);
}
pub fn get_escrow_usdc(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::EscrowUsdc)
        .unwrap_or(0)
}
pub fn set_escrow_usdc(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::EscrowUsdc, &v);
}
pub fn get_insurance_fund(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::InsuranceFund)
        .unwrap_or(0)
}
pub fn set_insurance_fund(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::InsuranceFund, &v);
}
pub fn get_fee_vault(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::FeeVault)
        .unwrap_or(0)
}
pub fn set_fee_vault(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::FeeVault, &v);
}

// --- Series ids ------------------------------------------------------------

pub fn next_series_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextSeriesId)
        .unwrap_or(1);
    env.storage()
        .instance()
        .set(&DataKey::NextSeriesId, &(id + 1));
    id
}

pub fn get_series_ids(env: &Env) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&DataKey::SeriesIds)
        .unwrap_or_else(|| Vec::new(env))
}
pub fn push_series_id(env: &Env, id: u64) {
    let mut ids = get_series_ids(env);
    ids.push_back(id);
    env.storage().instance().set(&DataKey::SeriesIds, &ids);
}

pub fn get_index_symbols(env: &Env) -> Vec<Symbol> {
    env.storage()
        .instance()
        .get(&DataKey::IndexSymbols)
        .unwrap_or_else(|| Vec::new(env))
}
pub fn push_index_symbol(env: &Env, sym: &Symbol) {
    let mut syms = get_index_symbols(env);
    syms.push_back(sym.clone());
    env.storage()
        .instance()
        .set(&DataKey::IndexSymbols, &syms);
}

// --- Coefficient -----------------------------------------------------------

pub fn get_coefficient(env: &Env, model: &Symbol) -> Option<i128> {
    env.storage()
        .instance()
        .get(&DataKey::Coefficient(model.clone()))
}
pub fn set_coefficient(env: &Env, model: &Symbol, coeff: i128) {
    env.storage()
        .instance()
        .set(&DataKey::Coefficient(model.clone()), &coeff);
}

// --- Provider --------------------------------------------------------------

pub fn get_provider(env: &Env, owner: &Address) -> Option<Provider> {
    let key = DataKey::Provider(owner.clone());
    let p = env.storage().persistent().get(&key);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    p
}
pub fn set_provider(env: &Env, owner: &Address, provider: &Provider) {
    let key = DataKey::Provider(owner.clone());
    env.storage().persistent().set(&key, provider);
    extend_persistent(env, &key);
}

// --- Series ----------------------------------------------------------------

pub fn get_series(env: &Env, id: u64) -> Option<Series> {
    let key = DataKey::Series(id);
    let s = env.storage().persistent().get(&key);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    s
}
pub fn set_series(env: &Env, id: u64, series: &Series) {
    let key = DataKey::Series(id);
    env.storage().persistent().set(&key, series);
    extend_persistent(env, &key);
}

// --- Balances / inventory --------------------------------------------------

pub fn get_balance(env: &Env, series: u64, holder: &Address) -> i128 {
    let key = DataKey::Balance(series, holder.clone());
    let bal = env.storage().persistent().get(&key).unwrap_or(0);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    bal
}
pub fn set_balance(env: &Env, series: u64, holder: &Address, amount: i128) {
    let key = DataKey::Balance(series, holder.clone());
    env.storage().persistent().set(&key, &amount);
    extend_persistent(env, &key);
}

pub fn get_inventory(env: &Env, series: u64) -> i128 {
    let key = DataKey::Inventory(series);
    let bal = env.storage().persistent().get(&key).unwrap_or(0);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    bal
}
pub fn set_inventory(env: &Env, series: u64, amount: i128) {
    let key = DataKey::Inventory(series);
    env.storage().persistent().set(&key, &amount);
    extend_persistent(env, &key);
}

// --- Index -----------------------------------------------------------------

pub fn get_index(env: &Env, symbol: &Symbol) -> Option<IndexPool> {
    let key = DataKey::Index(symbol.clone());
    let idx = env.storage().persistent().get(&key);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    idx
}
pub fn set_index(env: &Env, symbol: &Symbol, pool: &IndexPool) {
    let key = DataKey::Index(symbol.clone());
    env.storage().persistent().set(&key, pool);
    extend_persistent(env, &key);
}

pub fn get_index_shares(env: &Env, symbol: &Symbol, holder: &Address) -> i128 {
    let key = DataKey::IndexShares(symbol.clone(), holder.clone());
    let bal = env.storage().persistent().get(&key).unwrap_or(0);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    bal
}
pub fn set_index_shares(env: &Env, symbol: &Symbol, holder: &Address, amount: i128) {
    let key = DataKey::IndexShares(symbol.clone(), holder.clone());
    env.storage().persistent().set(&key, &amount);
    extend_persistent(env, &key);
}

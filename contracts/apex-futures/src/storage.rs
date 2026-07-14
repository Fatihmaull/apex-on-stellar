use soroban_sdk::{contracttype, Address, BytesN, Env, Vec};

// --- Global scaling constants ---------------------------------------------

/// Fixed-point scale: 7 decimals, matching USDC's precision on Stellar.
/// Soroban has no floating point, so every price/size/balance is an integer
/// scaled by this factor (e.g. 5.0 USDC == 50_000_000).
pub const SCALE: i128 = 10_000_000;

/// Basis-point denominator (100% == 10_000 bps).
pub const BPS_DENOM: i128 = 10_000;

// --- Storage TTL management -----------------------------------------------
// Entries must have their rent periodically extended or they are archived.
// ~5s ledger close time => 17_280 ledgers/day. We keep live entries alive for
// ~60 days and bump whenever they fall under a ~30 day threshold.
const DAY_IN_LEDGERS: u32 = 17_280;
pub const INSTANCE_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
pub const INSTANCE_BUMP: u32 = DAY_IN_LEDGERS * 60;
pub const PERSISTENT_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
pub const PERSISTENT_BUMP: u32 = DAY_IN_LEDGERS * 60;

/// Keyspace for all contract state. Instance keys hold small, globally-shared
/// config/market state; per-user keys live in persistent storage.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // --- Instance: roles & config ---
    Admin,          // Address with full administrative authority
    PendingAdmin,   // Address for the 2-step admin handover
    Pauser,         // Address allowed to trip the circuit breaker
    FeeCollector,   // Address permitted to sweep the fee vault
    UsdcToken,      // USDC Stellar Asset Contract (SAC) address
    OracleUpdater,  // Address permitted to push index prices
    Paused,         // bool circuit-breaker flag
    Config,         // Risk & fee parameters (Config struct)
    TimelockDelay,  // seconds a governance action must wait before execution (u64)
    PendingUpgrade, // queued WASM upgrade awaiting its timelock (PendingUpgrade)
    PendingConfig,  // queued config change awaiting its timelock (PendingConfig)
    TwapWindow,     // seconds of TWAP smoothing applied to the risk price; 0 = off (u64)

    // --- Instance: vAMM & oracle market state ---
    VammBase,      // x: virtual base reserve (compute units, 7 dp)
    VammQuote,     // y: virtual quote reserve (USDC, 7 dp)
    OraclePrice,   // last GRC index price (USDC per base unit, 7 dp)
    OracleTs,      // ledger timestamp of the last oracle update (u64)
    PriceHistory,  // bounded ring of recent index observations (Vec<PricePoint>)
    CumFunding,    // cumulative funding index (USDC per base unit, 7 dp, signed)
    LastFundingTs, // ledger timestamp of the last funding settlement (u64)

    // --- Instance: solvency accounting buckets ---
    TotalCollateral, // Σ user (free + allocated) margin claims
    FeeVault,        // accrued protocol trading + funding-cut fees
    InsuranceFund,   // backstop for trader PnL & bad debt

    // --- Persistent: per-user ---
    Margin(Address),   // free (withdrawable/unlocked) USDC collateral
    Position(Address), // open futures position
}

/// A user's open futures position. One per account (enforced on open).
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Position {
    /// Signed size in virtual base units (positive = long, negative = short).
    pub size: i128,
    /// vAMM entry price (USDC per base unit, 7 dp).
    pub entry_price: i128,
    /// Collateral locked against this position (USDC, 7 dp).
    pub margin_allocated: i128,
    /// Snapshot of `CumFunding` at entry, used to compute funding owed.
    pub entry_funding: i128,
}

impl Position {
    pub fn empty() -> Self {
        Position {
            size: 0,
            entry_price: 0,
            margin_allocated: 0,
            entry_funding: 0,
        }
    }
}

/// Risk, fee and oracle parameters. Grouped into one instance entry so a single
/// read loads the whole market configuration.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct Config {
    /// Initial margin ratio in bps (e.g. 2000 = 20% => 5x max leverage).
    pub init_margin_bps: i128,
    /// Maintenance margin ratio in bps (e.g. 1000 = 10% liquidation threshold).
    pub maint_margin_bps: i128,
    /// Trading fee in bps charged on open & close notional (e.g. 10 = 0.1%).
    pub trading_fee_bps: i128,
    /// Liquidation penalty in bps of the liquidated equity (e.g. 500 = 5%).
    pub liq_penalty_bps: i128,
    /// Share of the penalty paid to the liquidator in bps (e.g. 5000 = 50%).
    pub liq_reward_bps: i128,
    /// Minimum seconds between funding settlements.
    pub funding_interval: u64,
    /// Protocol's administrative cut of funding paid, in bps (e.g. 1000 = 10%).
    pub funding_admin_cut_bps: i128,
    /// Cap on the per-settlement premium used for funding, in bps of index.
    pub max_funding_bps: i128,
    /// Max allowed oracle move vs. previous price, in bps (anti-manipulation).
    pub oracle_max_deviation_bps: i128,
    /// Seconds after which an oracle price is considered stale for risk checks.
    pub oracle_staleness: u64,
    /// Minimum position size in base units (7 dp).
    pub min_position_size: i128,
}

/// One index observation, retained so the risk price can be time-weighted.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PricePoint {
    /// Index price at `ts` (USDC per base unit, 7 dp).
    pub price: i128,
    /// Ledger timestamp the price was published.
    pub ts: u64,
}

/// Observations retained for the TWAP. Bounded so the instance entry stays small
/// and `update_oracle` keeps a constant cost.
pub const MAX_PRICE_POINTS: u32 = 24;

/// A WASM upgrade queued behind the governance timelock.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PendingUpgrade {
    pub wasm_hash: BytesN<32>,
    /// Earliest ledger timestamp at which the upgrade may be executed.
    pub eta: u64,
}

/// A config change queued behind the governance timelock.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct PendingConfig {
    pub config: Config,
    /// Earliest ledger timestamp at which the change may be executed.
    pub eta: u64,
}

// --- TTL helpers -----------------------------------------------------------

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

// --- Config ----------------------------------------------------------------

pub fn get_config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

pub fn set_config(env: &Env, cfg: &Config) {
    env.storage().instance().set(&DataKey::Config, cfg);
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

// --- Governance timelock ---------------------------------------------------

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
pub fn get_fee_collector(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::FeeCollector)
        .unwrap()
}
pub fn set_fee_collector(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::FeeCollector, addr);
}
pub fn get_oracle_updater(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::OracleUpdater)
        .unwrap()
}
pub fn set_oracle_updater(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::OracleUpdater, addr);
}
pub fn get_usdc_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::UsdcToken).unwrap()
}
pub fn set_usdc_token(env: &Env, addr: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, addr);
}

// --- Pause -----------------------------------------------------------------

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

// --- vAMM reserves ---------------------------------------------------------

pub fn get_reserves(env: &Env) -> (i128, i128) {
    let base = env
        .storage()
        .instance()
        .get(&DataKey::VammBase)
        .unwrap_or(0);
    let quote = env
        .storage()
        .instance()
        .get(&DataKey::VammQuote)
        .unwrap_or(0);
    (base, quote)
}
pub fn set_reserves(env: &Env, base: i128, quote: i128) {
    env.storage().instance().set(&DataKey::VammBase, &base);
    env.storage().instance().set(&DataKey::VammQuote, &quote);
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

// --- TWAP ------------------------------------------------------------------
// Both keys default when absent, so a contract upgraded in place (whose storage
// predates them) keeps behaving exactly as before until TWAP is switched on.

/// Seconds of smoothing applied to the risk price. `0` disables TWAP entirely
/// and the risk engine reads the latest index, as it did before.
pub fn get_twap_window(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::TwapWindow)
        .unwrap_or(0)
}
pub fn set_twap_window(env: &Env, secs: u64) {
    env.storage().instance().set(&DataKey::TwapWindow, &secs);
}

pub fn get_price_history(env: &Env) -> Vec<PricePoint> {
    env.storage()
        .instance()
        .get(&DataKey::PriceHistory)
        .unwrap_or_else(|| Vec::new(env))
}

/// Append an observation, evicting the oldest once `MAX_PRICE_POINTS` is reached.
/// Repeated updates inside the same ledger second overwrite the last point rather
/// than filling the ring with zero-duration entries.
pub fn push_price_point(env: &Env, price: i128, ts: u64) {
    let mut hist = get_price_history(env);
    let len = hist.len();
    if len > 0 {
        let last = hist.get(len - 1).unwrap();
        if last.ts == ts {
            hist.set(len - 1, PricePoint { price, ts });
            env.storage().instance().set(&DataKey::PriceHistory, &hist);
            return;
        }
    }
    hist.push_back(PricePoint { price, ts });
    while hist.len() > MAX_PRICE_POINTS {
        hist.remove(0);
    }
    env.storage().instance().set(&DataKey::PriceHistory, &hist);
}

// --- Funding ---------------------------------------------------------------

pub fn get_cum_funding(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::CumFunding)
        .unwrap_or(0)
}
pub fn set_cum_funding(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::CumFunding, &v);
}
pub fn get_last_funding_ts(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::LastFundingTs)
        .unwrap_or(0)
}
pub fn set_last_funding_ts(env: &Env, ts: u64) {
    env.storage().instance().set(&DataKey::LastFundingTs, &ts);
}

// --- Solvency buckets ------------------------------------------------------

pub fn get_total_collateral(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalCollateral)
        .unwrap_or(0)
}
pub fn set_total_collateral(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::TotalCollateral, &v);
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
pub fn get_insurance_fund(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::InsuranceFund)
        .unwrap_or(0)
}
pub fn set_insurance_fund(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::InsuranceFund, &v);
}

// --- Per-user margin & positions ------------------------------------------

pub fn get_margin(env: &Env, user: &Address) -> i128 {
    let key = DataKey::Margin(user.clone());
    let bal = env.storage().persistent().get(&key).unwrap_or(0);
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    bal
}
pub fn set_margin(env: &Env, user: &Address, balance: i128) {
    let key = DataKey::Margin(user.clone());
    env.storage().persistent().set(&key, &balance);
    extend_persistent(env, &key);
}

pub fn get_position(env: &Env, user: &Address) -> Position {
    let key = DataKey::Position(user.clone());
    let pos = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Position::empty());
    if env.storage().persistent().has(&key) {
        extend_persistent(env, &key);
    }
    pos
}
pub fn set_position(env: &Env, user: &Address, position: &Position) {
    let key = DataKey::Position(user.clone());
    env.storage().persistent().set(&key, position);
    extend_persistent(env, &key);
}
pub fn remove_position(env: &Env, user: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Position(user.clone()));
}

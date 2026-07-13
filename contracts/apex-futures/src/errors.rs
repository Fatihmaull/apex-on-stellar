use soroban_sdk::contracterror;

/// Canonical error set for the APEX futures contract.
///
/// Using an explicit `#[contracterror]` enum (instead of `assert!`/`panic!`) gives
/// callers stable, machine-readable error codes and keeps failures auditable both
/// on-chain and in the frontend. Every guard in the contract maps to one of these.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Constructor/initialize invoked on an already-configured instance.
    AlreadyInitialized = 1,
    /// Operation attempted before the contract was initialized.
    NotInitialized = 2,
    /// Caller is not authorized for a privileged action (RBAC violation).
    Unauthorized = 3,
    /// Contract is paused by the circuit breaker; state-growing actions blocked.
    Paused = 4,
    /// A supplied amount/size was zero or negative where positivity is required.
    InvalidAmount = 5,
    /// A configuration/parameter value is out of its allowed bounds.
    InvalidParams = 6,
    /// Position equity/free margin is below the required initial margin.
    InsufficientMargin = 7,
    /// User does not have enough *free* (unlocked) margin for the action.
    InsufficientFreeMargin = 8,
    /// User already holds an open position; only one position per account.
    PositionExists = 9,
    /// No open position exists for the target action.
    NoPosition = 10,
    /// vAMM does not have enough virtual base liquidity to fill the trade.
    InsufficientLiquidity = 11,
    /// Executed price crossed the caller-supplied slippage bound.
    SlippageExceeded = 12,
    /// Target position is healthy (health factor >= 1.0); cannot be liquidated.
    NotLiquidatable = 13,
    /// Oracle price is older than the configured staleness window.
    StaleOracle = 14,
    /// Proposed oracle update deviates beyond the allowed band vs. the last price.
    OracleDeviationTooHigh = 15,
    /// Fixed-point arithmetic overflowed i128 bounds.
    MathOverflow = 16,
    /// Requested position size is below the configured minimum.
    BelowMinPositionSize = 17,
    /// Funding settlement called before the funding interval elapsed.
    FundingTooEarly = 18,
    /// A timelocked governance action was executed before its delay elapsed.
    TimelockNotReady = 19,
    /// No pending timelocked governance action to execute or cancel.
    NothingPending = 20,
}

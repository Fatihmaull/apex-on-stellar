use soroban_sdk::contracterror;

/// Stable error codes for the APEX marketplace contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvalidParams = 6,
    InsufficientBalance = 7,
    InsufficientCollateral = 8,
    InsufficientCapacity = 9,
    ProviderNotApproved = 10,
    ProviderNotFound = 11,
    SeriesNotFound = 12,
    SeriesInactive = 13,
    SlippageExceeded = 14,
    StaleOracle = 15,
    MathOverflow = 16,
    TimelockNotReady = 17,
    NothingPending = 18,
    IndexNotFound = 19,
    UnknownGpuModel = 20,
    InsufficientLiquidity = 21,
}

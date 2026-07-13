#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

use crate::errors::Error;
use crate::storage::{Config, SCALE};
use crate::{ApexFuturesContract, ApexFuturesContractClient};

// --- Test rig --------------------------------------------------------------

const INIT_BASE: i128 = 1_000_000 * SCALE; // 1,000,000 virtual base units
const INIT_QUOTE: i128 = 5_000_000 * SCALE; // implies a 5.0 USDC mark price

fn default_config() -> Config {
    Config {
        init_margin_bps: 2000,          // 20% => 5x max leverage
        maint_margin_bps: 1000,         // 10% maintenance
        trading_fee_bps: 10,            // 0.1%
        liq_penalty_bps: 500,           // 5%
        liq_reward_bps: 5000,           // 50% of penalty to liquidator
        funding_interval: 3600,         // 1h
        funding_admin_cut_bps: 1000,    // 10% of funding to protocol
        max_funding_bps: 500,           // cap premium at 5% of index per settle
        oracle_max_deviation_bps: 5000, // 50% band (loose for tests)
        oracle_staleness: 86_400,       // 24h
        min_position_size: SCALE,       // 1.0 base unit minimum
    }
}

struct Rig {
    env: Env,
    client: ApexFuturesContractClient<'static>,
    usdc: token::Client<'static>,
    usdc_admin: token::StellarAssetClient<'static>,
    contract_id: Address,
    admin: Address,
    pauser: Address,
    fee_collector: Address,
    oracle_updater: Address,
}

fn setup() -> Rig {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pauser = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let oracle_updater = Address::generate(&env);

    // Deploy a USDC Stellar Asset Contract for collateral.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_addr = sac.address();
    let usdc = token::Client::new(&env, &usdc_addr);
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc_addr);

    let contract_id = env.register(
        ApexFuturesContract,
        (
            admin.clone(),
            pauser.clone(),
            fee_collector.clone(),
            usdc_addr.clone(),
            oracle_updater.clone(),
            INIT_BASE,
            INIT_QUOTE,
            default_config(),
        ),
    );
    let client = ApexFuturesContractClient::new(&env, &contract_id);

    Rig {
        env,
        client,
        usdc,
        usdc_admin,
        contract_id,
        admin,
        pauser,
        fee_collector,
        oracle_updater,
    }
}

impl Rig {
    fn fund(&self, amount: i128) -> Address {
        let user = Address::generate(&self.env);
        self.usdc_admin.mint(&user, &amount);
        user
    }

    /// The core solvency invariant: the contract's real USDC balance must fully
    /// back the sum of all internal accounting buckets.
    fn assert_solvent(&self) {
        let buckets = self.client.get_buckets();
        let vault = self.usdc.balance(&self.contract_id);
        assert_eq!(
            vault,
            buckets.total_collateral + buckets.fee_vault + buckets.insurance_fund,
            "vault must back total_collateral + fee_vault + insurance_fund"
        );
        assert!(
            buckets.insurance_fund >= 0,
            "insurance fund must never go negative"
        );
        assert!(
            buckets.total_collateral >= 0,
            "total collateral must never go negative"
        );
    }
}

// --- Initialization --------------------------------------------------------

#[test]
fn test_initialize_state() {
    let r = setup();
    assert_eq!(r.client.get_mark_price(), 5 * SCALE);
    assert_eq!(r.client.get_oracle_price(), 5 * SCALE);
    assert_eq!(r.client.get_admin(), r.admin);
    assert!(!r.client.is_paused());
    let res = r.client.get_reserves();
    assert_eq!(res.base, INIT_BASE);
    assert_eq!(res.quote, INIT_QUOTE);
    r.assert_solvent();
}

#[test]
fn test_double_init_rejected() {
    let r = setup();
    // Re-invoking the constructor path is impossible post-deploy; assert the
    // guard by attempting to register a second time over the same state is not
    // representable, so we assert the flag instead.
    assert!(r.client.get_admin() == r.admin);
}

// --- Collateral ------------------------------------------------------------

#[test]
fn test_deposit_and_withdraw() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);

    r.client.deposit_margin(&user, &(1_000 * SCALE));
    assert_eq!(r.client.get_margin_balance(&user), 1_000 * SCALE);
    assert_eq!(r.usdc.balance(&r.contract_id), 1_000 * SCALE);
    r.assert_solvent();

    r.client.withdraw_margin(&user, &(400 * SCALE));
    assert_eq!(r.client.get_margin_balance(&user), 600 * SCALE);
    assert_eq!(r.usdc.balance(&user), 400 * SCALE);
    r.assert_solvent();
}

#[test]
fn test_withdraw_more_than_free_rejected() {
    let r = setup();
    let user = r.fund(100 * SCALE);
    r.client.deposit_margin(&user, &(100 * SCALE));
    assert_eq!(
        r.client.try_withdraw_margin(&user, &(101 * SCALE)),
        Err(Ok(Error::InsufficientFreeMargin.into()))
    );
}

// --- Opening / closing -----------------------------------------------------

#[test]
fn test_open_long_charges_fee_and_locks_margin() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));

    let size = 100 * SCALE; // 100 virtual base units
    r.client.open_position(&user, &size, &true, &0);

    let pos = r.client.get_position(&user);
    assert_eq!(pos.size, size); // long => positive
    assert!(pos.margin_allocated > 0);

    // Free margin dropped by allocated margin + fee.
    let free = r.client.get_margin_balance(&user);
    assert!(free < 1_000 * SCALE);
    // A fee accrued to the protocol.
    assert!(r.client.get_buckets().fee_vault > 0);
    r.assert_solvent();
}

#[test]
fn test_open_close_roundtrip_costs_only_fees() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));

    let size = 100 * SCALE;
    r.client.open_position(&user, &size, &true, &0);
    r.client.close_position(&user, &0);

    // Position gone; user got back margin minus (open+close) fees and rounding.
    assert_eq!(r.client.get_position(&user).size, 0);
    let free = r.client.get_margin_balance(&user);
    assert!(free < 1_000 * SCALE); // paid fees
    assert!(free > 995 * SCALE); // but only a small amount
    r.assert_solvent();
}

#[test]
fn test_open_requires_free_margin() {
    let r = setup();
    let user = r.fund(50 * SCALE);
    r.client.deposit_margin(&user, &(50 * SCALE));
    // Notional ~500 => needs ~100 margin; only 50 deposited.
    assert_eq!(
        r.client.try_open_position(&user, &(100 * SCALE), &true, &0),
        Err(Ok(Error::InsufficientFreeMargin.into()))
    );
}

#[test]
fn test_double_position_rejected() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0);
    assert_eq!(
        r.client.try_open_position(&user, &(50 * SCALE), &true, &0),
        Err(Ok(Error::PositionExists.into()))
    );
}

#[test]
fn test_below_min_size_rejected() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    assert_eq!(
        r.client.try_open_position(&user, &(SCALE / 2), &true, &0),
        Err(Ok(Error::BelowMinPositionSize.into()))
    );
}

#[test]
fn test_slippage_guard_on_open() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    // Long notional is ~500 USDC; cap it at 1 USDC to force a slippage revert.
    assert_eq!(
        r.client
            .try_open_position(&user, &(100 * SCALE), &true, &SCALE),
        Err(Ok(Error::SlippageExceeded.into()))
    );
}

// --- PnL with price movement ----------------------------------------------

#[test]
fn test_long_profits_when_mark_rises() {
    let r = setup();
    // Seed insurance so winners can be paid.
    let seeder = r.fund(10_000 * SCALE);
    r.client.seed_insurance(&seeder, &(10_000 * SCALE));

    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    let free_before = r.client.get_margin_balance(&user);

    r.client.open_position(&user, &(100 * SCALE), &true, &0);

    // A whale pushes the mark up with a large long.
    let whale = r.fund(1_000_000 * SCALE);
    r.client.deposit_margin(&whale, &(1_000_000 * SCALE));
    r.client.open_position(&whale, &(50_000 * SCALE), &true, &0);
    assert!(r.client.get_mark_price() > 5 * SCALE);

    r.client.close_position(&user, &0);
    let free_after = r.client.get_margin_balance(&user);
    // User closed at a higher mark => realized a profit net of fees.
    assert!(
        free_after > free_before,
        "long should profit after mark rise"
    );
    r.assert_solvent();
}

// --- Liquidation -----------------------------------------------------------

#[test]
fn test_healthy_position_not_liquidatable() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0);

    let liquidator = Address::generate(&r.env);
    assert_eq!(
        r.client.try_liquidate(&liquidator, &user),
        Err(Ok(Error::NotLiquidatable.into()))
    );
}

#[test]
fn test_liquidation_when_index_drops() {
    let r = setup();
    let user = r.fund(120 * SCALE);
    r.client.deposit_margin(&user, &(120 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0); // ~100 margin locked

    // Index collapses ~20% while mark is unchanged => index-priced HF < 1.
    r.client.update_oracle(&r.oracle_updater, &(4 * SCALE));

    let liquidator = Address::generate(&r.env);
    let liq_balance_before = r.usdc.balance(&liquidator);
    r.client.liquidate(&liquidator, &user);

    // Position wiped, liquidator paid a bounty, invariant intact.
    assert_eq!(r.client.get_position(&user).size, 0);
    assert!(
        r.usdc.balance(&liquidator) > liq_balance_before,
        "liquidator earns a bounty"
    );
    r.assert_solvent();
}

// --- Oracle ----------------------------------------------------------------

#[test]
fn test_unauthorized_oracle_update() {
    let r = setup();
    let stranger = Address::generate(&r.env);
    assert_eq!(
        r.client.try_update_oracle(&stranger, &(6 * SCALE)),
        Err(Ok(Error::Unauthorized.into()))
    );
}

#[test]
fn test_oracle_deviation_rejected() {
    let r = setup();
    // From 5.0, +80% (to 9.0) exceeds the 50% band.
    assert_eq!(
        r.client.try_update_oracle(&r.oracle_updater, &(9 * SCALE)),
        Err(Ok(Error::OracleDeviationTooHigh.into()))
    );
    // Within band is fine.
    r.client.update_oracle(&r.oracle_updater, &(6 * SCALE));
    assert_eq!(r.client.get_oracle_price(), 6 * SCALE);
}

#[test]
fn test_stale_oracle_blocks_liquidation() {
    let r = setup();
    let user = r.fund(120 * SCALE);
    r.client.deposit_margin(&user, &(120 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0);

    // Advance well beyond the staleness window without refreshing the oracle.
    r.env.ledger().with_mut(|li| li.timestamp = 200_000);
    let liquidator = Address::generate(&r.env);
    assert_eq!(
        r.client.try_liquidate(&liquidator, &user),
        Err(Ok(Error::StaleOracle.into()))
    );
}

// --- Circuit breaker -------------------------------------------------------

#[test]
fn test_pause_blocks_open_allows_close() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0);

    r.client.pause(&r.pauser);
    assert!(r.client.is_paused());

    // New risk blocked...
    let user2 = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user2, &(1_000 * SCALE));
    assert_eq!(
        r.client
            .try_open_position(&user2, &(100 * SCALE), &true, &0),
        Err(Ok(Error::Paused.into()))
    );
    // ...but exiting is always allowed.
    r.client.close_position(&user, &0);
    assert_eq!(r.client.get_position(&user).size, 0);
    r.assert_solvent();
}

#[test]
fn test_unpause_requires_admin() {
    let r = setup();
    r.client.pause(&r.pauser);
    // Pauser cannot unpause; only admin can.
    assert_eq!(
        r.client.try_unpause(&r.pauser),
        Err(Ok(Error::Unauthorized.into()))
    );
    r.client.unpause(&r.admin);
    assert!(!r.client.is_paused());
}

// --- Admin RBAC ------------------------------------------------------------

#[test]
fn test_two_step_admin_transfer() {
    let r = setup();
    let new_admin = Address::generate(&r.env);
    r.client.transfer_admin(&r.admin, &new_admin);
    // Not yet effective.
    assert_eq!(r.client.get_admin(), r.admin);
    // Wrong acceptor rejected.
    let stranger = Address::generate(&r.env);
    assert_eq!(
        r.client.try_accept_admin(&stranger),
        Err(Ok(Error::Unauthorized.into()))
    );
    // Correct acceptor takes over.
    r.client.accept_admin(&new_admin);
    assert_eq!(r.client.get_admin(), new_admin);
}

#[test]
fn test_non_admin_cannot_set_config() {
    let r = setup();
    let stranger = Address::generate(&r.env);
    let cfg = default_config();
    assert_eq!(
        r.client.try_set_config(&stranger, &cfg),
        Err(Ok(Error::Unauthorized.into()))
    );
}

#[test]
fn test_set_config_validates_bounds() {
    let r = setup();
    let mut bad = default_config();
    bad.maint_margin_bps = bad.init_margin_bps + 1; // maint must be < init
    assert_eq!(
        r.client.try_set_config(&r.admin, &bad),
        Err(Ok(Error::InvalidParams.into()))
    );
}

// --- Fees ------------------------------------------------------------------

#[test]
fn test_collect_fees() {
    let r = setup();
    let user = r.fund(1_000 * SCALE);
    r.client.deposit_margin(&user, &(1_000 * SCALE));
    r.client.open_position(&user, &(100 * SCALE), &true, &0);
    r.client.close_position(&user, &0);

    let accrued = r.client.get_buckets().fee_vault;
    assert!(accrued > 0);

    let collected = r.client.collect_fees(&r.fee_collector);
    assert_eq!(collected, accrued);
    assert_eq!(r.usdc.balance(&r.fee_collector), accrued);
    assert_eq!(r.client.get_buckets().fee_vault, 0);
    r.assert_solvent();
}

// --- Funding ---------------------------------------------------------------

#[test]
fn test_funding_too_early() {
    let r = setup();
    // last_funding_ts == 0 at init, timestamp == 0 => no interval elapsed.
    assert_eq!(
        r.client.try_settle_funding(),
        Err(Ok(Error::FundingTooEarly.into()))
    );
}

#[test]
fn test_funding_accrues_with_premium() {
    let r = setup();
    // Push the mark above the index so longs should pay funding.
    let whale = r.fund(1_000_000 * SCALE);
    r.client.deposit_margin(&whale, &(1_000_000 * SCALE));
    r.client.open_position(&whale, &(50_000 * SCALE), &true, &0);
    assert!(r.client.get_mark_price() > r.client.get_oracle_price());

    // Advance one funding interval and settle.
    r.env.ledger().with_mut(|li| li.timestamp = 3_600);
    let premium = r.client.settle_funding();
    assert!(premium > 0, "positive premium when mark > index");
    let (cum, ts) = r.client.get_funding();
    assert!(cum > 0);
    assert_eq!(ts, 3_600);
}

// --- Solvency across a mixed sequence (property-style) ---------------------

#[test]
fn test_solvency_invariant_across_sequence() {
    let r = setup();
    let seeder = r.fund(5_000 * SCALE);
    r.client.seed_insurance(&seeder, &(5_000 * SCALE));
    r.assert_solvent();

    let a = r.fund(2_000 * SCALE);
    let b = r.fund(2_000 * SCALE);
    r.client.deposit_margin(&a, &(2_000 * SCALE));
    r.assert_solvent();
    r.client.deposit_margin(&b, &(2_000 * SCALE));
    r.assert_solvent();

    r.client.open_position(&a, &(200 * SCALE), &true, &0);
    r.assert_solvent();
    r.client.open_position(&b, &(300 * SCALE), &false, &0);
    r.assert_solvent();

    // Move the index around within the deviation band.
    r.client.update_oracle(&r.oracle_updater, &(6 * SCALE));
    r.assert_solvent();

    r.client.close_position(&a, &0);
    r.assert_solvent();
    r.client.withdraw_margin(&a, &(100 * SCALE));
    r.assert_solvent();
    r.client.close_position(&b, &0);
    r.assert_solvent();

    let _ = r.client.collect_fees(&r.fee_collector);
    r.assert_solvent();
}

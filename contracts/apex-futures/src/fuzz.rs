//! Property-based (fuzz) testing of protocol-wide invariants.
//!
//! Where `test.rs` asserts specific behaviours, this module throws *randomized
//! sequences* of user actions at the contract and checks that the safety
//! invariants hold after **every** step, regardless of ordering:
//!
//! 1. **Solvency:** the contract's real USDC vault always equals the sum of the
//!    three internal accounting buckets (`total_collateral + fee_vault +
//!    insurance_fund`). This is the property that guarantees the protocol can
//!    always pay what it owes.
//! 2. **Non-negativity:** the insurance fund and aggregate collateral never go
//!    negative (no bucket is silently overdrawn).
//! 3. **Reserve positivity:** the vAMM never drains a reserve to zero/negative.
//!
//! (Note: `k = base*quote` is intentionally *not* asserted monotonic — the swap
//! rounds directionally against the trader, ceil on buys / floor on sells, so k
//! drifts up on buys and down on sells while always pricing in the pool's favour.)
//!
//! Individual actions are allowed to fail (e.g. opening without margin) — those
//! are exercised via the `try_` client methods and simply roll back. The point
//! is that *no reachable sequence* can break an invariant.
#![cfg(test)]
extern crate std;

use std::vec::Vec;

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

use crate::storage::{Config, SCALE};
use crate::{ApexFuturesContract, ApexFuturesContractClient};

const N_USERS: usize = 3;
const INIT_BASE: i128 = 1_000_000 * SCALE;
const INIT_QUOTE: i128 = 5_000_000 * SCALE;

/// Loose config: wide oracle band + long staleness so random price moves are
/// actually accepted (exercising PnL/liquidation paths) rather than all rejected.
fn fuzz_config() -> Config {
    Config {
        init_margin_bps: 2000,
        maint_margin_bps: 1000,
        trading_fee_bps: 10,
        liq_penalty_bps: 500,
        liq_reward_bps: 5000,
        funding_interval: 3600,
        funding_admin_cut_bps: 1000,
        max_funding_bps: 500,
        oracle_max_deviation_bps: 10_000, // max allowed band (100% move per update)
        oracle_staleness: 100_000_000,
        min_position_size: SCALE,
    }
}

/// One randomly-generated protocol action.
#[derive(Clone, Debug)]
enum Op {
    Deposit(usize, i128),
    Withdraw(usize, i128),
    Open(usize, i128, bool),
    Close(usize),
    Oracle(i128),
    Liquidate(usize, usize),
    Funding,
    AdvanceTime(u64),
}

fn op_strategy() -> impl Strategy<Value = Op> {
    prop_oneof![
        (0..N_USERS, 1i128..2_000i128).prop_map(|(u, a)| Op::Deposit(u, a * SCALE)),
        (0..N_USERS, 1i128..2_000i128).prop_map(|(u, a)| Op::Withdraw(u, a * SCALE)),
        (0..N_USERS, 1i128..500i128, any::<bool>()).prop_map(|(u, s, l)| Op::Open(u, s * SCALE, l)),
        (0..N_USERS).prop_map(Op::Close),
        (1i128..20i128).prop_map(|p| Op::Oracle(p * SCALE)),
        (0..N_USERS, 0..N_USERS).prop_map(|(a, b)| Op::Liquidate(a, b)),
        Just(Op::Funding),
        (1u64..7_200u64).prop_map(Op::AdvanceTime),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 40, max_shrink_iters: 200, ..ProptestConfig::default() })]

    /// Fuzz random action sequences and assert the invariants after each step.
    #[test]
    fn invariants_hold_under_random_sequences(
        ops in prop::collection::vec(op_strategy(), 1..25usize),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000_000);

        // Deploy USDC SAC + contract (admin also acts as pauser/fee_collector here).
        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc_addr = sac.address();
        let usdc = token::Client::new(&env, &usdc_addr);
        let usdc_admin = token::StellarAssetClient::new(&env, &usdc_addr);

        let contract_id = env.register(
            ApexFuturesContract,
            (
                admin.clone(),
                admin.clone(),
                admin.clone(),
                usdc_addr.clone(),
                oracle.clone(),
                INIT_BASE,
                INIT_QUOTE,
                fuzz_config(),
                0u64, // no governance timelock needed for invariant fuzzing
            ),
        );
        let client = ApexFuturesContractClient::new(&env, &contract_id);

        // Seed the insurance fund so profitable closes/liquidations can be paid.
        usdc_admin.mint(&admin, &(100_000 * SCALE));
        client.seed_insurance(&admin, &(50_000 * SCALE));

        // Fund users.
        let mut users: Vec<Address> = Vec::new();
        for _ in 0..N_USERS {
            let u = Address::generate(&env);
            usdc_admin.mint(&u, &(1_000_000 * SCALE));
            users.push(u);
        }

        for op in ops {
            match op {
                Op::Deposit(i, a) => { let _ = client.try_deposit_margin(&users[i], &a); }
                Op::Withdraw(i, a) => { let _ = client.try_withdraw_margin(&users[i], &a); }
                Op::Open(i, s, l) => { let _ = client.try_open_position(&users[i], &s, &l, &0); }
                Op::Close(i) => { let _ = client.try_close_position(&users[i], &0); }
                Op::Oracle(p) => { let _ = client.try_update_oracle(&oracle, &p); }
                Op::Liquidate(a, b) => { let _ = client.try_liquidate(&users[a], &users[b]); }
                Op::Funding => { let _ = client.try_settle_funding(); }
                Op::AdvanceTime(dt) => {
                    let now = env.ledger().timestamp();
                    env.ledger().set_timestamp(now + dt);
                }
            }

            // --- Invariant 1 & 2: solvency + non-negativity ---
            let buckets = client.get_buckets();
            let vault = usdc.balance(&contract_id);
            prop_assert_eq!(
                vault,
                buckets.total_collateral + buckets.fee_vault + buckets.insurance_fund,
                "vault must back total_collateral + fee_vault + insurance_fund"
            );
            prop_assert!(buckets.insurance_fund >= 0, "insurance fund went negative");
            prop_assert!(buckets.total_collateral >= 0, "total collateral went negative");

            // --- Invariant 3: reserves stay strictly positive ---
            let r = client.get_reserves();
            prop_assert!(r.base > 0 && r.quote > 0, "vAMM reserve drained to <= 0");
        }
    }
}

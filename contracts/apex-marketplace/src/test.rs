#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, BytesN, Env, Symbol,
};

use crate::errors::Error;
use crate::storage::{Config, ProviderStatus, SCALE};
use crate::{ApexMarketplaceContract, ApexMarketplaceContractClient};

const TIMELOCK: u64 = 3_600;
const ACPI: i128 = 5 * SCALE; // $5 / CU

fn default_config() -> Config {
    Config {
        oracle_staleness: 86_400,
        settlement_fee_bps: 0,
    }
}

struct Rig {
    env: Env,
    client: ApexMarketplaceContractClient<'static>,
    usdc: token::Client<'static>,
    usdc_admin: token::StellarAssetClient<'static>,
    contract_id: Address,
    admin: Address,
    verifier: Address,
    pauser: Address,
}

fn setup() -> Rig {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let pauser = Address::generate(&env);
    // Futures oracle placeholder — local CU oracle is used (remote returns fail → local).
    let futures_placeholder = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_addr = sac.address();
    let usdc = token::Client::new(&env, &usdc_addr);
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc_addr);

    let contract_id = env.register(
        ApexMarketplaceContract,
        (
            admin.clone(),
            verifier.clone(),
            pauser.clone(),
            usdc_addr.clone(),
            futures_placeholder,
            ACPI,
            default_config(),
            TIMELOCK,
        ),
    );
    let client = ApexMarketplaceContractClient::new(&env, &contract_id);

    Rig {
        env,
        client,
        usdc,
        usdc_admin,
        contract_id,
        admin,
        verifier,
        pauser,
    }
}

impl Rig {
    fn fund(&self, amount: i128) -> Address {
        let user = Address::generate(&self.env);
        self.usdc_admin.mint(&user, &amount);
        user
    }

    fn assert_solvent(&self) {
        let b = self.client.get_buckets();
        let vault = self.usdc.balance(&self.contract_id);
        assert_eq!(
            vault,
            b.provider_collateral_total
                + b.index_pool_usdc
                + b.escrow_usdc
                + b.insurance_fund
                + b.fee_vault,
            "vault must back all marketplace buckets"
        );
    }

    fn zero_hash(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[0u8; 32])
    }

    fn onboard_provider(&self, collat: i128, capacity: i128) -> Address {
        let owner = self.fund(collat + 1_000_000 * SCALE);
        self.client
            .register_provider(&owner, &self.zero_hash());
        self.client.post_collateral(&owner, &collat);
        self.client
            .approve_provider(&self.verifier, &owner, &capacity);
        owner
    }
}

#[test]
fn test_init_and_coefficients() {
    let r = setup();
    assert_eq!(r.client.get_admin(), r.admin);
    assert_eq!(r.client.get_verifier(), r.verifier);
    assert!(!r.client.is_paused());
    assert_eq!(r.client.get_coefficient(&Symbol::new(&r.env, "H100")), SCALE);
    assert_eq!(
        r.client.get_coefficient(&Symbol::new(&r.env, "H200")),
        14_000_000
    );
    assert_eq!(r.client.get_oracle_price(), ACPI);
    r.assert_solvent();
}

#[test]
fn test_register_collateral_approve() {
    let r = setup();
    let owner = r.fund(10_000 * SCALE);
    r.client.register_provider(&owner, &r.zero_hash());
    let p = r.client.get_provider(&owner);
    assert_eq!(p.status, ProviderStatus::Pending);

    r.client.post_collateral(&owner, &(5_000 * SCALE));
    r.client
        .approve_provider(&r.verifier, &owner, &(100 * SCALE));
    let p = r.client.get_provider(&owner);
    assert_eq!(p.status, ProviderStatus::Approved);
    assert_eq!(p.capacity_cu, 100 * SCALE);
    assert_eq!(p.collateral, 5_000 * SCALE);
    r.assert_solvent();
}

#[test]
fn test_rbac_verifier_required() {
    let r = setup();
    let owner = r.fund(1_000 * SCALE);
    r.client.register_provider(&owner, &r.zero_hash());
    let stranger = Address::generate(&r.env);
    let res = r
        .client
        .try_approve_provider(&stranger, &owner, &(10 * SCALE));
    assert_eq!(res, Err(Ok(Error::Unauthorized.into())));
}

#[test]
fn test_pause_blocks_register() {
    let r = setup();
    r.client.pause(&r.pauser);
    let owner = r.fund(100 * SCALE);
    let res = r.client.try_register_provider(&owner, &r.zero_hash());
    assert_eq!(res, Err(Ok(Error::Paused.into())));
    r.client.unpause(&r.admin);
}

#[test]
fn test_timelock_config() {
    let r = setup();
    let mut cfg = default_config();
    cfg.settlement_fee_bps = 10;
    r.client.propose_config(&r.admin, &cfg);
    let early = r.client.try_execute_config(&r.admin);
    assert_eq!(early, Err(Ok(Error::TimelockNotReady.into())));
    r.env.ledger().set_timestamp(
        r.env.ledger().timestamp() + TIMELOCK + 1,
    );
    r.client.execute_config(&r.admin);
    assert_eq!(r.client.get_config().settlement_fee_bps, 10);
}

#[test]
fn test_mint_buy_sell_solvency() {
    let r = setup();
    let provider = r.onboard_provider(50_000 * SCALE, 1_000 * SCALE);
    let sid = r.client.create_series(
        &provider,
        &Symbol::new(&r.env, "H100"),
        &r.zero_hash(),
        &(5 * SCALE),
    );
    r.client.mint_cu(&provider, &sid, &(100 * SCALE));
    assert_eq!(r.client.get_inventory(&sid), 100 * SCALE);

    let buyer = r.fund(10_000 * SCALE);
    r.client
        .buy_cu(&buyer, &sid, &(10 * SCALE), &(100 * SCALE));
    assert_eq!(r.client.cu_balance(&sid, &buyer), 10 * SCALE);
    assert_eq!(r.client.get_inventory(&sid), 90 * SCALE);
    r.assert_solvent();

    r.client
        .sell_cu(&buyer, &sid, &(5 * SCALE), &(20 * SCALE));
    assert_eq!(r.client.cu_balance(&sid, &buyer), 5 * SCALE);
    r.assert_solvent();
}

#[test]
fn test_mint_over_capacity_rejected() {
    let r = setup();
    let provider = r.onboard_provider(10_000 * SCALE, 10 * SCALE);
    let sid = r.client.create_series(
        &provider,
        &Symbol::new(&r.env, "H100"),
        &r.zero_hash(),
        &(5 * SCALE),
    );
    let res = r.client.try_mint_cu(&provider, &sid, &(11 * SCALE));
    assert_eq!(res, Err(Ok(Error::InsufficientCapacity.into())));
}

#[test]
fn test_cash_redeem() {
    let r = setup();
    r.client
        .seed_insurance(&r.fund(100_000 * SCALE), &(100_000 * SCALE));
    let provider = r.onboard_provider(50_000 * SCALE, 1_000 * SCALE);
    let sid = r.client.create_series(
        &provider,
        &Symbol::new(&r.env, "H100"),
        &r.zero_hash(),
        &(5 * SCALE),
    );
    r.client.mint_cu(&provider, &sid, &(20 * SCALE));
    let buyer = r.fund(10_000 * SCALE);
    r.client
        .buy_cu(&buyer, &sid, &(10 * SCALE), &(100 * SCALE));

    let before = r.usdc.balance(&buyer);
    r.client.redeem_cu(&buyer, &sid, &(4 * SCALE));
    let after = r.usdc.balance(&buyer);
    // ACPI = 5, H100 coeff = 1 → 4 CU * $5 = $20
    assert_eq!(after - before, 20 * SCALE);
    assert_eq!(r.client.cu_balance(&sid, &buyer), 6 * SCALE);
    r.assert_solvent();
}

#[test]
fn test_access_redeem_mock() {
    let r = setup();
    let provider = r.onboard_provider(20_000 * SCALE, 100 * SCALE);
    let sid = r.client.create_series(
        &provider,
        &Symbol::new(&r.env, "A100"),
        &r.zero_hash(),
        &(3 * SCALE),
    );
    r.client.mint_cu(&provider, &sid, &(10 * SCALE));
    let buyer = r.fund(5_000 * SCALE);
    r.client.buy_cu(&buyer, &sid, &(2 * SCALE), &(20 * SCALE));
    let voucher = r.client.redeem_cu_for_access(&buyer, &sid, &SCALE);
    assert_eq!(voucher.to_array().len(), 32);
    assert_eq!(r.client.cu_balance(&sid, &buyer), SCALE);
    r.assert_solvent();
}

#[test]
fn test_index_buy_redeem() {
    let r = setup();
    r.client
        .create_index(&r.admin, &Symbol::new(&r.env, "CUINDEX"), &SCALE);
    let nav = r.client.get_index_nav(&Symbol::new(&r.env, "CUINDEX"));
    assert_eq!(nav, ACPI);

    let buyer = r.fund(1_000 * SCALE);
    r.client
        .buy_index(&buyer, &Symbol::new(&r.env, "CUINDEX"), &(100 * SCALE));
    let shares = r
        .client
        .index_shares(&Symbol::new(&r.env, "CUINDEX"), &buyer);
    assert!(shares > 0);
    r.assert_solvent();

    r.client
        .redeem_index(&buyer, &Symbol::new(&r.env, "CUINDEX"), &shares);
    assert_eq!(
        r.client
            .index_shares(&Symbol::new(&r.env, "CUINDEX"), &buyer),
        0
    );
    r.assert_solvent();
}

#[test]
fn test_subindex_cunvda() {
    let r = setup();
    // Sector factor 1.0 for MVP demo
    r.client
        .create_index(&r.admin, &Symbol::new(&r.env, "CUNVDA"), &SCALE);
    assert_eq!(
        r.client.get_index_nav(&Symbol::new(&r.env, "CUNVDA")),
        ACPI
    );
}

#[test]
fn test_slash_to_insurance() {
    let r = setup();
    let provider = r.onboard_provider(5_000 * SCALE, 100 * SCALE);
    r.client
        .slash_provider(&r.admin, &provider, &(1_000 * SCALE));
    let p = r.client.get_provider(&provider);
    assert_eq!(p.collateral, 4_000 * SCALE);
    assert_eq!(r.client.get_buckets().insurance_fund, 1_000 * SCALE);
    r.assert_solvent();
}

#[test]
fn test_unknown_gpu_rejected() {
    let r = setup();
    let provider = r.onboard_provider(5_000 * SCALE, 100 * SCALE);
    let res = r.client.try_create_series(
        &provider,
        &Symbol::new(&r.env, "H700"),
        &r.zero_hash(),
        &(5 * SCALE),
    );
    assert_eq!(res, Err(Ok(Error::UnknownGpuModel.into())));
}

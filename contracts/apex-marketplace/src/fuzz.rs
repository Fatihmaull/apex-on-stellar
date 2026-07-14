#![cfg(test)]
//! Property tests: vault solvency across random marketplace ops.

extern crate std;

use proptest::prelude::*;
use soroban_sdk::{
    testutils::Address as _,
    token, Address, BytesN, Env, Symbol,
};

use crate::storage::{Config, SCALE};
use crate::{ApexMarketplaceContract, ApexMarketplaceContractClient};

fn cfg() -> Config {
    Config {
        oracle_staleness: 86_400,
        settlement_fee_bps: 0,
    }
}

fn solvent(client: &ApexMarketplaceContractClient, usdc: &token::Client, cid: &Address) {
    let b = client.get_buckets();
    let vault = usdc.balance(cid);
    assert_eq!(
        vault,
        b.provider_collateral_total
            + b.index_pool_usdc
            + b.escrow_usdc
            + b.insurance_fund
            + b.fee_vault
    );
}

proptest! {
    #[test]
    fn fuzz_buy_redeem_conserves(
        mint_n in 1i128..=50,
        buy_n in 1i128..=50,
    ) {
        let mint_amt = mint_n * SCALE;
        let buy_amt = buy_n.min(mint_n) * SCALE;

        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let verifier = Address::generate(&env);
        let pauser = Address::generate(&env);
        let futures = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc_addr = sac.address();
        let usdc = token::Client::new(&env, &usdc_addr);
        let usdc_admin = token::StellarAssetClient::new(&env, &usdc_addr);

        let cid = env.register(
            ApexMarketplaceContract,
            (
                admin.clone(),
                verifier.clone(),
                pauser,
                usdc_addr.clone(),
                futures,
                5 * SCALE,
                cfg(),
                0u64,
            ),
        );
        let client = ApexMarketplaceContractClient::new(&env, &cid);

        let provider = Address::generate(&env);
        usdc_admin.mint(&provider, &(1_000_000 * SCALE));
        let zero = BytesN::from_array(&env, &[0u8; 32]);
        client.register_provider(&provider, &zero);
        client.post_collateral(&provider, &(100_000 * SCALE));
        client.approve_provider(&verifier, &provider, &(10_000 * SCALE));
        let sid = client.create_series(
            &provider,
            &Symbol::new(&env, "H100"),
            &zero,
            &(5 * SCALE),
        );
        client.mint_cu(&provider, &sid, &mint_amt);

        let buyer = Address::generate(&env);
        usdc_admin.mint(&buyer, &(1_000_000 * SCALE));
        client.buy_cu(&buyer, &sid, &buy_amt, &(1_000_000 * SCALE));
        solvent(&client, &usdc, &cid);

        let half = buy_amt / 2;
        if half > 0 {
            client.redeem_cu(&buyer, &sid, &half);
            solvent(&client, &usdc, &cid);
        }
    }
}

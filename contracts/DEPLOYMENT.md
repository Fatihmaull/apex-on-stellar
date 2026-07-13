# APEX Futures — Deployment Checklist

Security-first deployment guide for the `apex-futures` Soroban contract.

## 0. Build & verify

```bash
# From repo root
cargo test -p apex-futures              # all unit/invariant tests must pass
stellar contract build                  # -> target/wasm32v1-none/release/apex_futures.wasm
stellar contract optimize \
  --wasm target/wasm32v1-none/release/apex_futures.wasm
```

The optimized wasm must stay < 64 KB (currently ~28 KB).

## 1. Identities (keep roles separated)

Create distinct keys — never reuse one key across roles. For mainnet the
**admin** and **oracle_updater** should be multisig / governance accounts.

```bash
stellar keys generate deployer   --network testnet   # becomes admin (→ multisig on mainnet)
stellar keys generate pauser      --network testnet
stellar keys generate fee-collect --network testnet
stellar keys generate oracle      --network testnet
```

| Role            | Powers                                            | Mainnet recommendation |
|-----------------|---------------------------------------------------|------------------------|
| `admin`         | config, upgrade, unpause, role rotation           | 3-of-5 multisig        |
| `pauser`        | trip circuit breaker only                         | ops multisig / hot key |
| `fee_collector` | sweep fee vault                                   | treasury address       |
| `oracle_updater`| push index price                                  | GRC oracle multisig    |

## 2. Constructor parameters

The contract has **no `initialize` function** — configuration is set atomically
in the constructor at deploy time (closes the init front-running window).

| Param            | Testnet example                    | Notes |
|------------------|------------------------------------|-------|
| `admin`          | `deployer` address                 | |
| `pauser`         | `pauser` address                   | |
| `fee_collector`  | `fee-collect` address              | |
| `usdc`           | USDC SAC contract id               | Circle USDC SAC on the target network |
| `oracle_updater` | `oracle` address                   | |
| `init_base`      | `10000000000000` (1,000,000 × 1e7) | virtual base reserve |
| `init_quote`     | `50000000000000` (5,000,000 × 1e7) | implies 5.0 USDC start price |
| `config`         | see below                          | risk/fee params |

### `config` (Config struct) — recommended launch values

| Field                      | Value | Meaning |
|----------------------------|-------|---------|
| `init_margin_bps`          | 2000  | 20% initial margin → 5x max leverage |
| `maint_margin_bps`         | 1000  | 10% maintenance (liquidation threshold) |
| `trading_fee_bps`          | 10    | 0.1% open/close fee |
| `liq_penalty_bps`          | 500   | 5% liquidation penalty |
| `liq_reward_bps`           | 5000  | 50% of penalty → liquidator, rest → insurance |
| `funding_interval`         | 3600  | 1h funding cadence (seconds) |
| `funding_admin_cut_bps`    | 1000  | 10% protocol cut of funding paid |
| `max_funding_bps`          | 100   | cap premium at 1% of index per settle |
| `oracle_max_deviation_bps` | 2000  | reject index moves > 20% vs last |
| `oracle_staleness`         | 3600  | index older than 1h is stale for risk checks |
| `min_position_size`        | 10000000 | 1.0 base unit minimum |

### `timelock_delay` (constructor arg, seconds)

Delay enforced between proposing and executing an `upgrade` or `set_config`
governance action. **Recommended: 86400–172800 (24–48h) on mainnet.** May be `0`
on testnet for demos. This is the users' guaranteed exit window before any
parameter/code change takes effect.

## 3. Deploy (constructor args)

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/apex_futures.optimized.wasm \
  --source deployer --network testnet \
  -- \
  --admin <DEPLOYER_G...> \
  --pauser <PAUSER_G...> \
  --fee_collector <FEECOLLECT_G...> \
  --usdc <USDC_SAC_C...> \
  --oracle_updater <ORACLE_G...> \
  --init_base 10000000000000 \
  --init_quote 50000000000000 \
  --config '{ "init_margin_bps":"2000","maint_margin_bps":"1000","trading_fee_bps":"10","liq_penalty_bps":"500","liq_reward_bps":"5000","funding_interval":"3600","funding_admin_cut_bps":"1000","max_funding_bps":"100","oracle_max_deviation_bps":"2000","oracle_staleness":"3600","min_position_size":"10000000" }' \
  --timelock_delay 86400
```

### Governance operations (post-deploy)

Config/upgrade changes are two-phase (timelocked):

```bash
# 1. Propose (admin)
stellar contract invoke --id <CID> --source admin --network testnet \
  -- propose_config --caller <ADMIN_G...> --config '{ ... }'
# 2. After timelock_delay seconds, execute (admin)
stellar contract invoke --id <CID> --source admin --network testnet \
  -- execute_config --caller <ADMIN_G...>
# (cancel_config aborts a pending proposal; same pattern for *_upgrade)
```

Record the returned **contract id** into `frontend/.env.local` as
`NEXT_PUBLIC_CONTRACT_ID`.

## 4. Post-deploy bootstrap

1. **Seed the insurance fund** so early winners can be paid and bad debt absorbed:
   ```bash
   stellar contract invoke --id <CONTRACT_ID> --source treasury --network testnet \
     -- seed_insurance --from <TREASURY_G...> --amount <USDC_7DP>
   ```
2. **Start the oracle feeder** (cron pushing GRC index prices):
   ```bash
   stellar contract invoke --id <CONTRACT_ID> --source oracle --network testnet \
     -- update_oracle --updater <ORACLE_G...> --price <PRICE_7DP>
   ```
3. **Run a liquidation keeper** polling `get_health_factor` / `liquidate`.
4. Smoke-test: `deposit_margin → open_position → update_oracle → close_position`.

## 5. Fuzzing / property testing (pre-mainnet)

The in-tree `test_solvency_invariant_across_sequence` exercises the
`vault == total_collateral + fee_vault + insurance_fund` invariant across a mixed
operation sequence. Before mainnet, extend this with randomized sequences (e.g. a
`proptest`/`cargo-fuzz` harness driving deposit/open/close/liquidate/funding with
random sizes, sides and prices) and assert after every step:
- solvency invariant holds,
- `insurance_fund >= 0`,
- constant-product `k` never decreases from rounding.

## 6. Mainnet gates (do not skip)

- [ ] External security audit completed and findings resolved.
- [ ] `admin` and `oracle_updater` migrated to multisig; single keys revoked.
- [ ] Insurance fund seeded to a policy minimum.
- [ ] `oracle_max_deviation_bps` / `oracle_staleness` tuned to real feed cadence.
- [ ] Pause runbook rehearsed; `pause`/`unpause` authorities confirmed.
- [ ] Upgrade path tested on testnet via `upgrade(new_wasm_hash)`.
- [ ] Monitoring on emitted events (`open`/`close`/`liquidate`/`funding`/`oracle`).

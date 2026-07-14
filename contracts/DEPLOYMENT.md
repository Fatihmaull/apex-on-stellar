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
| `usdc`           | USDC SAC contract id               | Testnet: our own issued test USDC (see `deployments.md`). Mainnet: Circle USDC SAC. |
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
  --config '{ "init_margin_bps":"2000","maint_margin_bps":"1000","trading_fee_bps":"10","liq_penalty_bps":"500","liq_reward_bps":"5000","funding_interval":3600,"funding_admin_cut_bps":"1000","max_funding_bps":"100","oracle_max_deviation_bps":"2000","oracle_staleness":3600,"min_position_size":"10000000" }' \
  --timelock_delay 86400
```

> **JSON types matter.** `funding_interval` and `oracle_staleness` are `u64` and
> must be passed as JSON **numbers**; every other `Config` field is `i128` and
> must be a JSON **string**. Quoting those two `u64`s makes the CLI fail at
> argument parsing (`unknown variant '3600'`) before a transaction is ever built.

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

## 5. Fuzzing / property testing

Already in-tree (`src/fuzz.rs`, `proptest`): randomized sequences of deposit /
withdraw / open / close / liquidate / oracle / funding / time-advance, asserting
after **every** step that

- solvency holds — `vault == total_collateral + fee_vault + insurance_fund`,
- `insurance_fund >= 0` and `total_collateral >= 0`,
- neither vAMM reserve is ever drained to `<= 0`.

Note `k = base * quote` is deliberately **not** asserted monotonic: `vamm::swap`
rounds directionally against the trader (ceil on buys, floor on sells), so `k`
drifts both ways while always pricing in the pool's favour.

Before mainnet, raise `ProptestConfig::cases` well above the current 40 and add a
`cargo-fuzz` target on the swap/settlement math.

## 6. Mainnet gates (do not skip)

- [ ] External security audit completed and findings resolved.
- [ ] `admin` and `oracle_updater` migrated to multisig; single keys revoked.
- [ ] Insurance fund seeded to a policy minimum.
- [ ] `oracle_max_deviation_bps` / `oracle_staleness` tuned to real feed cadence.
- [ ] `timelock_delay` set to 24–48h (it is **not** re-applied by `upgrade` — an
      in-place upgrade keeps the value already in storage).
- [ ] Pause runbook rehearsed; `pause`/`unpause` authorities confirmed.
- [ ] Upgrade path rehearsed on testnet end-to-end:
      `propose_upgrade` → wait `timelock_delay` → `execute_upgrade`
      (and `cancel_upgrade` aborts a pending one).
- [ ] Monitoring on emitted events (`open`/`close`/`liquidate`/`funding`/`oracle`).

---

# APEX Marketplace — Deployment Checklist

## Build

```bash
cargo test -p apex-marketplace
cargo build --target wasm32v1-none --release -p apex-marketplace
stellar contract optimize \
  --wasm target/wasm32v1-none/release/apex_marketplace.wasm
```

## Deploy (testnet)

Reuse futures identities; add a **verifier** (or pass `apex-oracle` / admin for demos).

```bash
ADMIN=$(stellar keys address apex-deployer)
VERIFIER=$(stellar keys address apex-oracle)   # or dedicated apex-verifier
PAUSER=$(stellar keys address apex-pauser)
USDC=CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL
FUTURES=CDVCBYSD3D2AMH3EDCSCUONVREWDWIOEDJFZSWKQIJNH52TP6S7VDKCC

stellar contract deploy \
  --wasm target/wasm32v1-none/release/apex_marketplace.optimized.wasm \
  --source apex-deployer --network testnet \
  -- \
  --admin "$ADMIN" \
  --verifier "$VERIFIER" \
  --pauser "$PAUSER" \
  --usdc "$USDC" \
  --futures_oracle "$FUTURES" \
  --initial_cu_price 50000000 \
  --config '{ "oracle_staleness": 86400, "settlement_fee_bps": "0" }' \
  --timelock_delay 300
```

Post-deploy seed:

```bash
MID=<marketplace_id>
# Insurance
stellar contract invoke --id $MID --source apex-deployer --network testnet -- \
  seed_insurance --from $ADMIN --amount 100000000000
# Indices (nav_factor = SCALE = 1.0)
stellar contract invoke --id $MID --source apex-deployer --network testnet -- \
  create_index --caller $ADMIN --symbol CUINDEX --nav_factor 10000000
stellar contract invoke --id $MID --source apex-deployer --network testnet -- \
  create_index --caller $ADMIN --symbol CUNVDA --nav_factor 10000000
```

Regenerate bindings + set `NEXT_PUBLIC_MARKETPLACE_ID` in `frontend/.env.local`.
Record the contract id in `deployments.md`.

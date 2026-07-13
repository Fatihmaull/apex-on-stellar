# APEX Operating Handbook

How to run the APEX compute-futures exchange — from both a **business** and a
**technical** perspective. Pair this with:

- [`README.md`](README.md) — what APEX is and how to build/run it.
- [`SECURITY.md`](SECURITY.md) — threat model and invariants.
- [`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md) — deploy checklist & params.

> Testnet software. Nothing here is financial, legal, or investment advice.

---

# Part I — Business operations

## 1. What the business is

APEX is a **risk-management layer and price-discovery hub** for GPU compute in the
APAC region. It does not own servers. It runs a cash-settled futures market on the
**APAC GPU Index**, letting participants trade the *price of compute* without ever
moving hardware. Settlement is in USDC on Stellar.

## 2. Who the customers are

| Segment | Why they trade | Typical position |
|---------|----------------|------------------|
| Data-center / neocloud operators | Hedge falling rental prices / depreciation | **Short** |
| AI labs & enterprises | Lock in future capacity cost | **Long** |
| Quant / prop traders | Provide liquidity, arbitrage mark vs. index | Either |

The market only functions if these flows are balanced enough; **funding rate** is
the economic lever that keeps the mark tethered to the real index and incentivizes
the under-represented side.

## 3. How APEX makes money

Three automatic protocol revenue streams (all accrue on-chain):

| Stream | Rate (default) | Where it lands | Contract control |
|--------|----------------|----------------|------------------|
| Trading fee | 0.1% of notional, on open **and** close | `fee_vault` | `trading_fee_bps` |
| Liquidation penalty | 5% of liquidated equity | split: liquidator bounty + `insurance_fund` | `liq_penalty_bps`, `liq_reward_bps` |
| Funding admin cut | 10% of funding paid | `fee_vault` | `funding_admin_cut_bps` |

Fees are swept to the treasury with `collect_fees` (fee-collector or admin only).

## 4. The numbers to watch (KPIs)

Pull these from the read-only contract getters and emitted events (see Part II §7).

| KPI | Source | Healthy signal |
|-----|--------|----------------|
| Open interest / volume | `open`/`close` events | Growing, two-sided |
| Mark vs. index premium | `get_mark_price` vs `get_oracle_price` | Small, mean-reverting |
| Funding rate | `funding` events / `get_funding` | Oscillating around 0 |
| Insurance fund balance | `get_buckets().insurance_fund` | ≥ policy floor, stable/growing |
| Fee revenue | `get_buckets().fee_vault` | Growing with volume |
| Solvency margin | vault vs. `get_buckets()` sum | Always exactly equal |

## 5. Capital & risk policy (business decisions)

- **Insurance fund floor.** Decide a minimum USDC balance the insurance fund must
  hold before the market is open to size. Top up via `seed_insurance` if it drops
  near the floor after a run of trader wins or bad debt.
- **Leverage & fees.** `init_margin_bps` (leverage cap) and `trading_fee_bps` are
  competitive/risk levers. Changing them is a **governance action** (timelocked).
- **New markets.** Additional compute units (e.g. a new accelerator index) are new
  deployments with their own reserves and oracle.

## 6. Go-to-market (from the blueprint)

1. **Alpha testnet** — campus/Web3 builder community stress-tests the vAMM.
2. **Supply integration** — onboard 3–5 Tier-2 data-center operators as oracle
   data sources.
3. **Liquidity mining** — incentivize quant volume at mainnet launch.

## 7. Token ($APEX) — future scope

The blueprint defines a $APEX utility token (fee discounts, oracle-security
staking/slashing, governance). It is **not implemented** in the current contract;
the exchange runs entirely on USDC. Treat token work as a separate future phase.

---

# Part II — Technical operations

## 1. System map

```
Traders ──USDC──▶ apex-futures contract ──events──▶ indexer/dashboards
                    ▲            ▲   ▲
     oracle_updater │   admin    │   │ liquidators (permissionless)
     (index price)  │ (timelock) │   │ keepers (funding/liquidation)
                    └── fee_collector (sweeps)
```

## 2. Keys & roles (who can do what)

| Role | Powers | Custody recommendation |
|------|--------|------------------------|
| `admin` | propose/execute config & upgrade, unpause, rotate roles | **Multisig** + hardware; the timelock is your safety net |
| `pauser` | `pause` only | Ops multisig or a monitored hot key (fast reaction) |
| `oracle_updater` | `update_oracle` | Oracle multisig; the feeder keeper signs with it |
| `fee_collector` | `collect_fees` | Treasury address |
| keepers / liquidators | `settle_funding`, `liquidate` | Permissionless hot keys (any operator) |

**Golden rule:** no single key can move user funds. Solvency is protected by the
contract invariant; governance is protected by the timelock; halting is protected
by the pauser.

## 3. Routine operations (the daily/rhythm jobs)

| Job | Cadence | Command / mechanism | Who |
|-----|---------|---------------------|-----|
| Push index price | Per oracle interval | `update_oracle` (see `scripts/oracle-feeder`) | oracle_updater |
| Settle funding | Every `funding_interval` | `settle_funding` (permissionless) | any keeper |
| Liquidate underwater positions | Continuous poll | `liquidate` when `get_health_factor < 1.0` | any keeper |
| Sweep fees | Weekly/threshold | `collect_fees` | fee_collector |
| Check insurance floor | Daily | `get_buckets`; `seed_insurance` if low | treasury |
| Verify solvency invariant | Continuous (monitor) | vault == Σ buckets | monitoring |

Reference keeper scripts live in [`scripts/`](scripts/README.md).

## 4. Governance operations (timelocked)

Config and code changes are **two-phase**. Users get `timelock_delay` seconds to
exit before anything takes effect.

```bash
# Change risk/fee parameters
propose_config(caller=admin, config={...})     # queues; validated immediately
#   ...wait timelock_delay seconds...
execute_config(caller=admin)                   # applies
cancel_config(caller=admin)                    # abort a queued change

# Upgrade contract code
propose_upgrade(caller=admin, new_wasm_hash)
#   ...wait timelock_delay seconds...
execute_upgrade(caller=admin)
cancel_upgrade(caller=admin)
```

Inspect what's pending any time: `get_pending_config`, `get_pending_upgrade`,
`get_timelock_delay`. **Cancel immediately** if a pending action you did not
authorize appears (compromise signal).

## 5. Parameter tuning guide

| Parameter | Raise it to… | Watch out for |
|-----------|--------------|---------------|
| `init_margin_bps` | Reduce max leverage / de-risk | Too high → uncompetitive |
| `maint_margin_bps` | Liquidate sooner | Must stay `< init_margin_bps` |
| `trading_fee_bps` | Grow revenue | Too high → kills volume (cap 10%) |
| `liq_penalty_bps` | Grow insurance fund | Too high → punitive, discourages traders |
| `max_funding_bps` | Stronger mark↔index pull | Too high → funding whipsaw |
| `oracle_max_deviation_bps` | Accept larger jumps | Too high → weakens manipulation guard |
| `oracle_staleness` | Tolerate slower feeds | Too high → stale-price risk |

All changes go through the timelock. `execute_config` re-validates bounds.

## 6. Emergency procedures

**Circuit breaker (halt new risk):**
```bash
pause(caller=pauser)      # blocks opens; close/withdraw/liquidate stay OPEN
unpause(caller=admin)     # resume (admin only — higher bar than pausing)
```
Pausing never traps user funds. Use it on: oracle malfunction, suspected
manipulation, or a discovered bug pending a fix/upgrade.

**Incident runbook:**

| Scenario | First action | Then |
|----------|--------------|------|
| Oracle feed down / stale | Monitor already blocks risk on stale price | Restore feeder; consider `pause` if prolonged |
| Suspected price manipulation | `pause` | Investigate; risk uses index not mark, so exposure is limited |
| Insurance fund near zero | `seed_insurance` top-up | Raise `liq_penalty_bps` / margins via governance |
| Admin/oracle key compromise | `pause`; `cancel_*` any pending gov action | Rotate role keys (`set_*` / 2-step admin transfer); the timelock buys time |
| Contract bug found | `pause`; `propose_upgrade(fix)` | After timelock, `execute_upgrade`; communicate exit window to users |

## 7. Monitoring & observability

Every critical state change emits a structured event (topics + data). Index these
into a dashboard + alerting. Key events:

| Event topic | Meaning | Alert on |
|-------------|---------|----------|
| `open` / `close` | position lifecycle | volume/OI dashboards |
| `liquidate` | forced close | spikes (market stress) |
| `oracle` | index update | **absence** (feeder down) |
| `funding` | funding settled | missed intervals |
| `up_prop` / `cfg_prop` | governance proposed | **any** — verify it's authorized |
| `gov_cxl` / `upgrade` | governance cancelled/executed | audit trail |
| `paused` / `unpaused` | circuit breaker | **any** |
| `insurance` / `fees` | fund top-up / fee sweep | fund below floor |

**Critical automated check:** continuously assert `usdc_vault == total_collateral
+ fee_vault + insurance_fund`. Any drift is a P0 — page immediately.

## 8. CI/CD & release

- Every PR runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml): contract
  `fmt`/`clippy -D warnings`/`test` + `stellar contract build`, and frontend
  `tsc`/`next build`. Green CI is required to merge.
- Contract changes: add tests, preserve the solvency invariant, and (on interface
  change) regenerate the TypeScript bindings.
- Release to a network = the DEPLOYMENT.md flow; upgrades to a live contract =
  the timelocked `propose_upgrade` → `execute_upgrade` flow.

## 9. Frontend operations

- Config is env-driven (`NEXT_PUBLIC_*`); point `.env.local` at the deployed
  contract + USDC SAC. No addresses are hardcoded.
- The app polls read-only getters and drives writes through the connected wallet
  (Freighter/Albedo/xBull). Errors map to friendly messages via the mirrored
  error-code table.
- Deploy as a standard Next.js app; ensure the CSP/host allows the Soroban RPC and
  Horizon endpoints.

---

## Quick command reference

| Action | Function | Auth |
|--------|----------|------|
| Deposit / withdraw | `deposit_margin` / `withdraw_margin` | user |
| Open / close | `open_position` / `close_position` | user |
| Liquidate | `liquidate` | anyone |
| Settle funding | `settle_funding` | anyone |
| Push index | `update_oracle` | oracle_updater |
| Seed insurance | `seed_insurance` | anyone (treasury) |
| Sweep fees | `collect_fees` | fee_collector / admin |
| Pause / unpause | `pause` / `unpause` | pauser / admin |
| Govern config | `propose_config` → `execute_config` | admin (timelocked) |
| Upgrade | `propose_upgrade` → `execute_upgrade` | admin (timelocked) |
| Rotate roles | `set_pauser` / `set_fee_collector` / `set_oracle_updater` | admin |
| Transfer admin | `transfer_admin` → `accept_admin` | admin → new admin |

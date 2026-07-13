# Security Policy & Threat Model — APEX Futures

This document is the security reference for the `apex-futures` Soroban contract:
trust model, attack surface, mitigations (mapped to code), residual risks, and
the pre-audit scope. It is written to be handed directly to an external auditor.

> Status: **testnet, unaudited.** Do not use with real funds until an external
> audit is complete and the mainnet gates in [`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md) are met.

---

## 1. System roles & trust assumptions

| Role | Powers | Trust assumption |
|------|--------|------------------|
| `admin` | `set_config`, `upgrade`, `unpause`, rotate roles | Trusted; **should be multisig + timelock on mainnet** |
| `pauser` | `pause` only | Semi-trusted; can only *halt* new risk, never move funds |
| `oracle_updater` | `update_oracle` | Trusted price source; **multisig-aggregated on mainnet** |
| `fee_collector` | `collect_fees` | Trusted recipient of accrued fees only |
| user / trader | deposit, open, close, withdraw | Untrusted |
| liquidator | `liquidate` underwater positions | Untrusted, permissionless |

The protocol's core safety (solvency) does **not** depend on traders or
liquidators being honest. It *does* depend on the oracle reporting a truthful
APAC GPU Index and on the admin key not being compromised — the two centralization
risks tracked in §4.

## 2. Invariants the contract guarantees

1. **Solvency:** `usdc_vault == total_collateral + fee_vault + insurance_fund` at
   all times. Verified after every operation in the fuzz suite
   (`src/fuzz.rs`) and the sequence test (`src/test.rs`).
2. **Non-negativity:** `insurance_fund >= 0` and `total_collateral >= 0`.
3. **Reserve positivity:** the vAMM never drains a reserve to zero.
4. **One position per account**, and payouts to a user are capped by available
   collateral + insurance (a single account can never mint value from nothing).

## 3. Attack surface & mitigations (mapped to code)

| Vector | Mitigation | Where |
|--------|-----------|-------|
| **Oracle manipulation** (feed a bad price) | Deviation band vs. last price + staleness window; risk checks reject stale prices | `oracle.rs`, `storage.rs` config, `admin::validate_config` |
| **vAMM mark manipulation** (whale moves mark, then liquidates) | Health factor & liquidation use the **fresh oracle index**, not the manipulable mark | `margin.rs` (`health_factor`), `liquidation.rs` |
| **Price-impact / sandwich on entry** | Caller-supplied slippage bound on open/close; directional rounding always against the trader | `lib.rs` (`open_position`/`close_position`), `vamm::swap` |
| **Reentrancy** | Checks-Effects-Interactions: all state written before/without re-entrant external calls; only trusted USDC SAC is called | `margin.rs`, `liquidation.rs`, `lib.rs` |
| **Unauthorized privileged calls** | `require_auth()` + explicit RBAC comparison on every admin/oracle path | `admin.rs`, `oracle.rs`, `lib.rs` |
| **Integer overflow / underflow** | `checked_mul`/`checked_add`; `MathOverflow` error; `overflow-checks = true` in release | `vamm.rs` (`mul_div_floor/ceil`), workspace `Cargo.toml` |
| **Init front-running** | Configuration set in the `__constructor` (runs once at deploy), no public `initialize` | `lib.rs::__constructor` |
| **Bad debt socialization** | Losses beyond a position's equity are absorbed by the insurance fund; profit payouts capped by it | `liquidation.rs`, `margin::settle_close` |
| **Fund lock via pause** | Pause blocks only opens; close/withdraw/liquidate remain callable | `admin::require_not_paused` usage |
| **Malicious upgrade** | `upgrade` is admin-gated and emits an event; mainnet requires multisig + timelock | `admin::upgrade`, `events.rs` |
| **Storage exhaustion / rent expiry** | TTL extension on instance and per-user entries on each touch | `storage::extend_*` |
| **Funding griefing** (spam settle) | `settle_funding` no-ops until `funding_interval` elapses | `funding.rs` |

## 4. Residual risks / known limitations (disclose to auditor)

1. **Centralized oracle & admin (testnet).** Single keys today. Mitigation path:
   multisig for `admin` and `oracle_updater`, timelock on `upgrade`/`set_config`
   (Phase D). Until then, a compromised oracle key can mis-price the market and a
   compromised admin key can drain via a malicious upgrade.
2. **Oracle is a trusted data source.** The contract validates *movement* and
   *freshness*, not *truth*. Garbage-but-plausible prices are accepted.
3. **No on-chain timelock** on config/upgrade yet.
4. **Funding model is simplified** (linear premium capped per interval); it has
   not been economically stress-modelled against adversarial open-interest skew.
5. **vAMM depth is a fixed virtual reserve**; parameterization (init_base/quote)
   materially affects slippage and must be set deliberately per market.
6. **Not audited.** No external review has been performed.

## 5. Pre-audit scope

Primary review targets, in priority order:

1. `liquidation.rs` — penalty split, bad-debt handling, solvency accounting.
2. `margin.rs` — `settle_close`, `health_factor`, withdrawal guard.
3. `vamm.rs` — rounding direction, overflow bounds, swap math.
4. `funding.rs` — funding accrual/settlement and admin cut.
5. `oracle.rs` + `admin.rs` — RBAC, deviation/staleness, config bounds.
6. `lib.rs` — entrypoint auth, CEI ordering, constructor.

Out of scope: the frontend, the reference keeper scripts, and the Stellar Asset
Contract itself (assumed correct/native).

## 6. Testing

- `cargo test -p apex-futures` — 25 unit tests + 1 property/fuzz test.
- `src/fuzz.rs` — `proptest` drives randomized sequences of deposit / open /
  close / liquidate / oracle / funding / time-advance and asserts §2 invariants
  after every step. Increase coverage before mainnet via more cases and a
  `cargo-fuzz` target on the swap/settlement math.

## 7. Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainers (open a
GitHub security advisory on the repository, or contact the team directly) rather
than filing a public issue. A coordinated-disclosure window and, on mainnet, a
bug-bounty program will be established before launch.

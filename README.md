# APEX — APAC Compute Exchange

APEX is a decentralized, cash-settled **compute-power futures exchange** on Stellar
(Soroban). It turns GPU compute (H100/B200/GB200-class) into a standardized,
tradable commodity so data-center operators can hedge hardware depreciation, AI
labs can lock in future capacity costs, and traders can price the **APAC GPU
Index** — all settled in USDC via the Stellar Asset Contract (SAC).

The exchange uses a **virtual AMM** (constant-product `x · y = k`) for instant
price discovery with no bootstrap liquidity providers, and a GRC oracle layer for
real-world index anchoring.

> ⚠️ **Testnet software.** Not audited, not for mainnet, not financial advice.

---

## Highlights

- **vAMM price discovery** — constant-product virtual market, no LPs required.
- **Cash-settled in USDC** — native SAC, no synthetic tokens.
- **Up to 10× leverage** with maintenance-margin liquidations.
- **Enterprise-hardened contract** — typed errors, RBAC, circuit breaker,
  upgradeability, index-priced risk, solvency-by-construction accounting.
- **Multi-wallet dApp** — Freighter / Albedo / xBull via Stellar Wallets Kit,
  built on a Tailwind + Framer Motion design system.

---

## Architecture

```
apex-stellar/
├── Cargo.toml                     # Rust workspace (member: contracts/apex-futures)
├── contracts/
│   ├── DEPLOYMENT.md              # Mainnet deployment checklist & params
│   └── apex-futures/              # Soroban contract (crate: apex-futures)
│       └── src/
│           ├── lib.rs             # Entry points & public dispatch
│           ├── errors.rs          # #[contracterror] enum (stable codes)
│           ├── events.rs          # Structured event emission (GRC auditability)
│           ├── admin.rs           # RBAC, pause, upgrade, config validation
│           ├── storage.rs         # Typed storage + TTL management
│           ├── vamm.rs            # Constant-product math (overflow-safe)
│           ├── margin.rs          # Collateral, health factor (index-priced)
│           ├── oracle.rs          # Permissioned feed w/ staleness + deviation guards
│           ├── funding.rs         # Periodic funding settlement + admin cut
│           ├── liquidation.rs     # Penalty split: liquidator / insurance fund
│           ├── test.rs            # 28 unit + solvency-invariant tests
│           └── fuzz.rs            # proptest property/fuzz harness
├── frontend/                      # Next.js 14 (App Router, TypeScript)
│   └── src/
│       ├── app/                   # layout, landing (/), trade terminal (/trade)
│       ├── components/
│       │   ├── ui/                # Button, Modal, Dropdown, Toast, Card, …
│       │   ├── wallet/            # ConnectWalletButton, WalletModal
│       │   ├── landing/           # Hero, Features, Ticker, …
│       │   └── trade/             # StatsBar, TradePanel, PositionPanel, …
│       ├── config/env.ts          # Typed NEXT_PUBLIC_* config
│       ├── hooks/useProtocol.ts   # Market + user polling, write actions
│       ├── lib/                   # stellar (RPC), contract (typed client), walletKit
│       ├── stores/walletStore.ts  # Zustand wallet state
│       └── providers/             # Toast + wallet auto-reconnect
└── scripts/                       # Oracle feeder + liquidation keeper (reference)
```

### Contract security model

- **Typed failures** — every guard returns a stable `#[contracterror]` code
  (mirrored in the frontend for friendly messages) instead of bare panics.
- **Constructor init** — configuration is set atomically at deploy, closing the
  "anyone calls `initialize` first" front-running window.
- **RBAC** — separate `admin` (2-step handover), `pauser`, `oracle_updater`,
  and `fee_collector` principals.
- **Circuit breaker** — pausing blocks *new* risk (opens) but never traps funds
  (close / withdraw / liquidate stay open).
- **Upgradeability** — admin-gated `update_current_contract_wasm`, audited via events.
- **Index-priced risk** — health factor and liquidations use the fresh oracle
  index, not the manipulable vAMM mark.
- **Oracle hardening** — timestamped prices with staleness rejection and a
  deviation band vs. the last update.
- **Solvency by construction** — three accounting buckets (`TotalCollateral`,
  `FeeVault`, `InsuranceFund`) whose sum the USDC vault always backs; profit
  payouts are capped by the insurance fund and bad debt is absorbed there.

### Protocol economics

- **Trading fee** 0.1% (configurable) on open and close → fee vault.
- **Funding rate** — periodic `settle_funding()` aligns mark to index; a small
  admin cut accrues to the protocol.
- **Liquidation** — 5% penalty split between the liquidator bounty and the
  insurance fund.

---

## Getting started

### Prerequisites

- Rust + `stellar` CLI (Soroban), with the WASM target.
- Node.js 18+.
- A Stellar wallet extension (Freighter, Albedo, or xBull) set to **Testnet**.

### 1. Smart contract

```bash
# From the repo root
cargo test -p apex-futures          # 29 tests should pass
stellar contract build              # -> target/wasm32v1-none/release/apex_futures.wasm
```

Deploy (constructor takes all config atomically — see
[`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md) for the full parameter
table, identities, and multisig guidance):

```bash
stellar contract optimize --wasm target/wasm32v1-none/release/apex_futures.wasm
stellar contract deploy \
  --wasm target/wasm32v1-none/release/apex_futures.optimized.wasm \
  --source deployer --network testnet \
  -- --admin <G...> --pauser <G...> --fee_collector <G...> \
     --usdc <USDC_SAC_C...> --oracle_updater <G...> \
     --init_base 10000000000000 --init_quote 50000000000000 \
     --config '{ ... }'
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local    # then fill in your deployed values
npm run dev                         # http://localhost:3000
```

Required environment variables (see [`.env.local.example`](frontend/.env.local.example)):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed `apex-futures` contract id |
| `NEXT_PUBLIC_USDC_SAC` | USDC Stellar Asset Contract id (collateral) |
| `NEXT_PUBLIC_NETWORK` | `TESTNET` or `PUBLIC` |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon endpoint (balances) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase (mismatch detection) |
| `NEXT_PUBLIC_EXPLORER_URL` | Explorer base (e.g. stellar.expert testnet) |

### 3. Keepers (optional, testnet)

Reference oracle feeder and liquidation keeper scripts live in
[`scripts/`](scripts/README.md) — wire the feeder to your real GRC aggregation
endpoint for production.

---

## Development status

| Area | State |
|---|---|
| Contract (security, funding, fees, solvency) | Hardened, 28 unit + 1 property/fuzz test green, ~28 KB WASM |
| Property-based fuzzing (solvency invariants) | `proptest` harness in `contracts/apex-futures/src/fuzz.rs` |
| Governance timelock (config + upgrade) | Two-phase propose/execute with exit window |
| CI/CD | GitHub Actions: fmt · clippy · test · build · frontend typecheck/build |
| Frontend (design system, multi-wallet, trade UI) | Complete; `tsc` + `next build` green |
| Repo | Consolidated — single source of truth |
| Testnet deploy + e2e | Verified on testnet |
| External audit, multisig custody, monitoring | Roadmap (pre-mainnet) |

Docs: [`OPERATIONS.md`](OPERATIONS.md) is the business + technical operating
handbook; [`SECURITY.md`](SECURITY.md) is the threat model and pre-audit scope;
[`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md) is the mainnet-readiness
checklist.

---

## License

Testnet / research software provided as-is. See repository for details.

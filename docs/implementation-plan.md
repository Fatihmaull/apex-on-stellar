# APEX — Implementation Plan: Tokenized Compute Marketplace

Self-contained execution plan for the next phase: a role-based, two-sided
tokenized-compute marketplace layered on top of the **already-live** APEX
futures/index exchange. Written to be handed to a fresh agent — it assumes no
prior chat context.

**Status of what exists (do not rebuild):**
- `contracts/apex-futures/` — vAMM futures + apex-index index, oracle (SEP-40 + TWAP),
  RBAC, timelock governance, insurance fund, solvency invariant, 29 tests. **LIVE on
  testnet:** `CDVCBYSD3D2AMH3EDCSCUONVREWDWIOEDJFZSWKQIJNH52TP6S7VDKCC`.
- `frontend/` — Next.js 14, ornn-style monochrome UI, multi-wallet (Stellar Wallets
  Kit), live on-chain index on landing, `/trade` terminal. `.env.local` points at the
  live contract. Tx status read via raw RPC (protocol-27 safe).
- USDC (testnet): custom test SAC `CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL`.

**Golden rules:** plan is MVP-first, cash-settled, testnet. Keep every new
privileged path behind the same RBAC + timelock patterns already in `apex-futures`.
Preserve a solvency invariant on every new vault. Label mock vs real.

---

## 1. Canonical unit — the maturity basis

**`1 CU = 1 H100-SXM-80GB-equivalent GPU-hour (HEH)`.** This is the atomic unit of
account for the entire platform going forward. All CU quantities are i128 at 7-dp
fixed point (SCALE = 10^7), matching the rest of the system.

**Normalization table** (coefficient vs. H100 baseline = 1.0000000, i.e. `1*SCALE`).
Stored on-chain, governance-managed, oracle-updatable. Seed values (tune later):

| GPU model        | key (Symbol) | coefficient (×SCALE) |
|------------------|--------------|----------------------|
| H100 SXM 80GB    | `H100`       | 10000000 (1.00)      |
| H200             | `H200`       | 14000000 (1.40)      |
| B200             | `B200`       | 25000000 (2.50)      |
| GB200 (per GPU)  | `GB200`      | 35000000 (3.50)      |
| A100 80GB        | `A100`       | 6000000  (0.60)      |
| RTX 4090         | `RTX4090`    | 3500000  (0.35)      |

- A provider listing `q` GPUs of model `m` for `h` hours contributes
  `q * h * coeff(m)` CU (in HEH).
- Methodology note (document, don't hardcode logic): coefficients derived from a
  fixed reference benchmark (BF16 training throughput + memory-bandwidth). Store only
  the resulting coefficient; recompute off-chain, update via governance.
- Quality/SLA dimension is metadata on each series (VRAM, interconnect, uptime SLA);
  MVP does not price it, but the field must exist so future tranching is additive.

**Deliverable:** `docs/cu-spec.md` — the formal CU/HEH spec + coefficient methodology
+ SLA schema. (New agent: write this first; it is referenced by contracts + UI.)

---

## 2. Token architecture (the "stock market" model)

Three tiers, mirroring equities:

| Tier | Analogy | What it is |
|------|---------|-----------|
| Per-provider CU series | Individual stock (emiten) | Each verified provider issues a CU series backed by *their* verified capacity. Symbol e.g. `CU-<PROVIDER>`. |
| Brand/type sub-index | Sector ETF | Composite of series filtered by GPU brand/type, e.g. `CUNVDA` (Nvidia providers), `CU-H100`. |
| Broad index | IHSG / S&P | `CU-INDEX` — the whole verified market at H100-equiv spec. This is the apex-index, already live as a price; here it also becomes buyable. |

**Recommended on-chain representation (MVP):** a single **multi-asset ledger
contract** (ERC-1155-style) rather than deploying one SAC per provider (cheaper, no
N-deploys). One `series_id` per provider CU series; index shares are their own
`series_id`.

> Trade-off to record: multi-asset ledger = simplest + cheapest, but tokens are not
> natively visible in wallets. Future option (post-MVP): mint each series as its own
> SAC for wallet-native display. Keep the ledger interface abstract so this can swap.

**Index mechanics (MVP = pooled NAV vault, ETF-like):**
- `CU-INDEX` / `CUNVDA` are **basket vaults**. Buyers deposit USDC → receive index
  shares priced at **NAV = composite CU price** (from the oracle/apex-index, weighted by
  constituent series). Redeem shares → USDC at current NAV (cash-settle).
- Composite price = capacity-weighted average of constituent series' reference prices
  (oracle-published per series, defaulting to apex-index × series coefficient).
- Sub-index (CUNVDA) = same vault contract, different constituent filter/weight set.

**Per-provider spot mechanics (MVP):** provider lists CU at an ask price (or a simple
per-series constant-product pool reusing `vamm.rs` math). Buyer swaps USDC↔CU-series.
Recommend **fixed provider ask + escrow swap** for MVP simplicity; note per-series
vAMM as the richer alternative.

---

## 3. On-chain: new workspace crate `contracts/apex-marketplace/`

New crate, workspace member. Reuse `apex-futures` patterns verbatim: `errors.rs`
(`#[contracterror]`), `events.rs`, RBAC in `admin.rs`, timelock, TTL helpers,
`storage.rs` typed keys, checked fixed-point math, solvency asserts in tests.

### Modules

```
contracts/apex-marketplace/src/
├── lib.rs            # entrypoints + dispatch
├── errors.rs         # typed errors (stable codes)
├── events.rs         # structured events for every state change
├── admin.rs          # RBAC (admin/verifier/oracle), pause, timelock reuse
├── registry.rs       # provider registration, KYB/DD status, capacity, collateral
├── normalization.rs  # GPU coefficient table (get/set, governance-gated)
├── cu_token.rs       # multi-asset ledger: balances[(series, holder)], mint/burn/transfer
├── series.rs         # CU series metadata (provider, gpu_model, spec/SLA, capacity, price)
├── index_pool.rs     # basket vaults (CU-INDEX, sub-indices): deposit/redeem at NAV
├── settlement.rs     # cash-settle redemption at oracle price; solvency accounting
├── redemption.rs     # real-compute-access boilerplate (mock adapter + interface)
├── storage.rs        # DataKey enum, getters/setters, TTL
├── test.rs           # unit + solvency tests
└── fuzz.rs           # proptest: vault solvency invariant across random ops
```

### Key types (sketches — finalize during build)

```rust
// registry.rs
enum ProviderStatus { Pending, Approved, Suspended }
struct Provider {
    owner: Address,
    status: ProviderStatus,
    collateral: i128,          // USDC posted, slashable
    capacity_cu: i128,         // verified max CU they may mint (HEH)
    minted_cu: i128,           // currently outstanding
    metadata_hash: BytesN<32>, // hash of off-chain DD docs (KYB, proof-of-capacity)
}

// series.rs
struct Series {
    provider: Address,
    gpu_model: Symbol,   // key into normalization table
    coefficient: i128,   // snapshot at creation (HEH per GPU-hour)
    spec_hash: BytesN<32>, // VRAM/interconnect/SLA doc hash
    ask_price: i128,     // USDC per CU (7dp); provider-set for spot
    active: bool,
}

// cu_token.rs  (multi-asset ledger)
fn balance(series: u64, holder: Address) -> i128;
fn mint(env, series: u64, to: Address, amount: i128);   // registry-gated
fn burn(env, series: u64, from: Address, amount: i128);
fn transfer(env, series: u64, from: Address, to: Address, amount: i128);
```

### Entrypoints (grouped)

- **Governance/admin:** `__constructor(admin, verifier, oracle, usdc, timelock)`,
  `set_coefficient(model, coeff)` (timelocked), `set_verifier`, `pause/unpause`,
  timelocked `set_config`, RBAC setters — all mirroring `apex-futures`.
- **Provider lifecycle:** `register_provider(owner, metadata_hash)` →
  `post_collateral(from, amount)` → `approve_provider(verifier, owner, capacity_cu)`
  (verifier/admin only) → `create_series(owner, gpu_model, qty, spec_hash, ask_price)`
  → `mint_cu(owner, series, amount)` (≤ capacity) → `set_ask(owner, series, price)` →
  `slash_provider(admin, owner, amount)` (on proven non-delivery → insurance).
- **Trader spot:** `buy_cu(buyer, series, amount, max_cost)` (USDC→CU escrow swap),
  `sell_cu(seller, series, amount, min_proceeds)`, `redeem_cu(holder, series, amount)`
  → cash-settle at oracle price (see §4).
- **Index:** `create_index(admin, symbol, constituents[])`,
  `buy_index(buyer, symbol, usdc_amount)` → shares at NAV,
  `redeem_index(holder, symbol, shares)` → USDC at NAV,
  `get_index_nav(symbol) -> i128`.
- **Reads:** `get_provider`, `get_series`, `list_series`, `get_coefficient`,
  `get_index_nav`, `get_buckets` (solvency), `cu_balance`.

### Solvency & accounting (mandatory)
- Same bucket discipline as futures: `usdc_vault == provider_collateral_total +
  index_pool_usdc + escrow_usdc + insurance_fund`. Assert after every op in tests +
  fuzz. Cash-settle payouts capped by pool/insurance.

---

## 4. Redemption — cash-settle now, real-access boilerplate

MVP redemption = **cash-settle**: `redeem_cu` burns CU and pays USDC at the oracle
CU price (from `apex-futures` oracle / apex-index × coefficient), debited from the
provider's collateral or the index pool. This is fully implementable now.

**Boilerplate for real compute access (build the seam, mock the backend):**

```rust
// redemption.rs — the interface mainnet will implement for real
trait ComputeAccessProvider {
    // Reserve `amount` CU of `series` for `holder`; returns an off-chain voucher id.
    fn fulfill(env, series: u64, holder: Address, amount: i128) -> BytesN<32>;
}
// MVP: MockAccessProvider emits an event with a fake voucher id + logs intent.
// It does NOT provision compute; it proves the redemption path end-to-end.
```

- Add `redeem_cu_for_access(holder, series, amount)` that: burns CU, calls the
  (mock) `ComputeAccessProvider.fulfill`, emits `access_granted(voucher_id, holder,
  series, amount)`. On mainnet, swap the mock for a real adapter (SSH/API handoff,
  cloud-credit issuance, etc.) — contract interface unchanged.
- Frontend shows a "Redeem for compute (preview)" flow that surfaces the mock voucher
  + a clearly-labeled "Coming to mainnet" panel describing the real handoff.
- **Deliverable:** `docs/redemption-design.md` — the real-access architecture (proof
  of provisioning, dispute/slashing on non-delivery, SLA enforcement) so mainnet is a
  wiring job, not a redesign.

---

## 5. Off-chain verification (mock for MVP, real seam)

- **Due diligence / KYB:** MVP = an off-chain form (provider submits company/compute
  details + proof-of-capacity artifacts); an admin marks Approved on-chain via
  `approve_provider`. Store only a `metadata_hash` on-chain; docs live off-chain.
- **Proof-of-capacity (mock):** provider "runs" a benchmark → uploads a signed result
  (mocked JSON). Boilerplate a `scripts/attest-capacity.mjs` that produces/verifies a
  signed attestation, so mainnet can plug in real remote-attestation.
- **Collateral:** provider posts USDC (`post_collateral`); slashable on non-delivery.

---

## 6. Frontend

### 6.1 Role selection + dashboards
- New entry: `/app` (or a role gate) → choose **Provider** or **Trader**; persist
  choice (localStorage) + allow switching. Keep the current `/trade` terminal as the
  Trader's "Futures/Hedge" tab.

```
frontend/src/app/
├── app/page.tsx              # role selection
├── provider/                 # Provider dashboard
│   ├── page.tsx              # overview: status, collateral, capacity, series, revenue
│   ├── register/page.tsx     # registration + due-diligence form (off-chain submit)
│   └── series/page.tsx       # create/manage CU series, set ask, mint
└── trade/
    ├── page.tsx              # existing futures terminal (keep)
    ├── market/page.tsx       # spot marketplace: browse per-provider series + sub-indices
    └── index/page.tsx        # CU-INDEX / CUNVDA index detail + buy/redeem
```

### 6.2 Provider dashboard (build order)
1. Register + DD form (name, GPU inventory by model/qty, region, SLA, upload proofs → hash).
2. Status view (Pending/Approved/Suspended, verified capacity, collateral, slash history).
3. Series management: create series (pick GPU model → coefficient auto-fills), set ask
   price, mint CU (≤ capacity), view outstanding + revenue.

### 6.3 Trader dashboard (build order)
1. Marketplace grid: cards per series (provider, GPU model, spec/SLA, ask, available CU),
   filter by brand/type. Buy/sell modal.
2. Index pages: `CU-INDEX` (IHSG-equivalent) + `CUNVDA` sector — show NAV (live), buy
   shares with USDC, redeem. Chart NAV vs apex-index.
3. Portfolio: CU holdings per series + index shares, redeem (cash-settle) + "redeem for
   compute (preview)".
4. Keep Futures/Hedge tab (existing) for hedging the index.

### 6.4 Shared frontend infra
- Extend `lib/contract.ts` with a marketplace client (mirror the typed reader/writer
  pattern; regenerate bindings from the new marketplace contract into
  `frontend/packages/apex-marketplace`).
- New env vars: `NEXT_PUBLIC_MARKETPLACE_ID`. Add to `env.ts` + `.env.local.example`.
- Reuse ui/ primitives + monochrome tokens as-is. Index board reuses `LiveIndex`/
  `IndexSection` patterns.

---

## 7. Phased task breakdown (execution order + acceptance)

| Phase | Deliverable | Acceptance |
|-------|-------------|-----------|
| **M1 Spec** | `docs/cu-spec.md`, `docs/redemption-design.md`, coefficient table | Reviewed; unit + table finalized |
| **M2 Registry+Normalization** | `apex-marketplace` crate: admin, registry, normalization, storage, errors, events | `cargo test`: register→collateral→approve→coefficients; RBAC + timelock covered |
| **M3 CU token + series + spot** | cu_token ledger, series, buy/sell escrow, solvency buckets | Tests: mint ≤ capacity, buy/sell conserves USDC, solvency invariant + fuzz green |
| **M4 Redemption (cash + mock access)** | settlement cash-settle, redemption mock adapter + interface | Tests: redeem burns CU + pays at oracle price; access mock emits voucher |
| **M5 Index pools** | index_pool NAV vault, CU-INDEX + CUNVDA, create/buy/redeem | Tests: NAV math, deposit/redeem conserves value, sub-index filter |
| **M6 Deploy + bindings** | deploy marketplace to testnet, seed a demo provider + series + index, regenerate bindings, wire env | On-chain smoke test all flows; `deployments.md` updated |
| **M7 Frontend: role + provider** | role gate, provider register/DD/series dashboards | Register→approve(admin)→mint→list works against testnet |
| **M8 Frontend: trader + index** | marketplace grid, index pages, portfolio, redeem preview | Buy series, buy index, redeem cash-settle, redeem-for-access preview |
| **M9 Demo polish** | align to `docs/video-outline.md` + `docs/pitch-outline.md`; record | 3-min demo: live futures (real) + marketplace/index (real testnet) + provider flow |

Each contract phase: `cargo fmt --check`, `clippy -D warnings`, tests green, wasm
builds. Each frontend phase: `tsc --noEmit` + `next build` green. One PR per phase
(matches existing workflow); CI must pass before merge.

---

## 8. Integration with existing `apex-futures`

- **Oracle/index reuse:** marketplace reads the apex-index price from the futures oracle
  (or a shared oracle) for CU pricing/NAV. Do NOT duplicate the oracle; either
  cross-call `apex-futures.get_oracle_price` or extract a shared oracle contract
  (decide in M2 — cross-call is simpler for MVP).
- **Insurance fund:** slashing on provider non-delivery should credit an insurance
  bucket (marketplace-local for MVP; unify with futures later).
- **Futures as the hedge for CU holders:** a trader holding CU spot can short the
  index on the existing exchange — document this as the flywheel; no new code.

---

## 9. Open decisions (flag to user before/while building)

1. **Oracle sharing:** cross-call futures oracle vs. extract shared oracle crate.
   (Rec: cross-call for MVP.)
2. **Per-series pricing:** fixed provider ask + escrow (simple) vs. per-series vAMM
   (richer price discovery). (Rec: fixed ask for MVP, vAMM later.)
3. **Index backing:** synthetic NAV vault (cash-settled, no constituent custody) vs.
   true ETF holding constituent CU. (Rec: synthetic NAV vault for MVP.)
4. **Wallet-native tokens:** multi-asset ledger (MVP) vs. SAC-per-series (future).
5. **Verifier role:** who approves providers on testnet — the existing admin, or a new
   `verifier` RBAC principal. (Rec: new `verifier` role, admin can override.)

---

## 10. Risks / notes

- **Solvency is the crown jewel** — every USDC-holding path (escrow, index pool,
  collateral) must be covered by an invariant test + fuzz, exactly like futures.
- **Don't overbuild the index** — MVP synthetic NAV is enough to demo "IHSG for
  compute"; true ETF creation/redemption is post-MVP.
- **Keep mock vs real explicit in UI** — provider verification + real-compute
  redemption are mocked; label them "preview / mainnet" so the demo stays honest.
- **CU/HEH is the maturity basis** — resist per-feature unit drift; everything
  (index, futures, spot, redemption) prices in CU = H100-equiv GPU-hour.
```

# APEX Compute Unit (CU) Specification

**Status:** MVP canonical — referenced by `contracts/apex-marketplace` and the frontend.
**Companion:** [`implementation-plan.md`](./implementation-plan.md), [`redemption-design.md`](./redemption-design.md).

This document defines the **maturity basis** for the entire APEX stack: index,
futures, spot marketplace, and redemption all price and settle in CU.

---

## 1. Definition

```
1 CU  =  1 HEH  =  1 H100-SXM-80GB-equivalent GPU-hour
```

| Symbol | Meaning |
|--------|---------|
| **CU** | Compute Unit — the on-chain / product name |
| **HEH** | H100-Equivalent Hour — the physical maturity unit |
| **ACPI** | APAC Compute Price Index — oracle price of **1 CU** in USDC |

**Why GPU-hour (not FLOPs / tokens):** meterable, workload-agnostic (training and
inference), and how the physical rental market already bills. Heterogeneous
hardware is mapped onto this baseline via a published coefficient table (§3).

### Fixed-point encoding

Matches `apex-futures` (`SCALE = 10_000_000`):

| Quantity | Type | Encoding |
|----------|------|----------|
| CU amount | `i128` | 7 decimal places; `1 CU = 10_000_000` |
| USDC amount | `i128` | 7 decimal places (Stellar USDC convention) |
| Coefficient | `i128` | ×`SCALE`; H100 baseline = `10_000_000` (1.0) |
| Price (USDC / CU) | `i128` | 7 decimal places |

All arithmetic uses checked mul/div; contract code must use the same
`mul_div_floor` / `mul_div_ceil` helpers as futures.

---

## 2. Token tiers (“stock market” model)

| Tier | Analogy | Symbol pattern | On-chain form (MVP) |
|------|---------|----------------|---------------------|
| Per-provider series | Individual stock (emiten) | `CU-<PROVIDER>` | Multi-asset ledger `series_id` |
| Brand / type sub-index | Sector ETF | `CUNVDA`, `CU-H100` | Synthetic NAV vault share (`series_id`) |
| Broad index | IHSG / S&P | `CU-INDEX` | Synthetic NAV vault share (`series_id`) |

- **One multi-asset ledger contract** holds all series balances — no N SAC
  deploys. Interface (`balance` / `mint` / `burn` / `transfer`) stays abstract so
  a future SAC-per-series path can replace the ledger without product changes.
- **ACPI** today is a **price feed** (USDC per CU). In the marketplace, `CU-INDEX`
  also becomes a **buyable** share at NAV derived from that price (§5).

Capacity contribution formula (provider listing):

```
CU_mintable = q × h × coeff(model)
```

where `q` = GPU count, `h` = hours offered, `coeff(model)` = table value in §3
(already scaled; result stays in 7-dp `i128`).

---

## 3. Normalization coefficient table

Stored **on-chain** in `normalization` storage, **governance-managed**
(timelocked `set_coefficient`). Seed values for MVP / demo:

| GPU model | Symbol key | Coefficient (human) | On-chain (`× SCALE`) |
|-----------|------------|---------------------|----------------------|
| H100 SXM 80GB | `H100` | 1.00 | `10_000_000` |
| H200 | `H200` | 1.40 | `14_000_000` |
| B200 | `B200` | 2.50 | `25_000_000` |
| GB200 (per GPU) | `GB200` | 3.50 | `35_000_000` |
| A100 80GB | `A100` | 0.60 | `6_000_000` |
| RTX 4090 | `RTX4090` | 0.35 | `3_500_000` |

**Rules:**
- Unknown `Symbol` → reject series creation (do not default to 1.0).
- Coefficient at series creation is **snapshotted** onto the series struct so
  later table updates do not rewrite outstanding supply history. New mints may
  use the live table or require a new series — contract policy: **new series only**
  after a coeff change for that model (simplest audit story).
- Oracle / NAV default for a series without its own mark:
  `series_ref_price = ACPI × (coeff_snapshot / SCALE)`.

### 3.1 Methodology (off-chain; do not hardcode in contract)

Coefficients are derived from a **fixed reference benchmark**, then published.
Only the resulting coefficient is stored on-chain.

**Reference baseline:** NVIDIA H100 SXM 80GB, BF16 (or FP8-equivalent throughput
normalized to BF16) mixed training microbenchmark + memory-bandwidth weight.

**Seed weights (document for transparency; governance may revise):**

| Component | Weight | What it proxies |
|-----------|--------|-----------------|
| Sustained BF16 training throughput | 0.70 | Useful FLOPs delivery |
| Memory bandwidth | 0.30 | LLM / bandwidth-bound workloads |

```
coeff(m) = 0.70 × (thru_m / thru_H100) + 0.30 × (bw_m / bw_H100)
```

Round to 2 decimal places for human display; store as `round(coeff × SCALE)`.

Recompute off-chain when new SKUs appear or vendor firmware shifts throughput;
update via **timelocked governance**, never via a hot oracle path.

**Out of scope for MVP pricing:** interconnect topology, multi-node all-reduce,
power efficiency, and SLA quality. Those live in series metadata (§4) for later
tranching — additive, not a fork of CU.

---

## 4. Series SLA / spec schema

On-chain the series stores a **`spec_hash: BytesN<32>`** (SHA-256 of the
canonical JSON below). Full document lives off-chain (IPFS / app storage);
contracts never parse SLA fields.

### 4.1 Canonical JSON (`ComputeSeriesSpec` v1)

```json
{
  "schema": "apex.compute_series_spec.v1",
  "gpu_model": "H100",
  "vram_gb": 80,
  "interconnect": "NVLink",
  "region": "SG-JH",
  "uptime_sla_bps": 9900,
  "delivery_window_hours": 24,
  "notes": "optional free text"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `schema` | string | Must be `apex.compute_series_spec.v1` for MVP |
| `gpu_model` | string | Must match a normalization `Symbol` key |
| `vram_gb` | u32 | Per-GPU VRAM |
| `interconnect` | string | e.g. `NVLink`, `PCIe`, `InfinityFabric` |
| `region` | string | Free-form APAC region code |
| `uptime_sla_bps` | u32 | Basis points; `9900` = 99.00% |
| `delivery_window_hours` | u32 | Max hours to fulfill access redemption (mainnet) |
| `notes` | string | Optional |

**Hashing:** UTF-8 JSON, keys sorted alphabetically at each object level, no
insignificant whitespace — same canonicalization the frontend must use before
calling `create_series`. Document any library used in `scripts/` when added.

### 4.2 What MVP prices vs. displays

| Dimension | On-chain effect (MVP) | UI |
|-----------|------------------------|-----|
| `coeff(gpu_model)` | Mints / capacity / default price | Shown |
| VRAM / interconnect / region / SLA | Metadata only (`spec_hash`) | Filter + badge |
| Quality tranche price | **Not priced** | Roadmap |

---

## 5. Pricing & products in CU

| Product | Unit | Price source (MVP) |
|---------|------|--------------------|
| Futures / ACPI board | 1 CU | `apex-futures` oracle (SEP-40 + TWAP risk price) |
| Per-provider spot | 1 CU of series | Provider **fixed ask** (USDC/CU); escrow swap |
| Cash redeem | 1 CU burned | Oracle CU price (ACPI × coeff for series path; ACPI for index) |
| Index share | 1 share ≈ claim on NAV | Synthetic NAV ≈ capacity-weighted CU composite |

**Open decisions locked for MVP** (see implementation plan §9):

1. Oracle: **cross-call** futures (do not duplicate).
2. Spot: **fixed ask + escrow**, not per-series vAMM.
3. Index: **synthetic NAV vault** (cash in/out), not true ETF custody of CU.
4. Tokens: **multi-asset ledger**.
5. Approvals: dedicated **`verifier`** RBAC role (admin override allowed).

---

## 6. Provider capacity & collateral (CU accounting)

```
minted_cu  ≤  capacity_cu     for each provider
capacity_cu = verified HEH from KYB / proof-of-capacity (off-chain attest)
```

- Collateral is USDC (slashable), posted on-chain; amount policy is economic,
  not part of the CU definition.
- Slashing credits the marketplace insurance bucket; does not change the CU
  definition — it backs delivery promises.

---

## 7. Invariants (spec-level)

Contracts and tests must uphold:

1. **Unit consistency** — every quantity labeled CU is HEH at H100 baseline after
   coefficients; no second unit of account on the marketplace.
2. **Conservation** — mint increases `minted_cu` and ledger supply together;
   burn decreases both; redeem cash or access always burns.
3. **Solvency** (USDC side) — vault buckets balance after every op (see
   implementation plan §3); cash-settle payouts capped by collateral / pool /
   insurance as coded.
4. **Governance** — coefficient table and privileged roles only via RBAC +
   timelock patterns from `apex-futures`.

---

## 8. Acceptance checklist (M1)

- [x] `1 CU = 1 HEH` locked; SCALE = 10^7 documented
- [x] Seed coefficient table with Symbol keys and on-chain integers
- [x] Off-chain methodology described (not in contract logic)
- [x] SLA / spec JSON schema + `spec_hash` convention
- [x] MVP pricing decisions recorded for implementers
- [ ] Peer review before M2 merges registry/normalization against this table

---

## 9. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-14 | Initial M1 lock from implementation plan |

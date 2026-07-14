# APEX Redemption Design

**Status:** MVP cash-settle live path + real-access **seam** (mock adapter).
**Companion:** [`cu-spec.md`](./cu-spec.md), [`implementation-plan.md`](./implementation-plan.md).

Goal: mainnet real-compute handoff is a **wiring job**, not a protocol redesign.
MVP ships cash settlement end-to-end and proves the access path with a mock
provider that emits vouchers but does not provision GPUs.

---

## 1. Two redemption modes

| Mode | Entrypoint | Effect on CU | Payout / result | MVP |
|------|------------|--------------|-----------------|-----|
| **Cash-settle** | `redeem_cu` | Burn | USDC at oracle CU price | **Real** |
| **Compute access** | `redeem_cu_for_access` | Burn | Voucher id + event; mock fulfill | **Mock + interface** |

Both modes require an approved series, sufficient holder balance, and a non-paused
contract. Access mode is always explicitly labeled in the UI as
**“Redeem for compute (preview) — Coming to mainnet”**.

---

## 2. Cash-settle (implement fully in M4)

### 2.1 Price

```
payout_usdc = amount_cu × oracle_cu_price / SCALE
```

- **Per-provider series:** prefer series reference price =
  `ACPI × (series.coefficient / SCALE)` when no dedicated series mark exists
  (see [cu-spec.md](./cu-spec.md) §3).
- **Oracle source (MVP):** cross-call `apex-futures` fresh / risk price — same
  staleness and deviation guards as futures risk paths. Do not accept stale
  oracle for redemption (reject with typed error).
- Fees (optional MVP): settlement fee in bps, routed to fee vault; document in
  config; default may be 0 on testnet demo.

### 2.2 USDC debit order

Debit in order until filled; excess shortfall → fail the tx (no partial burn):

1. Provider collateral bucket (for that series’ provider), then
2. Marketplace insurance fund, then
3. (Index shares use index pool USDC only — see §2.3)

Solvency invariant after settle (same discipline as futures):

```
usdc_vault == provider_collateral_total
           + index_pool_usdc
           + escrow_usdc
           + insurance_fund
           (+ fee_vault if tracked)
```

### 2.3 Index share redeem

`redeem_index` is **not** the same as `redeem_cu`, but shares the settlement
math: burn index shares → pay USDC at **NAV** (synthetic vault). NAV definition
lives in `index_pool` (M5); cash path still uses USDC from the index pool bucket
only.

### 2.4 Events

Emit structured events for indexers / demo:

- `cu_redeemed_cash(holder, series, amount_cu, usdc_paid, price)`
- Update provider `minted_cu` downward with the burn.

---

## 3. Compute-access seam

### 3.1 Trait (contract-facing)

```rust
/// Implemented by an on-chain adapter address (or in-crate mock for MVP).
/// Mainnet swaps the adapter; marketplace entrypoints stay stable.
trait ComputeAccessProvider {
    /// Reserve `amount` CU of `series` for `holder`.
    /// Returns an opaque off-chain voucher id (32 bytes).
    fn fulfill(
        env: Env,
        series: u64,
        holder: Address,
        amount: i128,
    ) -> BytesN<32>;
}
```

### 3.2 Marketplace flow — `redeem_cu_for_access`

1. Authenticate `holder`.
2. Validate amount > 0, series active, balance ≥ amount.
3. **Burn** CU (ledger + provider `minted_cu`).
4. Call `ComputeAccessProvider.fulfill(...)`.
5. Emit `access_granted(voucher_id, holder, series, amount, ts)`.
6. Persist optional mapping `voucher_id → {holder, series, amount, status}` if
   needed for dispute hooks later (MVP may event-only).

**Important:** burning happens **before** fulfill in the same transaction so the
adapter cannot leave CU outstanding without a voucher. If `fulfill` panics, the
whole tx reverts (CU restored).

### 3.3 MVP: `MockAccessProvider`

- In-crate or dedicated mock address deployed with marketplace.
- `fulfill` generates `voucher_id = hash(series || holder || amount || nonce)`
  (or ledger sequence-based), stores nothing off-chain, emits the same events.
- Does **not** talk to clouds, SSH, or APIs.
- Frontend shows voucher hex + copy + “preview only” panel.

### 3.4 Mainnet adapter (target architecture)

Replace mock with a real adapter that still returns `BytesN<32>` on-chain and
finishes delivery off-chain:

| Adapter type | On-chain | Off-chain |
|--------------|----------|-----------|
| API credit | Emit voucher; credit account in provider console | Provider API |
| SSH / cluster handoff | Voucher binds to short-lived credential request | Secrets manager + bastion |
| Marketplace credit | Mint internal credit NFT/ledger row | Ops dashboard |

Credential material **never** goes on-chain. Only the voucher id and hashes of
proof artifacts.

---

## 4. Proof of provisioning (mainnet)

After fulfill, the provider (or trusted attest service) posts a
**delivery attestation** off-chain, optional hash on-chain for disputes:

```json
{
  "schema": "apex.delivery_attestation.v1",
  "voucher_id": "0x…",
  "series": 1,
  "holder": "G…",
  "amount_cu": "10000000",
  "started_at": 0,
  "ended_at": 0,
  "proof_uri": "https://…",
  "provider_sig": "…"
}
```

Within `delivery_window_hours` from the series spec ([cu-spec.md](./cu-spec.md)
§4), delivery must be attested or the holder can open a dispute.

**MVP:** no dispute UI; document only. Mock never requires attestation.

---

## 5. Dispute & slashing (mainnet design; stub hooks MVP)

```
non-delivery proven
  → slash_provider(admin/verifier, provider, amount)
  → USDC to insurance (and optionally partial cash compensation to holder)
```

| Step | Actor | Notes |
|------|-------|-------|
| Open dispute | Holder | References `voucher_id` + window expiry |
| Evidence | Both | Off-chain; hashes on-chain |
| Resolve | Verifier / admin (timelock for large slash) | |
| Slash | Admin path already in registry plan | Credits insurance |

MVP may expose `slash_provider` for demo of the insurance path **without** tying
it to an automated dispute state machine.

---

## 6. SLA enforcement (future)

Series `uptime_sla_bps` and `delivery_window_hours` are **metadata** on MVP.
Future tranching may:

- Adjust slash severity by SLA breach severity,
- Split series into quality tiers with different ask/NAV bands,

without changing the CU definition (still HEH). Cash-settle remains the escape
hatch when access cannot be fulfilled.

---

## 7. Frontend UX requirements

| Surface | Behavior |
|---------|----------|
| Portfolio → Redeem | Default: cash-settle; show oracle price + USDC estimate |
| Redeem for compute | Secondary CTA; badge **Preview / mainnet**; show mock voucher |
| Provider dashboard | List outstanding access vouchers (mock list empty or event-fed) |
| Honesty | Never claim live GPU provisioning on testnet demo |

Aligns with [`video-outline.md`](./video-outline.md): provider/access flows may be
hi-fi mock or labeled preview; cash-settle + futures trades when recorded should
be real testnet txs where the product supports them.

---

## 8. Off-chain verification seams (related)

Not redemption proper, but same “mock now / wire later” posture:

| Seam | MVP | Mainnet |
|------|-----|---------|
| KYB / DD | Form + `metadata_hash`; admin/verifier `approve_provider` | Real KYB vendor |
| Proof-of-capacity | `scripts/attest-capacity.mjs` mock signed JSON | Remote attestation / benchmark oracle |
| Collateral | Real USDC on testnet SAC | Same |

---

## 9. Module map

| File | Responsibility |
|------|----------------|
| `settlement.rs` | Cash-settle math, bucket debits, solvency asserts |
| `redemption.rs` | `ComputeAccessProvider` + mock; `redeem_cu_for_access` |
| `cu_token.rs` | Burn used by both paths |
| `registry.rs` | Collateral / slash for non-delivery |

---

## 10. Acceptance checklist (M1 design / M4 impl)

**M1 (this doc):**
- [x] Cash-settle price & debit order specified
- [x] `ComputeAccessProvider` interface + mock behavior specified
- [x] Mainnet proof / dispute / slash sketched
- [x] UI honesty rules stated

**M4 (implementation):**
- [ ] Tests: redeem burns CU + pays at oracle price; vault conserved
- [ ] Tests: access mock emits `access_granted` with voucher; burn on success
- [ ] Pause / stale oracle / insufficient collateral covered

---

## 11. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-14 | Initial M1 lock from implementation plan |

# APEX — Pitch Deck Outline

Working outline for the APEX pitch (investor / hackathon). ~12 slides. Keep the
tone institutional and minimal, matching the product (ornn-style). Each slide has
a one-line headline + the 2–4 supporting points to render.

> Ground rule: label clearly what is **LIVE** (on testnet today) vs **ROADMAP**.
> Judges/investors reward honesty + a working core over vaporware.

---

### 1 — Title / Hook
- **APEX — The foundation of the APAC compute market.**
- Sub: Standardize, price, hedge, and tokenize GPU compute. Settled in USDC on Stellar.
- Visual: the live apex-index index price ($/H100-hour), pulled on-chain.

### 2 — Problem
- Compute is the most important commodity of our lifetimes — but in APAC it trades like oil did a century ago.
- **Opaque pricing** (Singapore–Johor–Batam rates quoted privately).
- **No hedging** (operators eat depreciation risk; AI labs eat capacity-cost risk).
- **Illiquid capacity** (idle GPU hours can't be monetized quickly).

### 3 — Solution
- APEX is a **risk-management + price-discovery layer** for compute — not a data center.
- Three layers: **(1) apex-index index** → **(2) Futures exchange (hedge/trade)** → **(3) Tokenized CU marketplace (spot capacity)**.
- All on-chain, cash-settled in USDC, built for APAC.

### 4 — What is a CU? (the differentiator)
- **1 CU = 1 H100-equivalent GPU-hour (HEH)** — a standardized, verifiable, fungible unit of compute *delivery*.
- Heterogeneous hardware normalized to an H100-SXM-80GB baseline via a published coefficient table (H200 ≈ 1.4, B200 ≈ 2.5, GB200 ≈ 3.5, A100 ≈ 0.6…).
- Why GPU-hour (not FLOPs, not tokens): meterable, workload-agnostic (training *and* inference), and it's how the physical market already bills.
- The **apex-index** prices 1 CU; the **CU token** delivers 1 CU. Same unit, two products.

### 5 — How it works (two-sided market)
- **Providers** (anyone with compute): register → due-diligence/KYB → post collateral → tokenize *verified* capacity as CU.
- **Traders**: buy CU spot, or go long/short CU futures to hedge — settle in USDC.
- Backing: every CU token is backed by verified capacity + provider collateral; non-delivery is slashed (insurance fund).

### 6 — Live today (traction)
- **Deployed on Stellar testnet** — real contract, real transactions.
- Live apex-index index reading on-chain; vAMM futures (open/close/liquidate); USDC settlement; timelocked governance; solvency-by-construction (29 tests incl. fuzz).
- First confirmed end-to-end browser trade.

### 7 — Technology
- **Stellar / Soroban**: low fees, fast finality, native USDC (SAC).
- vAMM price discovery (no cold-start LPs), GRC oracle (staleness + deviation guards, SEP-40, TWAP risk price), RBAC + circuit breaker + 24–48h upgrade timelock.
- Solvency invariant enforced in property tests; CI/CD gating every change.

### 8 — Market (APAC focus)
- Sovereign-AI + data-localization tailwinds; Singapore–Johor–Batam Tier-2 build-out.
- Fragmented regional pricing → demand for an **APAC-specific** index (no US benchmark fits).
- TAM: regional GPU rental spend → derivatives + tokenized-capacity volume.

### 9 — Business model
- **Trading fee** 0.1% (open + close). **Funding admin cut** 10%.
- **Verification / listing fee** for providers; **settlement fee** on CU redemption.
- **Liquidation penalty** feeds the insurance fund. (Future: $APEX utility token — fee discounts, oracle staking.)

### 10 — Roadmap
- Now: index + exchange live.
- Next: role dashboards (Provider / Trader), provider registry + due-diligence, tokenized-CU issuance/redemption, spot marketplace.
- Later: multi-hardware indices, mainnet + audit + multisig, institutional liquidity.

### 11 — Why APEX wins
- ornn proved the model in the US with traditional clearing — **APEX is on-chain, decentralized, and APAC-native.**
- Working core + a credible, verifiable unit (CU/HEH) + a two-sided flywheel.

### 12 — Ask / Close
- The compute economy is here. **APEX is its APAC market.**
- The ask (grant / investment / pilot providers) + contact.

---

## Appendix slides (optional, keep in back pocket)
- CU normalization coefficient table (with reference benchmark methodology).
- Security model (solvency invariant, timelock, oracle hardening) — for technical judges.
- Provider due-diligence checklist (KYB, proof-of-capacity, collateral, SLA).

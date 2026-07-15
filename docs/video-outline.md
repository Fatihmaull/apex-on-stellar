# APEX — Demo Video Outline (3:00)

Target length **3:00**. Screen-recording of the live testnet app + a few motion
titles. Voiceover script beats below each segment. Show **real on-chain actions**
wherever possible; clearly mark roadmap mockups as "coming next".

Tone: calm, confident, institutional. Let the product breathe (ornn-style).

---

### 0:00–0:12 · Hook (title card → live index)
- On screen: black title → cut to the landing hero with the **live apex-index price ticking**.
- VO: "Compute is the most important commodity of our lifetimes. In Asia-Pacific, nobody can price it. APEX changes that."

### 0:12–0:35 · Problem
- On screen: the Problem section (opaque pricing / no hedging / illiquid capacity).
- VO: "GPU rental rates across Singapore, Johor and Batam are quoted in private. Operators carry depreciation risk, AI labs carry cost risk — and neither can hedge. There's no benchmark, no derivatives, no liquidity."

### 0:35–0:55 · Solution + what is a CU
- On screen: the apex-index index board (Index / Mark / Premium, live on-chain) + a simple CU explainer card.
- VO: "APEX standardizes compute into one unit — a CU: one H100-equivalent GPU-hour. We publish its price on-chain as the APAC Compute Price Index, and let anyone trade or hedge it."

### 0:55–1:15 · Role selection (live routes)
- On screen: role picker at `/app` — **Provider** vs **Trader**.
- VO: "Two sides. Providers with compute tokenize verified capacity. Traders buy it, or hedge it."

### 1:15–1:40 · Provider flow (testnet + honest labels)
- On screen: provider registration → due-diligence checklist (labeled mock KYB) → series mint.
- VO: "A provider registers, passes due diligence, posts collateral, and mints tokenized CUs — each one backed by real, verified compute."
- Note: if demo time is tight, keep this segment short; futures segment remains the proof.

### 1:40–2:30 · LIVE demo — trader hedges on-chain (the money shot)
- On screen (REAL): connect Freighter → deposit USDC → **open a long on the APAC GPU Index** → oracle price moves → PnL updates → **close** → confirmed tx on Stellar Explorer.
- Optional cut: `/trade/market` buy CU or `/trade/index` buy CU-INDEX (same testnet marketplace).
- VO: "Here it's live on Stellar testnet. Connect a wallet, deposit USDC, take a position on compute prices. The oracle moves, PnL settles, and every trade finalizes on-chain in seconds."
- Note: this is the segment that must be a real recording — it's our proof.

### 2:30–2:45 · Why Stellar + trust
- On screen: quick cuts — USDC settlement, timelock governance, solvency/tests, CI green.
- VO: "Native USDC, low fees, fast finality. Timelocked governance, an insurance fund, and a solvency invariant proven in tests — institution-grade, on-chain."

### 2:45–3:00 · Vision + close
- On screen: return to the hero; tagline card.
- VO: "The compute economy is here. APEX is its APAC market."
- End card: logo + testnet URL + contact.

---

## Production notes
- **Must be real recordings:** the 1:40–2:30 trading segment and the live index (0:12, 0:35). Everything else can be hi-fi mockups clearly framed as "next".
- Keep each on-screen number legible; the live apex-index price and a confirmed tx hash are the two credibility anchors.
- Music: minimal, low. No hype cuts — the restraint *is* the brand.
- Have a fallback screen recording of the trade in case live RPC is slow on demo day.
- Captions on (accessibility + muted autoplay).

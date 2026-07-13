# APEX Deployments

Live deployment records. Secrets are **not** stored here — identity secret keys
live in the local Stellar CLI keystore (`~/.config/stellar/identity/*.toml`).

---

## Testnet — 2026-07-13

Network: `Test SDF Network ; September 2015` · RPC `https://soroban-testnet.stellar.org`

### Contracts

| Contract | ID |
|---|---|
| **APEX Futures** | `CDESAH7V5QCU42CQXS2QZTDOOTNHEISLYZ7XPEYJVTSLIN3NQFOATZSY` |
| Test USDC (SAC) | `CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL` |

- Contract: https://stellar.expert/explorer/testnet/contract/CDESAH7V5QCU42CQXS2QZTDOOTNHEISLYZ7XPEYJVTSLIN3NQFOATZSY
- WASM hash: `74551fa9ff06c3fd5b35edc8dd780d93b954285dd6d27ae99c3d45c083a8a58e`

> **Test USDC** is a controlled asset issued by an identity we own (below) so we
> can mint to test accounts. It is **not** Circle USDC. Holders need a trustline
> to `USDC:<issuer>` before depositing.

### Roles / identities (public addresses)

| Role | CLI alias | Address |
|---|---|---|
| Admin / deployer | `apex-deployer` | `GC4F5IFO7NL6IFFW6ZDYWA4VOCBHIPEONQMTIGTPERBD2BIFFRCQZV56` |
| Pauser | `apex-pauser` | `GA4HEITUKOJUWUVDMM6NSVIBRCMJRXOAOCJ7MONPOQOA6HA3PJBY63QE` |
| Fee collector | `apex-fee-collector` | `GBG3ET5FN5GTNF42YPSYGMRD6JQO7BBX3WGXR3NFSBNNXCTD4OFIFLWE` |
| Oracle updater | `apex-oracle` | `GDMV3W5COYBUT4KHGNALFHXH3BZISD2E7JPDZKXD7KAXPMJQFZ6VE2TD` |
| USDC issuer | `apex-usdc-issuer` | `GBJPYV3OLTOPWJVYHIX4QFU733UXVGTE2NHTVT6TSR45PLQ2VLVNMUUI` |

### Constructor config (as deployed)

`init_base = 10000000000000` (1,000,000 × 1e7), `init_quote = 50000000000000`
(⇒ 5.00 USDC start price).

| Param | Value | Note |
|---|---|---|
| init_margin_bps | 2000 | 20% → 5× max leverage |
| maint_margin_bps | 1000 | 10% maintenance |
| trading_fee_bps | 10 | 0.1% |
| liq_penalty_bps | 500 | 5% |
| liq_reward_bps | 5000 | 50% to liquidator, rest to insurance |
| funding_interval | 3600 | 1h |
| funding_admin_cut_bps | 1000 | 10% of funding |
| max_funding_bps | 500 | **demo-loose** (tighten for real markets) |
| oracle_max_deviation_bps | 5000 | **demo-loose** (50%; tighten for real markets) |
| oracle_staleness | 86400 | **demo-loose** (24h; tighten for real markets) |
| min_position_size | 10000000 | 1.0 base unit |

> Oracle bands and staleness are intentionally loose so the in-app price
> simulator can drive PnL/liquidations during evaluation. Use the tighter values
> in `contracts/DEPLOYMENT.md` for a production market.

### Bootstrap state

- Insurance fund seeded: **10,000 USDC**.
- 100,000 test USDC minted to the deployer.

### On-chain verification (2026-07-13)

Full lifecycle exercised against the live contract:

| Step | Result |
|---|---|
| `deposit_margin` (2,000 USDC) | ✅ free margin credited |
| `open_position` (long 100 V-GPU) | ✅ margin locked, 0.1% fee to vault, mark moved, `open` event |
| `update_oracle` by `apex-oracle` | ✅ index 5.0 → 6.0 |
| `update_oracle` by unauthorized key | ✅ rejected `Error(Contract, #3)` Unauthorized |
| `close_position` | ✅ settled; round trip cost ≈ fees only; position zeroed |
| Solvency | ✅ vault backs total_collateral + fee_vault + insurance_fund |

### Frontend wiring

`frontend/.env.local` (gitignored) is set to the IDs above. To point a fresh
checkout at this deployment, copy `frontend/.env.local.example` → `.env.local`
and fill in `NEXT_PUBLIC_CONTRACT_ID` and `NEXT_PUBLIC_USDC_SAC` from this table.

### Reproduce a test trader

```bash
ISSUER=$(stellar keys address apex-usdc-issuer)
stellar keys generate apex-user1 --network testnet --fund
stellar tx new change-trust --line "USDC:$ISSUER" --source apex-user1 --network testnet
stellar contract invoke --id CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL \
  --source apex-usdc-issuer --network testnet -- \
  mint --to $(stellar keys address apex-user1) --amount 50000000000   # 5,000 USDC
```

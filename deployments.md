# APEX Deployments

Live deployment records. Secrets are **not** stored here — identity secret keys
live in the local Stellar CLI keystore (`~/.config/stellar/identity/*.toml`).

---

## Testnet — 2026-07-14 · Marketplace (CU spot + index)

| Contract | ID |
|---|---|
| **APEX Marketplace** | `CDAM76V2FX7Y26UATDY2FL4CZ3RMYBNXHZQSQP6X6DRFLVQLQPCKNY2F` |
| APEX Futures (oracle / ACPI) | `CDVCBYSD3D2AMH3EDCSCUONVREWDWIOEDJFZSWKQIJNH52TP6S7VDKCC` |
| Test USDC (SAC) | `CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL` |

- Contract: https://stellar.expert/explorer/testnet/contract/CDAM76V2FX7Y26UATDY2FL4CZ3RMYBNXHZQSQP6X6DRFLVQLQPCKNY2F
- WASM hash: `07f4d1a8c8aebf2c5316f555687f1630d1e4cda478108ce3dd5a2858f4ad238e`
- Roles: admin=`apex-deployer`, verifier=`apex-oracle`, pauser=`apex-pauser`
- Seeded: insurance 10,000 USDC; indices `CUINDEX` + `CUNVDA` (nav_factor=1.0)
- Demo series #1: H100 @ $5.20/CU, 50 CU inventory (provider = deployer)
- Frontend: set `NEXT_PUBLIC_MARKETPLACE_ID` (see `.env.local.example`)

---

## Testnet — 2026-07-13 (current · Phase D timelock build)

Network: `Test SDF Network ; September 2015` · RPC `https://soroban-testnet.stellar.org`

This deployment is the `main` build **with timelocked governance** (new constructor
`timelock_delay`, `propose_*`/`execute_*`/`cancel_*` entrypoints). It **supersedes**
the initial Phase B contract `CDESAH7V…FOATZSY` (kept below for history).

### Contracts

| Contract | ID |
|---|---|
| **APEX Futures** | `CDVCBYSD3D2AMH3EDCSCUONVREWDWIOEDJFZSWKQIJNH52TP6S7VDKCC` |
| Test USDC (SAC) | `CBTXNIAJASVEWFR7QRYGQXIMBVC2GB4FXZEICUCXCRMCO6UM4K3RZEDL` |

- Contract: https://stellar.expert/explorer/testnet/contract/CDVCBYSD3D2AMH3EDCSCUONVREWDWIOEDJFZSWKQIJNH52TP6S7VDKCC
- WASM hash: `61d7f13d5fcb5fae33e1df5478715b5f16793b50abb9b49815ec33ab051fb743`
- Superseded contract (Phase B, no timelock): `CDESAH7V5QCU42CQXS2QZTDOOTNHEISLYZ7XPEYJVTSLIN3NQFOATZSY`

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
| **timelock_delay** | 300 | 5 min governance delay (demo-short; use 24–48h on mainnet) |

> Oracle bands and staleness are intentionally loose so the in-app price
> simulator can drive PnL/liquidations during evaluation. Use the tighter values
> in `contracts/DEPLOYMENT.md` for a production market.

### Bootstrap state

- Insurance fund seeded: **10,000 USDC**.
- 100,000 test USDC minted to the deployer.

### On-chain verification (2026-07-13, current contract)

Verified live against `CDVCBYSD…DKCC`:

| Step | Result |
|---|---|
| Constructor state | ✅ `get_timelock_delay` = 300, mark = index = 5.0, `is_paused` = false |
| `seed_insurance` (10,000 USDC) | ✅ `insurance_fund` = 100000000000, `transfer`+`insurance` events |
| `update_oracle` by `apex-oracle` | ✅ index 5.0 → 5.5 → 5.0, `oracle` event |
| Timelock: `propose_upgrade` (admin) | ✅ `get_pending_upgrade` returns hash + eta |
| Timelock: `cancel_upgrade` (admin) | ✅ `get_pending_upgrade` = null |

The full trading lifecycle (deposit → open → close → liquidate) was validated on
the predecessor contract in Phase B and is unchanged; the delta here is the
timelocked governance, verified above.

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

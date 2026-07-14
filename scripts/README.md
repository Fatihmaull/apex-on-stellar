# APEX Keeper Scripts

Off-chain helpers for running the exchange on testnet.

| Script | Purpose |
|--------|---------|
| `oracle-feeder.mjs` | Periodically pushes an APAC GPU Index price to `update_oracle`. |
| `liquidation-keeper.mjs` | Polls open positions' health factor and calls `liquidate` on underwater ones. |
| `attest-capacity.mjs` | Mock proof-of-capacity sign/verify (HMAC). Mainnet swaps for real attestation. |

## Capacity attestation (marketplace)

```bash
node scripts/attest-capacity.mjs sign --provider G... --model H100 --qty 8 --hours 720
node scripts/attest-capacity.mjs verify --file attestation.json
```

Optional: `APEX_ATTEST_SECRET` overrides the mock HMAC key.

## Setup

```bash
cd scripts
npm init -y
npm install @stellar/stellar-sdk
```

Environment variables (or a `.env` you source):

```bash
export APEX_CONTRACT_ID=CD...              # deployed contract id
export APEX_RPC_URL=https://soroban-testnet.stellar.org
export APEX_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export ORACLE_SECRET=S...                  # oracle_updater secret key
export KEEPER_SECRET=S...                  # liquidator secret key
```

## Run

```bash
node oracle-feeder.mjs           # every 60s, pushes a (mock/GRC) index price
node liquidation-keeper.mjs GABC... GDEF...   # watch a list of trader addresses
```

Both are intentionally small, dependency-light references — wire the oracle
feeder to your real GRC aggregation endpoint and feed the keeper a live set of
open-position addresses (from the contract's `open`/`close` events) for
production use.

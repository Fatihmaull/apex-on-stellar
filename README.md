# APEX: APAC Compute Exchange 🚀

APEX is a decentralized, cash-settled compute futures exchange developed for the **APAC Stellar Hackathon (DeFi & Liquidity Track)**. It utilizes a **Virtual Automated Market Maker (vAMM)** model to enable leverage-based trading of virtual GPU/compute hours, settling exclusively in USDC via the Stellar Asset Contract (SAC).

---

## 🌟 Key Features

1. **Compute Power Futures**: Buy/sell virtual base compute units (representing GPU hours, e.g. H100 GPU compute indexes) on leverage.
2. **Virtual Automated Market Maker (vAMM)**: Zero-liquidity-provider requirement. Trade virtual compute contracts directly against a constant product ($x \cdot y = k$) virtual price discovery model.
3. **Cash Settlement in USDC**: Positions are funded, collateralized, and settled exclusively using USDC through the Soroban token interface (SAC).
4. **Decentralized Oracles**: Authorized index administrators feed verified GPU spot index prices (e.g. from GRC networks) to compute futures mark prices.
5. **Robust Liquidation System**: Liquidators can close underwater positions (health factor < 1.0) and receive a 5% liquidation bounty from the slashed margin.

---

## 📁 Repository Structure

```
apex-compute-exchange/
├── README.md                  # This file
├── .gitignore                 # Root gitignore
├── contracts/                 # Soroban Smart Contracts (Rust)
│   ├── Cargo.toml             # Rust package configuration
│   └── src/
│       ├── lib.rs             # Contract entry point & public dispatch
│       ├── storage.rs         # Soroban storage abstractions
│       ├── margin.rs          # Margin account & health factor calculations
│       ├── vamm.rs            # Virtual AMM pricing and trading math
│       ├── oracle.rs          # Permissioned index feed
│       └── liquidation.rs     # Slashing logic
└── frontend/                  # Next.js Web Dashboard
    ├── package.json           # Frontend dependencies
    ├── next.config.js         # Next.js bundler settings
    └── src/
        ├── app/
        │   ├── page.tsx       # Main trading layout & dashboard view
        │   ├── layout.tsx     # Custom global font & HTML head wrapper
        │   └── globals.css    # Premium CSS design system (neon dark mode)
        ├── components/
        │   ├── WalletConnect.tsx    # Freighter connection button & active state
        │   ├── BalanceDisplay.tsx   # XLM / USDC balance display fetches
        │   ├── TradeForm.tsx        # Multi-leverage long/short order entry
        │   └── TransactionResult.tsx # StellarExpert receipt lookup & status messages
        ├── hooks/
        │   └── useSoroban.ts  # Wallet interface & smart contract hook
        └── lib/
            └── stellar.ts     # Stellar SDK transaction wrapper
```

---

## ⚙️ Setup & Deployment Instructions

### 1. Smart Contract Deployment (Local & Testnet)

#### Prerequisites
- Rust, Cargo, and `wasm32-unknown-unknown` target.
- Stellar CLI installed.

#### Local Development
1. **Build contracts**:
   ```bash
   cd contracts
   cargo build --target wasm32-unknown-unknown --release
   ```
2. **Run Local Sandbox Network**:
   ```bash
   stellar network add --global local \
     --rpc-url "http://localhost:8000/soroban/rpc" \
     --network-passphrase "Local Sandbox Stellar Network ; September 2022"
   
   stellar-sandbox --port 8000
   ```
3. **Deploy Contract**:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/apex_futures.wasm \
     --source admin \
     --network local
   ```

#### Testnet Setup
To deploy on Stellar Testnet:
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/apex_futures.wasm \
  --source your_funded_testnet_account \
  --network testnet
```

---

### 2. Frontend Development

#### Prerequisites
- Node.js (v18+)
- Freighter Wallet installed as a browser extension (configured to **Testnet**).

#### Installation
1. Go to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Create or configure a `.env.local` to point to the deployed contract address:
   ```env
   NEXT_PUBLIC_CONTRACT_ID="CAC_YOUR_DEPLOYED_CONTRACT_ID"
   NEXT_PUBLIC_USDC_ASSET_ID="CBG_TESTNET_USDC_SAC_ADDRESS"
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📸 Hackathon Demonstration Deliverables

Below are placeholders for the four required screenshots illustrating the successful integration and execution of user actions:

### 1. Wallet Connected State
*Screenshot demonstrating Freighter connection status, displaying the connected account's public key.*
<!-- [Wallet connected state] -->
![Wallet Connected State](./docs/screenshots/wallet_connected.png)

### 2. Balance Displayed
*Screenshot showing the user's active XLM balance and testnet USDC balance fetched via Horizon.*
<!-- [Balance displayed] -->
![Balance Displayed](./docs/screenshots/balance_displayed.png)

### 3. Successful Testnet Transaction
*Screenshot of the user signing and submitting a margin deposit / trade order on Stellar Testnet.*
<!-- [Successful testnet transaction] -->
![Successful Testnet Transaction](./docs/screenshots/successful_transaction.png)

### 4. Transaction Result Shown to User
*Screenshot of the transaction receipt showing the success status, transaction hash, and explorer link.*
<!-- [Transaction result shown to user] -->
![Transaction Result Shown to User](./docs/screenshots/transaction_result.png)

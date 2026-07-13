/**
 * Typed, centralized runtime configuration. All chain/contract addresses live
 * here (fed by NEXT_PUBLIC_* env vars) — nothing is hardcoded across the app.
 */

export type NetworkName = 'TESTNET' | 'PUBLIC';

function required(value: string | undefined, key: string, fallback?: string): string {
  const v = value ?? fallback;
  if (!v) {
    // Surface misconfiguration early in the console rather than failing silently.
    console.warn(`[apex/config] Missing env var ${key}; using empty value.`);
    return '';
  }
  return v;
}

export const ENV = {
  contractId: required(process.env.NEXT_PUBLIC_CONTRACT_ID, 'NEXT_PUBLIC_CONTRACT_ID'),
  usdcSac: required(process.env.NEXT_PUBLIC_USDC_SAC, 'NEXT_PUBLIC_USDC_SAC'),
  network: (process.env.NEXT_PUBLIC_NETWORK as NetworkName) || 'TESTNET',
  rpcUrl: required(
    process.env.NEXT_PUBLIC_RPC_URL,
    'NEXT_PUBLIC_RPC_URL',
    'https://soroban-testnet.stellar.org',
  ),
  horizonUrl: required(
    process.env.NEXT_PUBLIC_HORIZON_URL,
    'NEXT_PUBLIC_HORIZON_URL',
    'https://horizon-testnet.stellar.org',
  ),
  networkPassphrase: required(
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    'NEXT_PUBLIC_NETWORK_PASSPHRASE',
    'Test SDF Network ; September 2015',
  ),
  explorerUrl: required(
    process.env.NEXT_PUBLIC_EXPLORER_URL,
    'NEXT_PUBLIC_EXPLORER_URL',
    'https://stellar.expert/explorer/testnet',
  ),
} as const;

/** Fixed-point scale used throughout the contract (7 decimals). */
export const SCALE = 10_000_000;

export const explorerAccount = (address: string) => `${ENV.explorerUrl}/account/${address}`;
export const explorerTx = (hash: string) => `${ENV.explorerUrl}/tx/${hash}`;
export const explorerContract = (id: string) => `${ENV.explorerUrl}/contract/${id}`;

/**
 * APEX Marketplace client — typed reads/writes against apex-marketplace.
 * Mirrors `contract.ts`. When `NEXT_PUBLIC_MARKETPLACE_ID` is empty, reads
 * return demo fixtures so UI can be reviewed without a live deploy.
 */

import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { ENV, SCALE } from '../config/env';
import { readContract, buildContractCall } from './stellar';

const addr = (a: string) => nativeToScVal(a, { type: 'address' });
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const u64 = (n: bigint) => nativeToScVal(n, { type: 'u64' });
const sym = (s: string) => nativeToScVal(s, { type: 'symbol' });
const bytes32 = (hexOrZero: string) => {
  const clean = hexOrZero.replace(/^0x/, '');
  const buf = new Uint8Array(32);
  if (clean.length === 64) {
    for (let i = 0; i < 32; i++) buf[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return nativeToScVal(buf);
};

export const toFixed = (amount: number): bigint => BigInt(Math.round(amount * SCALE));
export const fromFixed = (raw: bigint | number | string): number => Number(raw) / SCALE;

export type ProviderStatus = 'Pending' | 'Approved' | 'Suspended';

export interface ProviderView {
  owner: string;
  status: ProviderStatus;
  collateral: number;
  capacityCu: number;
  mintedCu: number;
}

export interface SeriesView {
  id: number;
  provider: string;
  gpuModel: string;
  coefficient: number;
  askPrice: number;
  active: boolean;
  inventory: number;
}

export interface MarketplaceBuckets {
  providerCollateral: number;
  indexPoolUsdc: number;
  escrowUsdc: number;
  insuranceFund: number;
  feeVault: number;
}

const MID = () => ENV.marketplaceId;
export const marketplaceReady = () => Boolean(ENV.marketplaceId);

/** Demo fixture series when marketplace id is unset (honest "preview" mode). */
const DEMO_SERIES: SeriesView[] = [
  {
    id: 1,
    provider: 'GDEMO…NVDA',
    gpuModel: 'H100',
    coefficient: 1,
    askPrice: 5.2,
    active: true,
    inventory: 120,
  },
  {
    id: 2,
    provider: 'GDEMO…SG01',
    gpuModel: 'H200',
    coefficient: 1.4,
    askPrice: 6.8,
    active: true,
    inventory: 40,
  },
  {
    id: 3,
    provider: 'GDEMO…BATAM',
    gpuModel: 'A100',
    coefficient: 0.6,
    askPrice: 3.1,
    active: true,
    inventory: 200,
  },
];

export async function getCuOraclePrice(): Promise<number> {
  if (!marketplaceReady()) return 5;
  return fromFixed((await readContract<bigint>(MID(), 'get_oracle_price')) ?? 0n);
}

export async function getCoefficient(model: string): Promise<number> {
  if (!marketplaceReady()) {
    const table: Record<string, number> = {
      H100: 1,
      H200: 1.4,
      B200: 2.5,
      GB200: 3.5,
      A100: 0.6,
      RTX4090: 0.35,
    };
    return table[model] ?? 0;
  }
  return fromFixed(
    (await readContract<bigint>(MID(), 'get_coefficient', [sym(model)])) ?? 0n,
  );
}

export async function listSeries(): Promise<SeriesView[]> {
  if (!marketplaceReady()) return DEMO_SERIES;
  const ids = (await readContract<bigint[]>(MID(), 'list_series')) ?? [];
  const out: SeriesView[] = [];
  for (const id of ids) {
    const s = await readContract<{
      provider: string;
      gpu_model: string;
      coefficient: bigint;
      ask_price: bigint;
      active: boolean;
    }>(MID(), 'get_series', [u64(BigInt(id))]);
    const inv = await readContract<bigint>(MID(), 'get_inventory', [u64(BigInt(id))]);
    if (!s) continue;
    out.push({
      id: Number(id),
      provider: String(s.provider),
      gpuModel: String(s.gpu_model),
      coefficient: fromFixed(s.coefficient),
      askPrice: fromFixed(s.ask_price),
      active: s.active,
      inventory: fromFixed(inv ?? 0n),
    });
  }
  return out;
}

export async function getProvider(owner: string): Promise<ProviderView | null> {
  if (!marketplaceReady()) return null;
  try {
    const p = await readContract<{
      owner: string;
      status: { tag?: string } | number;
      collateral: bigint;
      capacity_cu: bigint;
      minted_cu: bigint;
    }>(MID(), 'get_provider', [addr(owner)]);
    if (!p) return null;
    const statusRaw = p.status;
    let status: ProviderStatus = 'Pending';
    if (typeof statusRaw === 'object' && statusRaw?.tag) {
      status = statusRaw.tag as ProviderStatus;
    } else if (statusRaw === 1) status = 'Approved';
    else if (statusRaw === 2) status = 'Suspended';
    return {
      owner: String(p.owner),
      status,
      collateral: fromFixed(p.collateral),
      capacityCu: fromFixed(p.capacity_cu),
      mintedCu: fromFixed(p.minted_cu),
    };
  } catch {
    return null;
  }
}

export async function cuBalance(seriesId: number, holder: string): Promise<number> {
  if (!marketplaceReady()) return 0;
  return fromFixed(
    (await readContract<bigint>(MID(), 'cu_balance', [u64(BigInt(seriesId)), addr(holder)])) ??
      0n,
  );
}

export async function getIndexNav(symbol: string): Promise<number> {
  if (!marketplaceReady()) return 5;
  return fromFixed(
    (await readContract<bigint>(MID(), 'get_index_nav', [sym(symbol)])) ?? 0n,
  );
}

export async function indexShares(symbol: string, holder: string): Promise<number> {
  if (!marketplaceReady()) return 0;
  return fromFixed(
    (await readContract<bigint>(MID(), 'index_shares', [sym(symbol), addr(holder)])) ?? 0n,
  );
}

export async function getBuckets(): Promise<MarketplaceBuckets> {
  if (!marketplaceReady()) {
    return {
      providerCollateral: 0,
      indexPoolUsdc: 0,
      escrowUsdc: 0,
      insuranceFund: 0,
      feeVault: 0,
    };
  }
  const b = await readContract<{
    provider_collateral_total: bigint;
    index_pool_usdc: bigint;
    escrow_usdc: bigint;
    insurance_fund: bigint;
    fee_vault: bigint;
  }>(MID(), 'get_buckets');
  return {
    providerCollateral: fromFixed(b?.provider_collateral_total ?? 0n),
    indexPoolUsdc: fromFixed(b?.index_pool_usdc ?? 0n),
    escrowUsdc: fromFixed(b?.escrow_usdc ?? 0n),
    insuranceFund: fromFixed(b?.insurance_fund ?? 0n),
    feeVault: fromFixed(b?.fee_vault ?? 0n),
  };
}

// --- Write builders (return unsigned XDR; caller signs via wallet) -----------

const call = (sender: string, method: string, args: xdr.ScVal[]) =>
  buildContractCall(sender, MID(), method, args);

export const buildRegisterProvider = (owner: string, metadataHashHex = '') =>
  call(owner, 'register_provider', [addr(owner), bytes32(metadataHashHex)]);

export const buildPostCollateral = (owner: string, amount: number) =>
  call(owner, 'post_collateral', [addr(owner), i128(toFixed(amount))]);

export const buildCreateSeries = (
  owner: string,
  gpuModel: string,
  askPrice: number,
  specHashHex = '',
) =>
  call(owner, 'create_series', [
    addr(owner),
    sym(gpuModel),
    bytes32(specHashHex),
    i128(toFixed(askPrice)),
  ]);

export const buildMintCu = (owner: string, seriesId: number, amount: number) =>
  call(owner, 'mint_cu', [addr(owner), u64(BigInt(seriesId)), i128(toFixed(amount))]);

export const buildSetAsk = (owner: string, seriesId: number, price: number) =>
  call(owner, 'set_ask', [addr(owner), u64(BigInt(seriesId)), i128(toFixed(price))]);

export const buildBuyCu = (
  buyer: string,
  seriesId: number,
  amount: number,
  maxCost: number,
) =>
  call(buyer, 'buy_cu', [
    addr(buyer),
    u64(BigInt(seriesId)),
    i128(toFixed(amount)),
    i128(toFixed(maxCost)),
  ]);

export const buildRedeemCu = (holder: string, seriesId: number, amount: number) =>
  call(holder, 'redeem_cu', [addr(holder), u64(BigInt(seriesId)), i128(toFixed(amount))]);

export const buildRedeemForAccess = (holder: string, seriesId: number, amount: number) =>
  call(holder, 'redeem_cu_for_access', [
    addr(holder),
    u64(BigInt(seriesId)),
    i128(toFixed(amount)),
  ]);

export const buildBuyIndex = (buyer: string, symbol: string, usdcAmount: number) =>
  call(buyer, 'buy_index', [addr(buyer), sym(symbol), i128(toFixed(usdcAmount))]);

export const buildRedeemIndex = (holder: string, symbol: string, shares: number) =>
  call(holder, 'redeem_index', [addr(holder), sym(symbol), i128(toFixed(shares))]);


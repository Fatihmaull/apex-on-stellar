import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { ENV, SCALE } from '../config/env';
import { readContract, buildContractCall } from './stellar';

// --- ScVal builders ----------------------------------------------------------

const addr = (a: string) => nativeToScVal(a, { type: 'address' });
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const bool = (b: boolean) => nativeToScVal(b, { type: 'bool' });

/** Convert a human decimal amount to the contract's 7-dp fixed-point i128. */
export const toFixed = (amount: number): bigint => BigInt(Math.round(amount * SCALE));
/** Convert a raw 7-dp fixed-point value to a JS number. */
export const fromFixed = (raw: bigint | number | string): number => Number(raw) / SCALE;

// --- Domain types ------------------------------------------------------------

export interface RawPosition {
  size: bigint;
  entry_price: bigint;
  margin_allocated: bigint;
  entry_funding: bigint;
}

export interface Position {
  size: number; // signed: + long, - short
  entryPrice: number;
  marginAllocated: number;
  isLong: boolean;
  isOpen: boolean;
}

export interface Reserves {
  base: number;
  quote: number;
}

export interface Buckets {
  totalCollateral: number;
  feeVault: number;
  insuranceFund: number;
}

export interface MarketSnapshot {
  markPrice: number;
  oraclePrice: number;
  reserves: Reserves;
  buckets: Buckets;
  funding: { cumulative: number; lastTs: number };
  paused: boolean;
  /** Initial-margin ratio in bps enforced on-chain (e.g. 2000 = 20% => fixed 5x). */
  initMarginBps: number;
}

// --- Reads -------------------------------------------------------------------

const CID = () => ENV.contractId;

export async function getMarkPrice(): Promise<number> {
  return fromFixed((await readContract<bigint>(CID(), 'get_mark_price')) ?? 0n);
}

export async function getOraclePrice(): Promise<number> {
  return fromFixed((await readContract<bigint>(CID(), 'get_oracle_price')) ?? 0n);
}

export async function getReserves(): Promise<Reserves> {
  const r = await readContract<{ base: bigint; quote: bigint }>(CID(), 'get_reserves');
  return { base: fromFixed(r?.base ?? 0n), quote: fromFixed(r?.quote ?? 0n) };
}

export async function getBuckets(): Promise<Buckets> {
  const b = await readContract<{
    total_collateral: bigint;
    fee_vault: bigint;
    insurance_fund: bigint;
  }>(CID(), 'get_buckets');
  return {
    totalCollateral: fromFixed(b?.total_collateral ?? 0n),
    feeVault: fromFixed(b?.fee_vault ?? 0n),
    insuranceFund: fromFixed(b?.insurance_fund ?? 0n),
  };
}

export async function getFunding(): Promise<{ cumulative: number; lastTs: number }> {
  const f = await readContract<[bigint, bigint]>(CID(), 'get_funding');
  return { cumulative: fromFixed(f?.[0] ?? 0n), lastTs: Number(f?.[1] ?? 0n) };
}

export async function isPaused(): Promise<boolean> {
  return (await readContract<boolean>(CID(), 'is_paused')) ?? false;
}

/** Initial-margin ratio (bps) from the live config — the source of truth for the
 *  fixed leverage the contract enforces (leverage = BPS_DENOM / init_margin_bps). */
export async function getInitMarginBps(): Promise<number> {
  const c = await readContract<{ init_margin_bps: bigint }>(CID(), 'get_config');
  return Number(c?.init_margin_bps ?? 2000n);
}

export async function getMarginBalance(user: string): Promise<number> {
  return fromFixed((await readContract<bigint>(CID(), 'get_margin_balance', [addr(user)])) ?? 0n);
}

export async function getHealthFactor(user: string): Promise<number> {
  return fromFixed((await readContract<bigint>(CID(), 'get_health_factor', [addr(user)])) ?? 0n);
}

export async function getPosition(user: string): Promise<Position> {
  const p = await readContract<RawPosition>(CID(), 'get_position', [addr(user)]);
  const size = fromFixed(p?.size ?? 0n);
  return {
    size,
    entryPrice: fromFixed(p?.entry_price ?? 0n),
    marginAllocated: fromFixed(p?.margin_allocated ?? 0n),
    isLong: size > 0,
    isOpen: size !== 0,
  };
}

/** Fetch all non-user market data in parallel. */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [markPrice, oraclePrice, reserves, buckets, funding, paused, initMarginBps] =
    await Promise.all([
      getMarkPrice(),
      getOraclePrice(),
      getReserves(),
      getBuckets(),
      getFunding(),
      isPaused(),
      getInitMarginBps(),
    ]);
  return { markPrice, oraclePrice, reserves, buckets, funding, paused, initMarginBps };
}

// --- Write builders (return unsigned XDR ready for the wallet) ---------------

type Build = (sender: string, args: xdr.ScVal[], method: string) => Promise<string>;
const call: Build = (sender, args, method) => buildContractCall(sender, CID(), method, args);

export const buildDeposit = (user: string, amount: number) =>
  call(user, [addr(user), i128(toFixed(amount))], 'deposit_margin');

export const buildWithdraw = (user: string, amount: number) =>
  call(user, [addr(user), i128(toFixed(amount))], 'withdraw_margin');

export const buildOpen = (
  user: string,
  size: number,
  isLong: boolean,
  slippageLimit: number,
) => call(user, [addr(user), i128(toFixed(size)), bool(isLong), i128(toFixed(slippageLimit))], 'open_position');

export const buildClose = (user: string, slippageLimit: number) =>
  call(user, [addr(user), i128(toFixed(slippageLimit))], 'close_position');

export const buildUpdateOracle = (updater: string, price: number) =>
  call(updater, [addr(updater), i128(toFixed(price))], 'update_oracle');

export const buildSettleFunding = (caller: string) => call(caller, [], 'settle_funding');

export const buildLiquidate = (liquidator: string, user: string) =>
  call(liquidator, [addr(liquidator), addr(user)], 'liquidate');

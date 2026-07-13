import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDESAH7V5QCU42CQXS2QZTDOOTNHEISLYZ7XPEYJVTSLIN3NQFOATZSY",
  }
} as const


/**
 * Solvency accounting snapshot.
 */
export interface Buckets {
  fee_vault: i128;
  insurance_fund: i128;
  total_collateral: i128;
}


/**
 * vAMM virtual reserves, returned to callers/frontend.
 */
export interface Reserves {
  base: i128;
  quote: i128;
}

/**
 * Canonical error set for the APEX futures contract.
 * 
 * Using an explicit `#[contracterror]` enum (instead of `assert!`/`panic!`) gives
 * callers stable, machine-readable error codes and keeps failures auditable both
 * on-chain and in the frontend. Every guard in the contract maps to one of these.
 */
export const Errors = {
  /**
   * Constructor/initialize invoked on an already-configured instance.
   */
  1: {message:"AlreadyInitialized"},
  /**
   * Operation attempted before the contract was initialized.
   */
  2: {message:"NotInitialized"},
  /**
   * Caller is not authorized for a privileged action (RBAC violation).
   */
  3: {message:"Unauthorized"},
  /**
   * Contract is paused by the circuit breaker; state-growing actions blocked.
   */
  4: {message:"Paused"},
  /**
   * A supplied amount/size was zero or negative where positivity is required.
   */
  5: {message:"InvalidAmount"},
  /**
   * A configuration/parameter value is out of its allowed bounds.
   */
  6: {message:"InvalidParams"},
  /**
   * Position equity/free margin is below the required initial margin.
   */
  7: {message:"InsufficientMargin"},
  /**
   * User does not have enough *free* (unlocked) margin for the action.
   */
  8: {message:"InsufficientFreeMargin"},
  /**
   * User already holds an open position; only one position per account.
   */
  9: {message:"PositionExists"},
  /**
   * No open position exists for the target action.
   */
  10: {message:"NoPosition"},
  /**
   * vAMM does not have enough virtual base liquidity to fill the trade.
   */
  11: {message:"InsufficientLiquidity"},
  /**
   * Executed price crossed the caller-supplied slippage bound.
   */
  12: {message:"SlippageExceeded"},
  /**
   * Target position is healthy (health factor >= 1.0); cannot be liquidated.
   */
  13: {message:"NotLiquidatable"},
  /**
   * Oracle price is older than the configured staleness window.
   */
  14: {message:"StaleOracle"},
  /**
   * Proposed oracle update deviates beyond the allowed band vs. the last price.
   */
  15: {message:"OracleDeviationTooHigh"},
  /**
   * Fixed-point arithmetic overflowed i128 bounds.
   */
  16: {message:"MathOverflow"},
  /**
   * Requested position size is below the configured minimum.
   */
  17: {message:"BelowMinPositionSize"},
  /**
   * Funding settlement called before the funding interval elapsed.
   */
  18: {message:"FundingTooEarly"}
}


/**
 * Risk, fee and oracle parameters. Grouped into one instance entry so a single
 * read loads the whole market configuration.
 */
export interface Config {
  /**
 * Protocol's administrative cut of funding paid, in bps (e.g. 1000 = 10%).
 */
funding_admin_cut_bps: i128;
  /**
 * Minimum seconds between funding settlements.
 */
funding_interval: u64;
  /**
 * Initial margin ratio in bps (e.g. 2000 = 20% => 5x max leverage).
 */
init_margin_bps: i128;
  /**
 * Liquidation penalty in bps of the liquidated equity (e.g. 500 = 5%).
 */
liq_penalty_bps: i128;
  /**
 * Share of the penalty paid to the liquidator in bps (e.g. 5000 = 50%).
 */
liq_reward_bps: i128;
  /**
 * Maintenance margin ratio in bps (e.g. 1000 = 10% liquidation threshold).
 */
maint_margin_bps: i128;
  /**
 * Cap on the per-settlement premium used for funding, in bps of index.
 */
max_funding_bps: i128;
  /**
 * Minimum position size in base units (7 dp).
 */
min_position_size: i128;
  /**
 * Max allowed oracle move vs. previous price, in bps (anti-manipulation).
 */
oracle_max_deviation_bps: i128;
  /**
 * Seconds after which an oracle price is considered stale for risk checks.
 */
oracle_staleness: u64;
  /**
 * Trading fee in bps charged on open & close notional (e.g. 10 = 0.1%).
 */
trading_fee_bps: i128;
}

/**
 * Keyspace for all contract state. Instance keys hold small, globally-shared
 * config/market state; per-user keys live in persistent storage.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "PendingAdmin", values: void} | {tag: "Pauser", values: void} | {tag: "FeeCollector", values: void} | {tag: "UsdcToken", values: void} | {tag: "OracleUpdater", values: void} | {tag: "Paused", values: void} | {tag: "Config", values: void} | {tag: "VammBase", values: void} | {tag: "VammQuote", values: void} | {tag: "OraclePrice", values: void} | {tag: "OracleTs", values: void} | {tag: "CumFunding", values: void} | {tag: "LastFundingTs", values: void} | {tag: "TotalCollateral", values: void} | {tag: "FeeVault", values: void} | {tag: "InsuranceFund", values: void} | {tag: "Margin", values: readonly [string]} | {tag: "Position", values: readonly [string]};


/**
 * A user's open futures position. One per account (enforced on open).
 */
export interface Position {
  /**
 * Snapshot of `CumFunding` at entry, used to compute funding owed.
 */
entry_funding: i128;
  /**
 * vAMM entry price (USDC per base unit, 7 dp).
 */
entry_price: i128;
  /**
 * Collateral locked against this position (USDC, 7 dp).
 */
margin_allocated: i128;
  /**
 * Signed size in virtual base units (positive = long, negative = short).
 */
size: i128;
}

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a liquidate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Liquidate an underwater position (health factor < 1.0 at the fresh index).
   */
  liquidate: ({liquidator, user}: {liquidator: string, user: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a set_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_config: ({caller, config}: {caller: string, config: Config}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_pauser transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_pauser: ({caller, pauser}: {caller: string, pauser: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_buckets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_buckets: (options?: MethodOptions) => Promise<AssembledTransaction<Buckets>>

  /**
   * Construct and simulate a get_funding transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * (cumulative_funding_index, last_settlement_timestamp)
   */
  get_funding: (options?: MethodOptions) => Promise<AssembledTransaction<readonly [i128, u64]>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accept_admin: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a collect_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sweep accrued protocol fees to the fee collector.
   */
  collect_fees: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_position: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Position>>

  /**
   * Construct and simulate a get_reserves transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reserves: (options?: MethodOptions) => Promise<AssembledTransaction<Reserves>>

  /**
   * Construct and simulate a open_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Open a leveraged position on virtual compute power.
   * - `size`: virtual base units (7 dp), always positive; direction is `is_long`.
   * - `slippage_limit`: for a long, the max acceptable entry notional; for a
   * short, the min acceptable notional. Pass 0 to skip the check.
   */
  open_position: ({user, size, is_long, slippage_limit}: {user: string, size: i128, is_long: boolean, slippage_limit: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a update_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Permissioned endpoint to inject GRC-validated APAC GPU Index prices.
   */
  update_oracle: ({updater, price}: {updater: string, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a close_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Close the caller's active position at market and settle PnL/funding/fees.
   * `slippage_limit`: closing a long, the min proceeds; closing a short, the
   * max cost. Pass 0 to skip. Allowed even while paused so users can always exit.
   */
  close_position: ({user, slippage_limit}: {user: string, slippage_limit: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit_margin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit USDC as free collateral.
   */
  deposit_margin: ({user, amount}: {user: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_mark_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_mark_price: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a seed_insurance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Seed the insurance fund with USDC (permissionless). Backs trader profits
   * and absorbs bad debt; admins should seed this before opening the market.
   */
  seed_insurance: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a settle_funding transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Settle funding globally. Permissionless; advances only once the funding
   * interval has elapsed. Returns the applied premium.
   */
  settle_funding: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a transfer_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_admin: ({caller, new_admin}: {caller: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw_margin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw free collateral (subject to initial-margin coverage if a position
   * is open).
   */
  withdraw_margin: ({user, amount}: {user: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_oracle_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_oracle_price: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_health_factor: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_fee_collector transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_fee_collector: ({caller, collector}: {caller: string, collector: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_margin_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_margin_balance: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_oracle_updater transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_oracle_updater: ({caller, updater}: {caller: string, updater: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, pauser, fee_collector, usdc, oracle_updater, init_base, init_quote, config}: {admin: string, pauser: string, fee_collector: string, usdc: string, oracle_updater: string, init_base: i128, init_quote: i128, config: Config},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, pauser, fee_collector, usdc, oracle_updater, init_base, init_quote, config}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAEpMaXF1aWRhdGUgYW4gdW5kZXJ3YXRlciBwb3NpdGlvbiAoaGVhbHRoIGZhY3RvciA8IDEuMCBhdCB0aGUgZnJlc2ggaW5kZXgpLgAAAAAACWxpcXVpZGF0ZQAAAAAAAAIAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAAAAAAABHVzZXIAAAATAAAAAA==",
        "AAAAAQAAAB1Tb2x2ZW5jeSBhY2NvdW50aW5nIHNuYXBzaG90LgAAAAAAAAAAAAAHQnVja2V0cwAAAAADAAAAAAAAAAlmZWVfdmF1bHQAAAAAAAALAAAAAAAAAA5pbnN1cmFuY2VfZnVuZAAAAAAACwAAAAAAAAAQdG90YWxfY29sbGF0ZXJhbAAAAAs=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAKc2V0X2NvbmZpZwAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZjb25maWcAAAAAB9AAAAAGQ29uZmlnAAAAAAAA",
        "AAAAAAAAAAAAAAAKc2V0X3BhdXNlcgAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZwYXVzZXIAAAAAABMAAAAA",
        "AAAAAQAAADR2QU1NIHZpcnR1YWwgcmVzZXJ2ZXMsIHJldHVybmVkIHRvIGNhbGxlcnMvZnJvbnRlbmQuAAAAAAAAAAhSZXNlcnZlcwAAAAIAAAAAAAAABGJhc2UAAAALAAAAAAAAAAVxdW90ZQAAAAAAAAs=",
        "AAAAAAAAAAAAAAALZ2V0X2J1Y2tldHMAAAAAAAAAAAEAAAfQAAAAB0J1Y2tldHMA",
        "AAAAAAAAADUoY3VtdWxhdGl2ZV9mdW5kaW5nX2luZGV4LCBsYXN0X3NldHRsZW1lbnRfdGltZXN0YW1wKQAAAAAAAAtnZXRfZnVuZGluZwAAAAAAAAAAAQAAA+0AAAACAAAACwAAAAY=",
        "AAAAAAAAAAAAAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAADFTd2VlcCBhY2NydWVkIHByb3RvY29sIGZlZXMgdG8gdGhlIGZlZSBjb2xsZWN0b3IuAAAAAAAADGNvbGxlY3RfZmVlcwAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAMZ2V0X3Bvc2l0aW9uAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAH0AAAAAhQb3NpdGlvbg==",
        "AAAAAAAAAAAAAAAMZ2V0X3Jlc2VydmVzAAAAAAAAAAEAAAfQAAAACFJlc2VydmVz",
        "AAAAAAAAAQhPcGVuIGEgbGV2ZXJhZ2VkIHBvc2l0aW9uIG9uIHZpcnR1YWwgY29tcHV0ZSBwb3dlci4KLSBgc2l6ZWA6IHZpcnR1YWwgYmFzZSB1bml0cyAoNyBkcCksIGFsd2F5cyBwb3NpdGl2ZTsgZGlyZWN0aW9uIGlzIGBpc19sb25nYC4KLSBgc2xpcHBhZ2VfbGltaXRgOiBmb3IgYSBsb25nLCB0aGUgbWF4IGFjY2VwdGFibGUgZW50cnkgbm90aW9uYWw7IGZvciBhCnNob3J0LCB0aGUgbWluIGFjY2VwdGFibGUgbm90aW9uYWwuIFBhc3MgMCB0byBza2lwIHRoZSBjaGVjay4AAAANb3Blbl9wb3NpdGlvbgAAAAAAAAQAAAAAAAAABHVzZXIAAAATAAAAAAAAAARzaXplAAAACwAAAAAAAAAHaXNfbG9uZwAAAAABAAAAAAAAAA5zbGlwcGFnZV9saW1pdAAAAAAACwAAAAA=",
        "AAAAAAAAAERQZXJtaXNzaW9uZWQgZW5kcG9pbnQgdG8gaW5qZWN0IEdSQy12YWxpZGF0ZWQgQVBBQyBHUFUgSW5kZXggcHJpY2VzLgAAAA11cGRhdGVfb3JhY2xlAAAAAAAAAgAAAAAAAAAHdXBkYXRlcgAAAAATAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAA",
        "AAAAAAAAAWxDb250cmFjdCBjb25zdHJ1Y3RvciDigJQgcnVucyBleGFjdGx5IG9uY2UgYXQgZGVwbG95IHRpbWUsIGNsb3NpbmcgdGhlCmNsYXNzaWMgImFueW9uZSBjYW4gY2FsbCBpbml0aWFsaXplIGZpcnN0IiBmcm9udC1ydW5uaW5nIHdpbmRvdy4KCi0gYGFkbWluYC9gcGF1c2VyYC9gZmVlX2NvbGxlY3RvcmAvYG9yYWNsZV91cGRhdGVyYDogUkJBQyBwcmluY2lwYWxzLgotIGB1c2RjYDogVVNEQyBTQUMgYWRkcmVzcyB1c2VkIGZvciBhbGwgc2V0dGxlbWVudC4KLSBgaW5pdF9iYXNlYC9gaW5pdF9xdW90ZWA6IGluaXRpYWwgdmlydHVhbCByZXNlcnZlcyAoNyBkcCkuCi0gYGNvbmZpZ2A6IHJpc2ssIGZlZSBhbmQgb3JhY2xlIHBhcmFtZXRlcnMuAAAADV9fY29uc3RydWN0b3IAAAAAAAAIAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABnBhdXNlcgAAAAAAEwAAAAAAAAANZmVlX2NvbGxlY3RvcgAAAAAAABMAAAAAAAAABHVzZGMAAAATAAAAAAAAAA5vcmFjbGVfdXBkYXRlcgAAAAAAEwAAAAAAAAAJaW5pdF9iYXNlAAAAAAAACwAAAAAAAAAKaW5pdF9xdW90ZQAAAAAACwAAAAAAAAAGY29uZmlnAAAAAAfQAAAABkNvbmZpZwAAAAAAAA==",
        "AAAAAAAAAOBDbG9zZSB0aGUgY2FsbGVyJ3MgYWN0aXZlIHBvc2l0aW9uIGF0IG1hcmtldCBhbmQgc2V0dGxlIFBuTC9mdW5kaW5nL2ZlZXMuCmBzbGlwcGFnZV9saW1pdGA6IGNsb3NpbmcgYSBsb25nLCB0aGUgbWluIHByb2NlZWRzOyBjbG9zaW5nIGEgc2hvcnQsIHRoZQptYXggY29zdC4gUGFzcyAwIHRvIHNraXAuIEFsbG93ZWQgZXZlbiB3aGlsZSBwYXVzZWQgc28gdXNlcnMgY2FuIGFsd2F5cyBleGl0LgAAAA5jbG9zZV9wb3NpdGlvbgAAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAADnNsaXBwYWdlX2xpbWl0AAAAAAALAAAAAA==",
        "AAAAAAAAACBEZXBvc2l0IFVTREMgYXMgZnJlZSBjb2xsYXRlcmFsLgAAAA5kZXBvc2l0X21hcmdpbgAAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAOZ2V0X21hcmtfcHJpY2UAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAJFTZWVkIHRoZSBpbnN1cmFuY2UgZnVuZCB3aXRoIFVTREMgKHBlcm1pc3Npb25sZXNzKS4gQmFja3MgdHJhZGVyIHByb2ZpdHMKYW5kIGFic29yYnMgYmFkIGRlYnQ7IGFkbWlucyBzaG91bGQgc2VlZCB0aGlzIGJlZm9yZSBvcGVuaW5nIHRoZSBtYXJrZXQuAAAAAAAADnNlZWRfaW5zdXJhbmNlAAAAAAACAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAHpTZXR0bGUgZnVuZGluZyBnbG9iYWxseS4gUGVybWlzc2lvbmxlc3M7IGFkdmFuY2VzIG9ubHkgb25jZSB0aGUgZnVuZGluZwppbnRlcnZhbCBoYXMgZWxhcHNlZC4gUmV0dXJucyB0aGUgYXBwbGllZCBwcmVtaXVtLgAAAAAADnNldHRsZV9mdW5kaW5nAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAOdHJhbnNmZXJfYWRtaW4AAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAFRXaXRoZHJhdyBmcmVlIGNvbGxhdGVyYWwgKHN1YmplY3QgdG8gaW5pdGlhbC1tYXJnaW4gY292ZXJhZ2UgaWYgYSBwb3NpdGlvbgppcyBvcGVuKS4AAAAPd2l0aGRyYXdfbWFyZ2luAAAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAQZ2V0X29yYWNsZV9wcmljZQAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAARZ2V0X2hlYWx0aF9mYWN0b3IAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAARc2V0X2ZlZV9jb2xsZWN0b3IAAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACWNvbGxlY3RvcgAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAASZ2V0X21hcmdpbl9iYWxhbmNlAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAASc2V0X29yYWNsZV91cGRhdGVyAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB3VwZGF0ZXIAAAAAEwAAAAA=",
        "AAAABAAAASJDYW5vbmljYWwgZXJyb3Igc2V0IGZvciB0aGUgQVBFWCBmdXR1cmVzIGNvbnRyYWN0LgoKVXNpbmcgYW4gZXhwbGljaXQgYCNbY29udHJhY3RlcnJvcl1gIGVudW0gKGluc3RlYWQgb2YgYGFzc2VydCFgL2BwYW5pYyFgKSBnaXZlcwpjYWxsZXJzIHN0YWJsZSwgbWFjaGluZS1yZWFkYWJsZSBlcnJvciBjb2RlcyBhbmQga2VlcHMgZmFpbHVyZXMgYXVkaXRhYmxlIGJvdGgKb24tY2hhaW4gYW5kIGluIHRoZSBmcm9udGVuZC4gRXZlcnkgZ3VhcmQgaW4gdGhlIGNvbnRyYWN0IG1hcHMgdG8gb25lIG9mIHRoZXNlLgAAAAAAAAAAAAVFcnJvcgAAAAAAABIAAABBQ29uc3RydWN0b3IvaW5pdGlhbGl6ZSBpbnZva2VkIG9uIGFuIGFscmVhZHktY29uZmlndXJlZCBpbnN0YW5jZS4AAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAOE9wZXJhdGlvbiBhdHRlbXB0ZWQgYmVmb3JlIHRoZSBjb250cmFjdCB3YXMgaW5pdGlhbGl6ZWQuAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAQkNhbGxlciBpcyBub3QgYXV0aG9yaXplZCBmb3IgYSBwcml2aWxlZ2VkIGFjdGlvbiAoUkJBQyB2aW9sYXRpb24pLgAAAAAADFVuYXV0aG9yaXplZAAAAAMAAABJQ29udHJhY3QgaXMgcGF1c2VkIGJ5IHRoZSBjaXJjdWl0IGJyZWFrZXI7IHN0YXRlLWdyb3dpbmcgYWN0aW9ucyBibG9ja2VkLgAAAAAAAAZQYXVzZWQAAAAAAAQAAABJQSBzdXBwbGllZCBhbW91bnQvc2l6ZSB3YXMgemVybyBvciBuZWdhdGl2ZSB3aGVyZSBwb3NpdGl2aXR5IGlzIHJlcXVpcmVkLgAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABQAAAD1BIGNvbmZpZ3VyYXRpb24vcGFyYW1ldGVyIHZhbHVlIGlzIG91dCBvZiBpdHMgYWxsb3dlZCBib3VuZHMuAAAAAAAADUludmFsaWRQYXJhbXMAAAAAAAAGAAAAQVBvc2l0aW9uIGVxdWl0eS9mcmVlIG1hcmdpbiBpcyBiZWxvdyB0aGUgcmVxdWlyZWQgaW5pdGlhbCBtYXJnaW4uAAAAAAAAEkluc3VmZmljaWVudE1hcmdpbgAAAAAABwAAAEJVc2VyIGRvZXMgbm90IGhhdmUgZW5vdWdoICpmcmVlKiAodW5sb2NrZWQpIG1hcmdpbiBmb3IgdGhlIGFjdGlvbi4AAAAAABZJbnN1ZmZpY2llbnRGcmVlTWFyZ2luAAAAAAAIAAAAQ1VzZXIgYWxyZWFkeSBob2xkcyBhbiBvcGVuIHBvc2l0aW9uOyBvbmx5IG9uZSBwb3NpdGlvbiBwZXIgYWNjb3VudC4AAAAADlBvc2l0aW9uRXhpc3RzAAAAAAAJAAAALk5vIG9wZW4gcG9zaXRpb24gZXhpc3RzIGZvciB0aGUgdGFyZ2V0IGFjdGlvbi4AAAAAAApOb1Bvc2l0aW9uAAAAAAAKAAAAQ3ZBTU0gZG9lcyBub3QgaGF2ZSBlbm91Z2ggdmlydHVhbCBiYXNlIGxpcXVpZGl0eSB0byBmaWxsIHRoZSB0cmFkZS4AAAAAFUluc3VmZmljaWVudExpcXVpZGl0eQAAAAAAAAsAAAA6RXhlY3V0ZWQgcHJpY2UgY3Jvc3NlZCB0aGUgY2FsbGVyLXN1cHBsaWVkIHNsaXBwYWdlIGJvdW5kLgAAAAAAEFNsaXBwYWdlRXhjZWVkZWQAAAAMAAAASFRhcmdldCBwb3NpdGlvbiBpcyBoZWFsdGh5IChoZWFsdGggZmFjdG9yID49IDEuMCk7IGNhbm5vdCBiZSBsaXF1aWRhdGVkLgAAAA9Ob3RMaXF1aWRhdGFibGUAAAAADQAAADtPcmFjbGUgcHJpY2UgaXMgb2xkZXIgdGhhbiB0aGUgY29uZmlndXJlZCBzdGFsZW5lc3Mgd2luZG93LgAAAAALU3RhbGVPcmFjbGUAAAAADgAAAEtQcm9wb3NlZCBvcmFjbGUgdXBkYXRlIGRldmlhdGVzIGJleW9uZCB0aGUgYWxsb3dlZCBiYW5kIHZzLiB0aGUgbGFzdCBwcmljZS4AAAAAFk9yYWNsZURldmlhdGlvblRvb0hpZ2gAAAAAAA8AAAAuRml4ZWQtcG9pbnQgYXJpdGhtZXRpYyBvdmVyZmxvd2VkIGkxMjggYm91bmRzLgAAAAAADE1hdGhPdmVyZmxvdwAAABAAAAA4UmVxdWVzdGVkIHBvc2l0aW9uIHNpemUgaXMgYmVsb3cgdGhlIGNvbmZpZ3VyZWQgbWluaW11bS4AAAAUQmVsb3dNaW5Qb3NpdGlvblNpemUAAAARAAAAPkZ1bmRpbmcgc2V0dGxlbWVudCBjYWxsZWQgYmVmb3JlIHRoZSBmdW5kaW5nIGludGVydmFsIGVsYXBzZWQuAAAAAAAPRnVuZGluZ1Rvb0Vhcmx5AAAAABI=",
        "AAAAAQAAAHdSaXNrLCBmZWUgYW5kIG9yYWNsZSBwYXJhbWV0ZXJzLiBHcm91cGVkIGludG8gb25lIGluc3RhbmNlIGVudHJ5IHNvIGEgc2luZ2xlCnJlYWQgbG9hZHMgdGhlIHdob2xlIG1hcmtldCBjb25maWd1cmF0aW9uLgAAAAAAAAAABkNvbmZpZwAAAAAACwAAAEhQcm90b2NvbCdzIGFkbWluaXN0cmF0aXZlIGN1dCBvZiBmdW5kaW5nIHBhaWQsIGluIGJwcyAoZS5nLiAxMDAwID0gMTAlKS4AAAAVZnVuZGluZ19hZG1pbl9jdXRfYnBzAAAAAAAACwAAACxNaW5pbXVtIHNlY29uZHMgYmV0d2VlbiBmdW5kaW5nIHNldHRsZW1lbnRzLgAAABBmdW5kaW5nX2ludGVydmFsAAAABgAAAEFJbml0aWFsIG1hcmdpbiByYXRpbyBpbiBicHMgKGUuZy4gMjAwMCA9IDIwJSA9PiA1eCBtYXggbGV2ZXJhZ2UpLgAAAAAAAA9pbml0X21hcmdpbl9icHMAAAAACwAAAERMaXF1aWRhdGlvbiBwZW5hbHR5IGluIGJwcyBvZiB0aGUgbGlxdWlkYXRlZCBlcXVpdHkgKGUuZy4gNTAwID0gNSUpLgAAAA9saXFfcGVuYWx0eV9icHMAAAAACwAAAEVTaGFyZSBvZiB0aGUgcGVuYWx0eSBwYWlkIHRvIHRoZSBsaXF1aWRhdG9yIGluIGJwcyAoZS5nLiA1MDAwID0gNTAlKS4AAAAAAAAObGlxX3Jld2FyZF9icHMAAAAAAAsAAABITWFpbnRlbmFuY2UgbWFyZ2luIHJhdGlvIGluIGJwcyAoZS5nLiAxMDAwID0gMTAlIGxpcXVpZGF0aW9uIHRocmVzaG9sZCkuAAAAEG1haW50X21hcmdpbl9icHMAAAALAAAARENhcCBvbiB0aGUgcGVyLXNldHRsZW1lbnQgcHJlbWl1bSB1c2VkIGZvciBmdW5kaW5nLCBpbiBicHMgb2YgaW5kZXguAAAAD21heF9mdW5kaW5nX2JwcwAAAAALAAAAK01pbmltdW0gcG9zaXRpb24gc2l6ZSBpbiBiYXNlIHVuaXRzICg3IGRwKS4AAAAAEW1pbl9wb3NpdGlvbl9zaXplAAAAAAAACwAAAEdNYXggYWxsb3dlZCBvcmFjbGUgbW92ZSB2cy4gcHJldmlvdXMgcHJpY2UsIGluIGJwcyAoYW50aS1tYW5pcHVsYXRpb24pLgAAAAAYb3JhY2xlX21heF9kZXZpYXRpb25fYnBzAAAACwAAAEhTZWNvbmRzIGFmdGVyIHdoaWNoIGFuIG9yYWNsZSBwcmljZSBpcyBjb25zaWRlcmVkIHN0YWxlIGZvciByaXNrIGNoZWNrcy4AAAAQb3JhY2xlX3N0YWxlbmVzcwAAAAYAAABFVHJhZGluZyBmZWUgaW4gYnBzIGNoYXJnZWQgb24gb3BlbiAmIGNsb3NlIG5vdGlvbmFsIChlLmcuIDEwID0gMC4xJSkuAAAAAAAAD3RyYWRpbmdfZmVlX2JwcwAAAAAL",
        "AAAAAgAAAIlLZXlzcGFjZSBmb3IgYWxsIGNvbnRyYWN0IHN0YXRlLiBJbnN0YW5jZSBrZXlzIGhvbGQgc21hbGwsIGdsb2JhbGx5LXNoYXJlZApjb25maWcvbWFya2V0IHN0YXRlOyBwZXItdXNlciBrZXlzIGxpdmUgaW4gcGVyc2lzdGVudCBzdG9yYWdlLgAAAAAAAAAAAAAHRGF0YUtleQAAAAATAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAxQZW5kaW5nQWRtaW4AAAAAAAAAAAAAAAZQYXVzZXIAAAAAAAAAAAAAAAAADEZlZUNvbGxlY3RvcgAAAAAAAAAAAAAACVVzZGNUb2tlbgAAAAAAAAAAAAAAAAAADU9yYWNsZVVwZGF0ZXIAAAAAAAAAAAAAAAAAAAZQYXVzZWQAAAAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAAAAAAAAAAAIVmFtbUJhc2UAAAAAAAAAAAAAAAlWYW1tUXVvdGUAAAAAAAAAAAAAAAAAAAtPcmFjbGVQcmljZQAAAAAAAAAAAAAAAAhPcmFjbGVUcwAAAAAAAAAAAAAACkN1bUZ1bmRpbmcAAAAAAAAAAAAAAAAADUxhc3RGdW5kaW5nVHMAAAAAAAAAAAAAAAAAAA9Ub3RhbENvbGxhdGVyYWwAAAAAAAAAAAAAAAAIRmVlVmF1bHQAAAAAAAAAAAAAAA1JbnN1cmFuY2VGdW5kAAAAAAAAAQAAAAAAAAAGTWFyZ2luAAAAAAABAAAAEwAAAAEAAAAAAAAACFBvc2l0aW9uAAAAAQAAABM=",
        "AAAAAQAAAENBIHVzZXIncyBvcGVuIGZ1dHVyZXMgcG9zaXRpb24uIE9uZSBwZXIgYWNjb3VudCAoZW5mb3JjZWQgb24gb3BlbikuAAAAAAAAAAAIUG9zaXRpb24AAAAEAAAAQFNuYXBzaG90IG9mIGBDdW1GdW5kaW5nYCBhdCBlbnRyeSwgdXNlZCB0byBjb21wdXRlIGZ1bmRpbmcgb3dlZC4AAAANZW50cnlfZnVuZGluZwAAAAAAAAsAAAAsdkFNTSBlbnRyeSBwcmljZSAoVVNEQyBwZXIgYmFzZSB1bml0LCA3IGRwKS4AAAALZW50cnlfcHJpY2UAAAAACwAAADVDb2xsYXRlcmFsIGxvY2tlZCBhZ2FpbnN0IHRoaXMgcG9zaXRpb24gKFVTREMsIDcgZHApLgAAAAAAABBtYXJnaW5fYWxsb2NhdGVkAAAACwAAAEZTaWduZWQgc2l6ZSBpbiB2aXJ0dWFsIGJhc2UgdW5pdHMgKHBvc2l0aXZlID0gbG9uZywgbmVnYXRpdmUgPSBzaG9ydCkuAAAAAAAEc2l6ZQAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
        unpause: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_admin: this.txFromJSON<string>,
        is_paused: this.txFromJSON<boolean>,
        liquidate: this.txFromJSON<null>,
        get_config: this.txFromJSON<Config>,
        set_config: this.txFromJSON<null>,
        set_pauser: this.txFromJSON<null>,
        get_buckets: this.txFromJSON<Buckets>,
        get_funding: this.txFromJSON<readonly [i128, u64]>,
        accept_admin: this.txFromJSON<null>,
        collect_fees: this.txFromJSON<i128>,
        get_position: this.txFromJSON<Position>,
        get_reserves: this.txFromJSON<Reserves>,
        open_position: this.txFromJSON<null>,
        update_oracle: this.txFromJSON<null>,
        close_position: this.txFromJSON<null>,
        deposit_margin: this.txFromJSON<null>,
        get_mark_price: this.txFromJSON<i128>,
        seed_insurance: this.txFromJSON<null>,
        settle_funding: this.txFromJSON<i128>,
        transfer_admin: this.txFromJSON<null>,
        withdraw_margin: this.txFromJSON<null>,
        get_oracle_price: this.txFromJSON<i128>,
        get_health_factor: this.txFromJSON<i128>,
        set_fee_collector: this.txFromJSON<null>,
        get_margin_balance: this.txFromJSON<i128>,
        set_oracle_updater: this.txFromJSON<null>
  }
}
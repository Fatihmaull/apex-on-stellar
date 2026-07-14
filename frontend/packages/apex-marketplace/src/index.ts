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
    contractId: "CDAM76V2FX7Y26UATDY2FL4CZ3RMYBNXHZQSQP6X6DRFLVQLQPCKNY2F",
  }
} as const


/**
 * Solvency accounting snapshot.
 */
export interface Buckets {
  escrow_usdc: i128;
  fee_vault: i128;
  index_pool_usdc: i128;
  insurance_fund: i128;
  provider_collateral_total: i128;
}

/**
 * Stable error codes for the APEX marketplace contract.
 */
export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"Paused"},
  5: {message:"InvalidAmount"},
  6: {message:"InvalidParams"},
  7: {message:"InsufficientBalance"},
  8: {message:"InsufficientCollateral"},
  9: {message:"InsufficientCapacity"},
  10: {message:"ProviderNotApproved"},
  11: {message:"ProviderNotFound"},
  12: {message:"SeriesNotFound"},
  13: {message:"SeriesInactive"},
  14: {message:"SlippageExceeded"},
  15: {message:"StaleOracle"},
  16: {message:"MathOverflow"},
  17: {message:"TimelockNotReady"},
  18: {message:"NothingPending"},
  19: {message:"IndexNotFound"},
  20: {message:"UnknownGpuModel"},
  21: {message:"InsufficientLiquidity"}
}


export interface Config {
  /**
 * Seconds after which CU oracle is stale for settlement.
 */
oracle_staleness: u64;
  /**
 * Settlement fee on cash redeem, in bps.
 */
settlement_fee_bps: i128;
}


export interface Series {
  active: boolean;
  ask_price: i128;
  coefficient: i128;
  gpu_model: string;
  provider: string;
  spec_hash: Buffer;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "PendingAdmin", values: void} | {tag: "Pauser", values: void} | {tag: "Verifier", values: void} | {tag: "UsdcToken", values: void} | {tag: "FuturesOracle", values: void} | {tag: "Paused", values: void} | {tag: "Config", values: void} | {tag: "TimelockDelay", values: void} | {tag: "PendingUpgrade", values: void} | {tag: "PendingConfig", values: void} | {tag: "OraclePrice", values: void} | {tag: "OracleTs", values: void} | {tag: "ProviderCollateralTotal", values: void} | {tag: "IndexPoolUsdc", values: void} | {tag: "EscrowUsdc", values: void} | {tag: "InsuranceFund", values: void} | {tag: "FeeVault", values: void} | {tag: "NextSeriesId", values: void} | {tag: "SeriesIds", values: void} | {tag: "IndexSymbols", values: void} | {tag: "Coefficient", values: readonly [string]} | {tag: "Provider", values: readonly [string]} | {tag: "Series", values: readonly [u64]} | {tag: "Balance", values: readonly [u64, string]} | {tag: "Inventory", values: readonly [u64]} | {tag: "Index", values: readonly [string]} | {tag: "IndexShares", values: readonly [string, string]};


export interface Provider {
  capacity_cu: i128;
  collateral: i128;
  metadata_hash: Buffer;
  minted_cu: i128;
  owner: string;
  status: ProviderStatus;
}


export interface IndexPool {
  /**
 * Nav price override multiplier vs ACPI (SCALE = 1.0). MVP uses ACPI directly.
 */
nav_factor: i128;
  symbol: string;
  total_shares: i128;
  usdc_balance: i128;
}


export interface PendingConfig {
  config: Config;
  eta: u64;
}


export interface PendingUpgrade {
  eta: u64;
  wasm_hash: Buffer;
}

export enum ProviderStatus {
  Pending = 0,
  Approved = 1,
  Suspended = 2,
}

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a scale transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  scale: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a buy_cu transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  buy_cu: ({buyer, series_id, amount, max_cost}: {buyer: string, series_id: u64, amount: i128, max_cost: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a mint_cu transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint_cu: ({owner, series_id, amount}: {owner: string, series_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a sell_cu transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  sell_cu: ({seller, series_id, amount, min_proceeds}: {seller: string, series_id: u64, amount: i128, min_proceeds: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_ask transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_ask: ({owner, series_id, price}: {owner: string, series_id: u64, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a buy_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  buy_index: ({buyer, symbol, usdc_amount}: {buyer: string, symbol: string, usdc_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_index: ({symbol}: {symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<IndexPool>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a redeem_cu transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  redeem_cu: ({holder, series_id, amount}: {holder: string, series_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cu_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cu_balance: ({series_id, holder}: {series_id: u64, holder: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_series transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_series: ({series_id}: {series_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Series>>

  /**
   * Construct and simulate a set_pauser transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_pauser: ({caller, pauser}: {caller: string, pauser: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_buckets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_buckets: (options?: MethodOptions) => Promise<AssembledTransaction<Buckets>>

  /**
   * Construct and simulate a list_series transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_series: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a transfer_cu transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_cu: ({series_id, from, to, amount}: {series_id: u64, from: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accept_admin: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_index: ({caller, symbol, nav_factor}: {caller: string, symbol: string, nav_factor: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_provider: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Provider>>

  /**
   * Construct and simulate a get_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_verifier: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a index_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  index_shares: ({symbol, holder}: {symbol: string, holder: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a redeem_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  redeem_index: ({holder, symbol, shares}: {holder: string, symbol: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_verifier: ({caller, verifier}: {caller: string, verifier: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cancel_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_config: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_series transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_series: ({owner, gpu_model, spec_hash, ask_price}: {owner: string, gpu_model: string, spec_hash: Buffer, ask_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_index_nav transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_index_nav: ({symbol}: {symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_inventory transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_inventory: ({series_id}: {series_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a cancel_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_upgrade: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a execute_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_config: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a propose_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_config: ({caller, config}: {caller: string, config: Config}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a seed_insurance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  seed_insurance: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a slash_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  slash_provider: ({caller, owner, amount}: {caller: string, owner: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_admin: ({caller, new_admin}: {caller: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a execute_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_upgrade: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_coefficient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_coefficient: ({model}: {model: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a post_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  post_collateral: ({owner, amount}: {owner: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a propose_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_upgrade: ({caller, new_wasm_hash}: {caller: string, new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_coefficient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_coefficient: ({caller, model, coeff}: {caller: string, model: string, coeff: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a approve_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_provider: ({verifier, owner, capacity_cu}: {verifier: string, owner: string, capacity_cu: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_oracle_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_oracle_price: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a update_cu_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_cu_oracle: ({caller, price}: {caller: string, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a register_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_provider: ({owner, metadata_hash}: {owner: string, metadata_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_futures_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_futures_oracle: ({caller, futures}: {caller: string, futures: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a redeem_cu_for_access transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  redeem_cu_for_access: ({holder, series_id, amount}: {holder: string, series_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, verifier, pauser, usdc, futures_oracle, initial_cu_price, config, timelock_delay}: {admin: string, verifier: string, pauser: string, usdc: string, futures_oracle: string, initial_cu_price: i128, config: Config, timelock_delay: u64},
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
    return ContractClient.deploy({admin, verifier, pauser, usdc, futures_oracle, initial_cu_price, config, timelock_delay}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAFc2NhbGUAAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAGYnV5X2N1AAAAAAAEAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIbWF4X2Nvc3QAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAHbWludF9jdQAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAHc2VsbF9jdQAAAAAEAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAMbWluX3Byb2NlZWRzAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAHc2V0X2FzawAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAAAAAAABXByaWNlAAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAJYnV5X2luZGV4AAAAAAAAAwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAZzeW1ib2wAAAAAABEAAAAAAAAAC3VzZGNfYW1vdW50AAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X2luZGV4AAAAAAAAAQAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAQAAB9AAAAAJSW5kZXhQb29sAAAA",
        "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAJcmVkZWVtX2N1AAAAAAAAAwAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAAAAAAlzZXJpZXNfaWQAAAAAAAAGAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAQAAAB1Tb2x2ZW5jeSBhY2NvdW50aW5nIHNuYXBzaG90LgAAAAAAAAAAAAAHQnVja2V0cwAAAAAFAAAAAAAAAAtlc2Nyb3dfdXNkYwAAAAALAAAAAAAAAAlmZWVfdmF1bHQAAAAAAAALAAAAAAAAAA9pbmRleF9wb29sX3VzZGMAAAAACwAAAAAAAAAOaW5zdXJhbmNlX2Z1bmQAAAAAAAsAAAAAAAAAGXByb3ZpZGVyX2NvbGxhdGVyYWxfdG90YWwAAAAAAAAL",
        "AAAAAAAAAAAAAAAKY3VfYmFsYW5jZQAAAAAAAgAAAAAAAAAJc2VyaWVzX2lkAAAAAAAABgAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAKZ2V0X3NlcmllcwAAAAAAAQAAAAAAAAAJc2VyaWVzX2lkAAAAAAAABgAAAAEAAAfQAAAABlNlcmllcwAA",
        "AAAAAAAAAAAAAAAKc2V0X3BhdXNlcgAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZwYXVzZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAALZ2V0X2J1Y2tldHMAAAAAAAAAAAEAAAfQAAAAB0J1Y2tldHMA",
        "AAAAAAAAAAAAAAALbGlzdF9zZXJpZXMAAAAAAAAAAAEAAAPqAAAABg==",
        "AAAAAAAAAAAAAAALdHJhbnNmZXJfY3UAAAAABAAAAAAAAAAJc2VyaWVzX2lkAAAAAAAABgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAMY3JlYXRlX2luZGV4AAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZzeW1ib2wAAAAAABEAAAAAAAAACm5hdl9mYWN0b3IAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3ZpZGVyAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAB9AAAAAIUHJvdmlkZXI=",
        "AAAAAAAAAAAAAAAMZ2V0X3ZlcmlmaWVyAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAMaW5kZXhfc2hhcmVzAAAAAgAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAAAAAAZob2xkZXIAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAMcmVkZWVtX2luZGV4AAAAAwAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAAAAAAZzeW1ib2wAAAAAABEAAAAAAAAABnNoYXJlcwAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAMc2V0X3ZlcmlmaWVyAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAh2ZXJpZmllcgAAABMAAAAA",
        "AAAAAAAAAAAAAAANY2FuY2VsX2NvbmZpZwAAAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANY3JlYXRlX3NlcmllcwAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAJZ3B1X21vZGVsAAAAAAAAEQAAAAAAAAAJc3BlY19oYXNoAAAAAAAD7gAAACAAAAAAAAAACWFza19wcmljZQAAAAAAAAsAAAABAAAABg==",
        "AAAAAAAAAAAAAAANZ2V0X2luZGV4X25hdgAAAAAAAAEAAAAAAAAABnN5bWJvbAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAAAAAAANZ2V0X2ludmVudG9yeQAAAAAAAAEAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAABAAAACw==",
        "AAAAAAAAANpEZXBsb3ktdGltZSBjb25zdHJ1Y3Rvci4KCi0gYGZ1dHVyZXNfb3JhY2xlYDogYXBleC1mdXR1cmVzIGFkZHJlc3MgZm9yIEFDUEkgY3Jvc3MtY2FsbCAobWF5IGJlIGEKcGxhY2Vob2xkZXI7IGxvY2FsIGB1cGRhdGVfY3Vfb3JhY2xlYCBrZWVwcyBwcmljZXMgZnJlc2ggZm9yIHRlc3RzKS4KLSBgaW5pdGlhbF9jdV9wcmljZWA6IHNlZWQgQUNQSSAoVVNEQyBwZXIgQ1UsIDcgZHApLgAAAAAADV9fY29uc3RydWN0b3IAAAAAAAAIAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAAGcGF1c2VyAAAAAAATAAAAAAAAAAR1c2RjAAAAEwAAAAAAAAAOZnV0dXJlc19vcmFjbGUAAAAAABMAAAAAAAAAEGluaXRpYWxfY3VfcHJpY2UAAAALAAAAAAAAAAZjb25maWcAAAAAB9AAAAAGQ29uZmlnAAAAAAAAAAAADnRpbWVsb2NrX2RlbGF5AAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAOY2FuY2VsX3VwZ3JhZGUAAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAOZXhlY3V0ZV9jb25maWcAAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAOcHJvcG9zZV9jb25maWcAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAGY29uZmlnAAAAAAfQAAAABkNvbmZpZwAAAAAAAA==",
        "AAAAAAAAAAAAAAAOc2VlZF9pbnN1cmFuY2UAAAAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAOc2xhc2hfcHJvdmlkZXIAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAOdHJhbnNmZXJfYWRtaW4AAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPZXhlY3V0ZV91cGdyYWRlAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPZ2V0X2NvZWZmaWNpZW50AAAAAAEAAAAAAAAABW1vZGVsAAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAAAAAAAPcG9zdF9jb2xsYXRlcmFsAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAPcHJvcG9zZV91cGdyYWRlAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAAAAAAAAPc2V0X2NvZWZmaWNpZW50AAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFbW9kZWwAAAAAAAARAAAAAAAAAAVjb2VmZgAAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAQYXBwcm92ZV9wcm92aWRlcgAAAAMAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAtjYXBhY2l0eV9jdQAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAQZ2V0X29yYWNsZV9wcmljZQAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAQdXBkYXRlX2N1X29yYWNsZQAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAARcmVnaXN0ZXJfcHJvdmlkZXIAAAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADW1ldGFkYXRhX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAAAAAAASc2V0X2Z1dHVyZXNfb3JhY2xlAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB2Z1dHVyZXMAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAUcmVkZWVtX2N1X2Zvcl9hY2Nlc3MAAAADAAAAAAAAAAZob2xkZXIAAAAAABMAAAAAAAAACXNlcmllc19pZAAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPuAAAAIA==",
        "AAAABAAAADVTdGFibGUgZXJyb3IgY29kZXMgZm9yIHRoZSBBUEVYIG1hcmtldHBsYWNlIGNvbnRyYWN0LgAAAAAAAAAAAAAFRXJyb3IAAAAAAAAVAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAAZQYXVzZWQAAAAAAAQAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAFAAAAAAAAAA1JbnZhbGlkUGFyYW1zAAAAAAAABgAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAAHAAAAAAAAABZJbnN1ZmZpY2llbnRDb2xsYXRlcmFsAAAAAAAIAAAAAAAAABRJbnN1ZmZpY2llbnRDYXBhY2l0eQAAAAkAAAAAAAAAE1Byb3ZpZGVyTm90QXBwcm92ZWQAAAAACgAAAAAAAAAQUHJvdmlkZXJOb3RGb3VuZAAAAAsAAAAAAAAADlNlcmllc05vdEZvdW5kAAAAAAAMAAAAAAAAAA5TZXJpZXNJbmFjdGl2ZQAAAAAADQAAAAAAAAAQU2xpcHBhZ2VFeGNlZWRlZAAAAA4AAAAAAAAAC1N0YWxlT3JhY2xlAAAAAA8AAAAAAAAADE1hdGhPdmVyZmxvdwAAABAAAAAAAAAAEFRpbWVsb2NrTm90UmVhZHkAAAARAAAAAAAAAA5Ob3RoaW5nUGVuZGluZwAAAAAAEgAAAAAAAAANSW5kZXhOb3RGb3VuZAAAAAAAABMAAAAAAAAAD1Vua25vd25HcHVNb2RlbAAAAAAUAAAAAAAAABVJbnN1ZmZpY2llbnRMaXF1aWRpdHkAAAAAAAAV",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAgAAADZTZWNvbmRzIGFmdGVyIHdoaWNoIENVIG9yYWNsZSBpcyBzdGFsZSBmb3Igc2V0dGxlbWVudC4AAAAAABBvcmFjbGVfc3RhbGVuZXNzAAAABgAAACZTZXR0bGVtZW50IGZlZSBvbiBjYXNoIHJlZGVlbSwgaW4gYnBzLgAAAAAAEnNldHRsZW1lbnRfZmVlX2JwcwAAAAAACw==",
        "AAAAAQAAAAAAAAAAAAAABlNlcmllcwAAAAAABgAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAAAAAAlhc2tfcHJpY2UAAAAAAAALAAAAAAAAAAtjb2VmZmljaWVudAAAAAALAAAAAAAAAAlncHVfbW9kZWwAAAAAAAARAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACXNwZWNfaGFzaAAAAAAAA+4AAAAg",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAHAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMUGVuZGluZ0FkbWluAAAAAAAAAAAAAAAGUGF1c2VyAAAAAAAAAAAAAAAAAAhWZXJpZmllcgAAAAAAAAAAAAAACVVzZGNUb2tlbgAAAAAAAAAAAAAAAAAADUZ1dHVyZXNPcmFjbGUAAAAAAAAAAAAAAAAAAAZQYXVzZWQAAAAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAAAAAAAAAAANVGltZWxvY2tEZWxheQAAAAAAAAAAAAAAAAAADlBlbmRpbmdVcGdyYWRlAAAAAAAAAAAAAAAAAA1QZW5kaW5nQ29uZmlnAAAAAAAAAAAAAAAAAAALT3JhY2xlUHJpY2UAAAAAAAAAAAAAAAAIT3JhY2xlVHMAAAAAAAAAAAAAABdQcm92aWRlckNvbGxhdGVyYWxUb3RhbAAAAAAAAAAAAAAAAA1JbmRleFBvb2xVc2RjAAAAAAAAAAAAAAAAAAAKRXNjcm93VXNkYwAAAAAAAAAAAAAAAAANSW5zdXJhbmNlRnVuZAAAAAAAAAAAAAAAAAAACEZlZVZhdWx0AAAAAAAAAAAAAAAMTmV4dFNlcmllc0lkAAAAAAAAAAAAAAAJU2VyaWVzSWRzAAAAAAAAAAAAAAAAAAAMSW5kZXhTeW1ib2xzAAAAAQAAAAAAAAALQ29lZmZpY2llbnQAAAAAAQAAABEAAAABAAAAAAAAAAhQcm92aWRlcgAAAAEAAAATAAAAAQAAAAAAAAAGU2VyaWVzAAAAAAABAAAABgAAAAEAAAAAAAAAB0JhbGFuY2UAAAAAAgAAAAYAAAATAAAAAQAAAAAAAAAJSW52ZW50b3J5AAAAAAAAAQAAAAYAAAABAAAAAAAAAAVJbmRleAAAAAAAAAEAAAARAAAAAQAAAAAAAAALSW5kZXhTaGFyZXMAAAAAAgAAABEAAAAT",
        "AAAAAQAAAAAAAAAAAAAACFByb3ZpZGVyAAAABgAAAAAAAAALY2FwYWNpdHlfY3UAAAAACwAAAAAAAAAKY29sbGF0ZXJhbAAAAAAACwAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAltaW50ZWRfY3UAAAAAAAALAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA5Qcm92aWRlclN0YXR1cwAA",
        "AAAAAQAAAAAAAAAAAAAACUluZGV4UG9vbAAAAAAAAAQAAABMTmF2IHByaWNlIG92ZXJyaWRlIG11bHRpcGxpZXIgdnMgQUNQSSAoU0NBTEUgPSAxLjApLiBNVlAgdXNlcyBBQ1BJIGRpcmVjdGx5LgAAAApuYXZfZmFjdG9yAAAAAAALAAAAAAAAAAZzeW1ib2wAAAAAABEAAAAAAAAADHRvdGFsX3NoYXJlcwAAAAsAAAAAAAAADHVzZGNfYmFsYW5jZQAAAAs=",
        "AAAAAQAAAAAAAAAAAAAADVBlbmRpbmdDb25maWcAAAAAAAACAAAAAAAAAAZjb25maWcAAAAAB9AAAAAGQ29uZmlnAAAAAAAAAAAAA2V0YQAAAAAG",
        "AAAAAQAAAAAAAAAAAAAADlBlbmRpbmdVcGdyYWRlAAAAAAACAAAAAAAAAANldGEAAAAABgAAAAAAAAAJd2FzbV9oYXNoAAAAAAAD7gAAACA=",
        "AAAAAwAAAAAAAAAAAAAADlByb3ZpZGVyU3RhdHVzAAAAAAADAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAACEFwcHJvdmVkAAAAAQAAAAAAAAAJU3VzcGVuZGVkAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
        scale: this.txFromJSON<i128>,
        buy_cu: this.txFromJSON<null>,
        mint_cu: this.txFromJSON<null>,
        sell_cu: this.txFromJSON<null>,
        set_ask: this.txFromJSON<null>,
        unpause: this.txFromJSON<null>,
        buy_index: this.txFromJSON<null>,
        get_admin: this.txFromJSON<string>,
        get_index: this.txFromJSON<IndexPool>,
        is_paused: this.txFromJSON<boolean>,
        redeem_cu: this.txFromJSON<null>,
        cu_balance: this.txFromJSON<i128>,
        get_config: this.txFromJSON<Config>,
        get_series: this.txFromJSON<Series>,
        set_pauser: this.txFromJSON<null>,
        get_buckets: this.txFromJSON<Buckets>,
        list_series: this.txFromJSON<Array<u64>>,
        transfer_cu: this.txFromJSON<null>,
        accept_admin: this.txFromJSON<null>,
        create_index: this.txFromJSON<null>,
        get_provider: this.txFromJSON<Provider>,
        get_verifier: this.txFromJSON<string>,
        index_shares: this.txFromJSON<i128>,
        redeem_index: this.txFromJSON<null>,
        set_verifier: this.txFromJSON<null>,
        cancel_config: this.txFromJSON<null>,
        create_series: this.txFromJSON<u64>,
        get_index_nav: this.txFromJSON<i128>,
        get_inventory: this.txFromJSON<i128>,
        cancel_upgrade: this.txFromJSON<null>,
        execute_config: this.txFromJSON<null>,
        propose_config: this.txFromJSON<null>,
        seed_insurance: this.txFromJSON<null>,
        slash_provider: this.txFromJSON<null>,
        transfer_admin: this.txFromJSON<null>,
        execute_upgrade: this.txFromJSON<null>,
        get_coefficient: this.txFromJSON<i128>,
        post_collateral: this.txFromJSON<null>,
        propose_upgrade: this.txFromJSON<null>,
        set_coefficient: this.txFromJSON<null>,
        approve_provider: this.txFromJSON<null>,
        get_oracle_price: this.txFromJSON<i128>,
        update_cu_oracle: this.txFromJSON<null>,
        register_provider: this.txFromJSON<null>,
        set_futures_oracle: this.txFromJSON<null>,
        redeem_cu_for_access: this.txFromJSON<Buffer>
  }
}
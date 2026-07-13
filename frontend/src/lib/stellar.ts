import {
  Horizon,
  rpc,
  TransactionBuilder,
  Account,
  Contract,
  Keypair,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { ENV } from '../config/env';

export const horizonServer = new Horizon.Server(ENV.horizonUrl);
export const rpcServer = new rpc.Server(ENV.rpcUrl);

// A valid, funded testnet account used purely as the source for read-only
// simulation (reads never touch its balance/sequence). Must be a checksum-valid
// strkey, so we derive it from a fixed keypair at load rather than hardcoding one.
const SIM_SOURCE = Keypair.random().publicKey();

export interface TokenBalances {
  xlm: string;
  usdc: string;
}

/** Read-only contract call via simulation. Returns the decoded native value. */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T | undefined> {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(new Account(SIM_SOURCE, '0'), {
    fee: '100',
    networkPassphrase: ENV.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    return scValToNative(sim.result.retval) as T;
  }
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  return undefined;
}

/**
 * Build + simulate a state-changing contract call and return the assembled XDR
 * (with resource fees/footprint) ready for the wallet to sign.
 */
export async function buildContractCall(
  sender: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<string> {
  const account = await rpcServer.getAccount(sender);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: ENV.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(parseSimError(sim.error));
  }
  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Submit a signed XDR and poll to completion; returns the tx hash. */
export async function submitSigned(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, ENV.networkPassphrase);
  const sent = await rpcServer.sendTransaction(tx);

  if (sent.status === 'ERROR') {
    throw new Error(`Submission rejected: ${JSON.stringify(sent.errorResult)}`);
  }

  const hash = sent.hash;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await rpcServer.getTransaction(hash);
    if (res.status === 'SUCCESS') return hash;
    if (res.status === 'FAILED') {
      throw new Error('Transaction failed during execution.');
    }
  }
  throw new Error('Transaction timed out awaiting confirmation.');
}

/** Fetch XLM + USDC balances for display. */
export async function fetchBalances(publicKey: string): Promise<TokenBalances> {
  try {
    const account = await horizonServer.loadAccount(publicKey);
    let xlm = '0';
    let usdc = '0';
    for (const b of account.balances) {
      if (b.asset_type === 'native') xlm = b.balance;
      else if ('asset_code' in b && b.asset_code === 'USDC') usdc = b.balance;
    }
    return { xlm: Number(xlm).toFixed(4), usdc: Number(usdc).toFixed(4) };
  } catch {
    return { xlm: '0.0000', usdc: '0.0000' };
  }
}

/** Extract a human-friendly reason from a raw simulation error string. */
function parseSimError(raw: string): string {
  // Contract errors surface as `Error(Contract, #N)` — map a few known codes.
  const match = raw.match(/Error\(Contract, #(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    return CONTRACT_ERRORS[code] ?? `Contract rejected the call (error #${code}).`;
  }
  if (raw.includes('trustline')) return 'Missing USDC trustline on your account.';
  return raw.length > 160 ? 'Simulation failed. Check inputs and balances.' : raw;
}

/** Mirror of the contract's #[contracterror] enum for friendly UI messages. */
const CONTRACT_ERRORS: Record<number, string> = {
  1: 'Contract already initialized.',
  2: 'Contract not initialized.',
  3: 'Not authorized for this action.',
  4: 'Contract is paused.',
  5: 'Amount must be positive.',
  6: 'Invalid parameters.',
  7: 'Equity is below the required initial margin.',
  8: 'Insufficient free margin for this order.',
  9: 'You already have an open position — close it first.',
  10: 'No active position found.',
  11: 'Insufficient liquidity in the vAMM.',
  12: 'Slippage exceeded — try a wider limit.',
  13: 'Position is not liquidatable.',
  14: 'Oracle price is stale.',
  15: 'Oracle deviation too large.',
  16: 'Arithmetic overflow.',
  17: 'Position size is below the minimum.',
  18: 'Funding settled too recently.',
  19: 'Governance timelock has not elapsed yet.',
  20: 'No pending governance action.',
};

import { 
  Server as HorizonServer, 
  rpc, 
  Networks, 
  TransactionBuilder, 
  Account, 
  Contract, 
  xdr, 
  scValToNative, 
  nativeToScVal 
} from '@stellar/stellar-sdk';

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const horizonServer = new HorizonServer(HORIZON_URL);
export const rpcServer = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Interface representing token balances returned to the UI
 */
export interface TokenBalances {
  xlm: string;
  usdc: string;
}

/**
 * Fetches XLM (native) and USDC balances for a given public key on Testnet.
 * Searches for custom assets named 'USDC' or falls back to SAC contract calls.
 */
export async function fetchBalances(publicKey: string, usdcAssetId?: string): Promise<TokenBalances> {
  try {
    const accountDetails = await horizonServer.loadAccount(publicKey);
    let xlmBalance = '0';
    let usdcBalance = '0';

    for (const bal of accountDetails.balances) {
      if (bal.asset_type === 'native') {
        xlmBalance = bal.balance;
      } else if (bal.asset_code === 'USDC') {
        usdcBalance = bal.balance;
      }
    }

    // If USDC is not found as a classic trustline, attempt to query the contract balance
    if (usdcBalance === '0' && usdcAssetId) {
      try {
        const balanceScVal = await queryContract(
          usdcAssetId,
          'balance',
          [nativeToScVal(publicKey, { type: 'address' })]
        );
        if (balanceScVal) {
          const rawBal = scValToNative(balanceScVal);
          // Scale down from 7 decimals
          usdcBalance = (Number(rawBal) / 10_000_000).toFixed(4);
        }
      } catch (err) {
        console.warn('Failed to fetch USDC balance from SAC contract directly:', err);
      }
    }

    return {
      xlm: Number(xlmBalance).toFixed(4),
      usdc: Number(usdcBalance).toFixed(4),
    };
  } catch (error) {
    console.error('Error fetching balances from Horizon:', error);
    return { xlm: '0.0000', usdc: '0.0000' };
  }
}

/**
 * Performs a read-only query on a Soroban smart contract using Soroban RPC.
 */
export async function queryContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<xdr.ScVal | undefined> {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(
    new Account('GBRP4WIHG6AVUVZ276JEXU2PA25QL5XS7V243CDZ647WBN2G2YGFEXFB', '0'),
    {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    }
  )
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await rpcServer.simulateTransaction(tx);
  
  if (rpc.Api.isSimulationSuccess(response)) {
    return response.result?.retval;
  } else {
    throw new Error(`Simulation failed: ${response.error || 'Unknown error'}`);
  }
}

/**
 * Builds and prepares a Soroban contract transaction with resource fee simulation.
 * Returns the base64-encoded transaction envelope (XDR).
 */
export async function prepareContractCall(
  sender: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<string> {
  // Load source account to get correct sequence number
  const account = await horizonServer.loadAccount(sender);
  const contract = new Contract(contractId);

  // Build the initial transaction
  let tx = new TransactionBuilder(account, {
    fee: '1000', // Starting base fee
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate the transaction to determine the footprints and resource fee
  const simulation = await rpcServer.simulateTransaction(tx);
  
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Transaction simulation failed: ${simulation.error}`);
  }

  // Assemble the simulated transaction containing resource fees and footprints
  tx = rpc.assembleTransaction(tx, simulation).build();

  return tx.toXDR();
}

/**
 * Submits a signed transaction envelope to the Soroban RPC server and waits for completion.
 */
export async function submitTransaction(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  let response = await rpcServer.sendTransaction(tx);

  if (response.status === 'ERROR') {
    throw new Error(`Failed to send transaction: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for the transaction result
  let status = response.status;
  const txHash = response.hash;
  
  let attempts = 0;
  while (status === 'PENDING' && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const txStatus = await rpcServer.getTransaction(txHash);
    status = txStatus.status;
    
    if (status === 'SUCCESS') {
      return txHash;
    } else if (status === 'FAILED') {
      throw new Error(`Transaction failed in execution: ${JSON.stringify(txStatus.resultResultXdr)}`);
    }
    attempts++;
  }

  if (status === 'PENDING') {
    throw new Error('Transaction execution timed out.');
  }

  return txHash;
}

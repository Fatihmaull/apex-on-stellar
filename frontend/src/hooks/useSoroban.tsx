'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  isConnected,
  requestAccess,
  signTransaction
} from '@stellar/freighter-api';
import { 
  nativeToScVal, 
  scValToNative, 
  xdr 
} from '@stellar/stellar-sdk';
import { 
  fetchBalances, 
  prepareContractCall, 
  submitTransaction, 
  queryContract,
  NETWORK_PASSPHRASE 
} from '../lib/stellar';

// Scale factor for 7 decimals (USDC / base reserves)
const SCALE = 10_000_000;

export interface PositionDetails {
  size: number;
  entryPrice: number;
  marginAllocated: number;
}

export interface Reserves {
  base: number;
  quote: number;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  message: string;
}

export interface SorobanContextType {
  publicKey: string | null;
  balances: { xlm: string; usdc: string } | null;
  isConnecting: boolean;
  loading: boolean;
  error: string | null;
  txResult: TransactionResult | null;
  markPrice: number;
  oraclePrice: number;
  healthFactor: number;
  userPosition: PositionDetails | null;
  reserves: Reserves | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshState: () => Promise<void>;
  clearTxResult: () => void;
  
  // Contract Actions
  depositMargin: (amount: number) => Promise<void>;
  withdrawMargin: (amount: number) => Promise<void>;
  openPosition: (size: number, isLong: boolean) => Promise<void>;
  closePosition: () => Promise<void>;
  updateOraclePrice: (price: number) => Promise<void>;
}

const SorobanContext = createContext<SorobanContextType | undefined>(undefined);

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'CD6NTAOM47O3VGW6774GHYPZ77R324WRM5OIQ5L7TOSXG2B6L64GHAEX';
export const USDC_ASSET_ID = process.env.NEXT_PUBLIC_USDC_ASSET_ID || 'CBG_MOCK_USDC_ASSET_ID';

export const SorobanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ xlm: string; usdc: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TransactionResult | null>(null);
  
  // Market Metrics
  const [markPrice, setMarkPrice] = useState(0);
  const [oraclePrice, setOraclePrice] = useState(0);
  const [healthFactor, setHealthFactor] = useState(100);
  const [userPosition, setUserPosition] = useState<PositionDetails | null>(null);
  const [reserves, setReserves] = useState<Reserves | null>(null);

  const clearTxResult = () => setTxResult(null);

  // Load contract read-only states
  const refreshContractData = useCallback(async (userAddress: string | null) => {
    try {
      // 1. Fetch current Mark Price
      const markPriceSc = await queryContract(CONTRACT_ID, 'get_mark_price');
      if (markPriceSc) {
        setMarkPrice(Number(scValToNative(markPriceSc)) / SCALE);
      }

      // 2. Fetch current Oracle Price
      const oraclePriceSc = await queryContract(CONTRACT_ID, 'get_oracle_price');
      if (oraclePriceSc) {
        setOraclePrice(Number(scValToNative(oraclePriceSc)) / SCALE);
      }

      // 3. Fetch vAMM Reserves
      const reservesSc = await queryContract(CONTRACT_ID, 'get_reserves');
      if (reservesSc) {
        const nativeReserves = scValToNative(reservesSc);
        setReserves({
          base: Number(nativeReserves.base) / SCALE,
          quote: Number(nativeReserves.quote) / SCALE,
        });
      }

      // 4. Fetch User specific states (if connected)
      if (userAddress) {
        const positionSc = await queryContract(
          CONTRACT_ID,
          'get_position_details',
          [nativeToScVal(userAddress, { type: 'address' })]
        );
        if (positionSc) {
          const rawPos = scValToNative(positionSc);
          setUserPosition({
            size: Number(rawPos.size) / SCALE,
            entryPrice: Number(rawPos.entry_price) / SCALE,
            marginAllocated: Number(rawPos.margin_allocated) / SCALE,
          });
        } else {
          setUserPosition(null);
        }

        const healthSc = await queryContract(
          CONTRACT_ID,
          'get_health_factor',
          [nativeToScVal(userAddress, { type: 'address' })]
        );
        if (healthSc) {
          setHealthFactor(Number(scValToNative(healthSc)) / SCALE);
        }
      } else {
        setUserPosition(null);
        setHealthFactor(100);
      }
    } catch (err) {
      console.error('Error fetching contract data:', err);
    }
  }, []);

  const refreshState = useCallback(async () => {
    if (publicKey) {
      const b = await fetchBalances(publicKey, USDC_ASSET_ID);
      setBalances(b);
      await refreshContractData(publicKey);
    } else {
      await refreshContractData(null);
    }
  }, [publicKey, refreshContractData]);

  // Handle wallet connection
  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const connection = await isConnected();
      if (connection.error || !connection.isConnected) {
        throw new Error('Freighter wallet extension is not installed or enabled.');
      }

      // Prompts the user to grant this site access, then returns their address
      const access = await requestAccess();
      if (access.error) {
        throw new Error(access.error.message);
      }
      if (!access.address) {
        throw new Error('Failed to retrieve public address from Freighter. Please log in.');
      }

      setPublicKey(access.address);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      setError(err.message || 'Wallet connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setBalances(null);
    setUserPosition(null);
    setHealthFactor(100);
  };

  // Perform full state refreshes on mount or key changes
  useEffect(() => {
    refreshState();
    // Poll updates every 15 seconds
    const interval = setInterval(refreshState, 15000);
    return () => clearInterval(interval);
  }, [refreshState]);

  // General wrapper to sign and execute a contract transaction
  const executeTransaction = async (method: string, args: xdr.ScVal[]) => {
    if (!publicKey) {
      throw new Error('Wallet not connected.');
    }
    setLoading(true);
    setError(null);
    setTxResult(null);

    try {
      // 1. Simulate and prepare transaction
      const rawTxXdr = await prepareContractCall(publicKey, CONTRACT_ID, method, args);
      
      // 2. Sign the transaction via Freighter
      const signed = await signTransaction(rawTxXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      });
      if (signed.error) {
        throw new Error(signed.error.message);
      }

      // 3. Submit transaction and poll for completion
      const txHash = await submitTransaction(signed.signedTxXdr);

      setTxResult({
        success: true,
        hash: txHash,
        message: `Transaction for "${method}" executed successfully!`,
      });

      await refreshState();
    } catch (err: any) {
      console.error(`Transaction "${method}" failed:`, err);
      setError(err.message || `Failed to submit transaction for ${method}`);
      setTxResult({
        success: false,
        message: err.message || `Failed to submit transaction for ${method}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Contract functions implementation
  const depositMargin = async (amount: number) => {
    const rawAmount = BigInt(Math.floor(amount * SCALE));
    const args = [
      nativeToScVal(publicKey, { type: 'address' }),
      nativeToScVal(rawAmount, { type: 'i128' }),
    ];
    await executeTransaction('deposit_margin', args);
  };

  const withdrawMargin = async (amount: number) => {
    const rawAmount = BigInt(Math.floor(amount * SCALE));
    const args = [
      nativeToScVal(publicKey, { type: 'address' }),
      nativeToScVal(rawAmount, { type: 'i128' }),
    ];
    await executeTransaction('withdraw_margin', args);
  };

  const openPosition = async (size: number, isLong: boolean) => {
    const rawSize = BigInt(Math.floor(size * SCALE));
    const args = [
      nativeToScVal(publicKey, { type: 'address' }),
      nativeToScVal(rawSize, { type: 'i128' }),
      nativeToScVal(isLong, { type: 'bool' }),
    ];
    await executeTransaction('open_position', args);
  };

  const closePosition = async () => {
    const args = [
      nativeToScVal(publicKey, { type: 'address' }),
    ];
    await executeTransaction('close_position', args);
  };

  const updateOraclePrice = async (price: number) => {
    const rawPrice = BigInt(Math.floor(price * SCALE));
    const args = [
      nativeToScVal(publicKey, { type: 'address' }),
      nativeToScVal(rawPrice, { type: 'i128' }),
    ];
    await executeTransaction('update_oracle', args);
  };

  return (
    <SorobanContext.Provider value={{
      publicKey,
      balances,
      isConnecting,
      loading,
      error,
      txResult,
      markPrice,
      oraclePrice,
      healthFactor,
      userPosition,
      reserves,
      connectWallet,
      disconnectWallet,
      refreshState,
      clearTxResult,
      depositMargin,
      withdrawMargin,
      openPosition,
      closePosition,
      updateOraclePrice
    }}>
      {children}
    </SorobanContext.Provider>
  );
};

export const useSoroban = () => {
  const context = useContext(SorobanContext);
  if (context === undefined) {
    throw new Error('useSoroban must be used within a SorobanProvider');
  }
  return context;
};

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useToast } from '../components/ui/Toast';
import { submitSigned, fetchBalances, type TokenBalances } from '../lib/stellar';
import * as C from '../lib/contract';

const POLL_MS = 12_000;

export interface UserState {
  freeMargin: number;
  healthFactor: number;
  position: C.Position;
  balances: TokenBalances | null;
}

const EMPTY_USER: UserState = {
  freeMargin: 0,
  healthFactor: 100,
  position: { size: 0, entryPrice: 0, marginAllocated: 0, isLong: false, isOpen: false },
  balances: null,
};

/**
 * Central protocol hook: polls market + user data and exposes write actions that
 * sign via the connected wallet and surface progress through the toast system.
 */
export function useProtocol() {
  const { address, status, signXdr } = useWalletStore();
  const { toast, update } = useToast();

  const [market, setMarket] = useState<C.MarketSnapshot | null>(null);
  const [user, setUser] = useState<UserState>(EMPTY_USER);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const refreshMarket = useCallback(async () => {
    try {
      const snap = await C.getMarketSnapshot();
      if (mounted.current) setMarket(snap);
    } catch (e) {
      console.error('market refresh failed', e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!address) {
      setUser(EMPTY_USER);
      return;
    }
    try {
      const [freeMargin, healthFactor, position, balances] = await Promise.all([
        C.getMarginBalance(address),
        C.getHealthFactor(address),
        C.getPosition(address),
        fetchBalances(address),
      ]);
      if (mounted.current) setUser({ freeMargin, healthFactor, position, balances });
    } catch (e) {
      console.error('user refresh failed', e);
    }
  }, [address]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMarket(), refreshUser()]);
  }, [refreshMarket, refreshUser]);

  useEffect(() => {
    mounted.current = true;
    refreshAll();
    const id = setInterval(refreshAll, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refreshAll]);

  /** Shared submit pipeline: build → sign → submit → toast → refresh. */
  const runTx = useCallback(
    async (label: string, build: () => Promise<string>) => {
      if (status !== 'connected' || !address) {
        toast({ variant: 'error', title: 'Connect a wallet first' });
        return false;
      }
      setBusy(true);
      const id = toast({ variant: 'pending', title: `${label}…`, description: 'Building transaction' });
      try {
        const xdr = await build();
        update(id, { description: 'Awaiting signature in your wallet' });
        const signed = await signXdr(xdr);
        update(id, { description: 'Submitting to the network' });
        const hash = await submitSigned(signed);
        update(id, { variant: 'success', title: `${label} confirmed`, description: undefined, txHash: hash });
        await refreshAll();
        return true;
      } catch (e) {
        update(id, {
          variant: 'error',
          title: `${label} failed`,
          description: e instanceof Error ? e.message : 'Unknown error',
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [address, status, signXdr, toast, update, refreshAll],
  );

  // --- Actions ---
  const deposit = (amount: number) => runTx('Deposit', () => C.buildDeposit(address!, amount));
  const withdraw = (amount: number) => runTx('Withdraw', () => C.buildWithdraw(address!, amount));
  const openPosition = (size: number, isLong: boolean, slippageLimit = 0) =>
    runTx(isLong ? 'Open Long' : 'Open Short', () => C.buildOpen(address!, size, isLong, slippageLimit));
  const closePosition = (slippageLimit = 0) =>
    runTx('Close Position', () => C.buildClose(address!, slippageLimit));
  const updateOracle = (price: number) =>
    runTx('Oracle Update', () => C.buildUpdateOracle(address!, price));
  const settleFunding = () => runTx('Settle Funding', () => C.buildSettleFunding(address!));

  return {
    market,
    user,
    busy,
    connected: status === 'connected',
    refreshAll,
    deposit,
    withdraw,
    openPosition,
    closePosition,
    updateOracle,
    settleFunding,
  };
}

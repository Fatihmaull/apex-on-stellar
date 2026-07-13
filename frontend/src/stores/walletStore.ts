'use client';

import { create } from 'zustand';
import { getWalletKit } from '../lib/walletKit';
import { ENV } from '../config/env';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

const LS_WALLET_ID = 'apex:selectedWalletId';

interface WalletState {
  address: string | null;
  walletId: string | null;
  status: WalletStatus;
  /** True when the connected wallet's network differs from the app's network. */
  networkMismatch: boolean;
  error: string | null;

  /** Open the wallet-kit modal and connect the chosen wallet. */
  connect: (walletId: string) => Promise<void>;
  /** Restore a prior session from localStorage on load. */
  restore: () => Promise<void>;
  disconnect: () => void;
  /** Sign a transaction XDR with the active wallet; returns the signed XDR. */
  signXdr: (xdr: string) => Promise<string>;
  setError: (msg: string | null) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  walletId: null,
  status: 'disconnected',
  networkMismatch: false,
  error: null,

  setError: (msg) => set({ error: msg }),

  connect: async (walletId: string) => {
    set({ status: 'connecting', error: null });
    try {
      const kit = getWalletKit();
      kit.setWallet(walletId);
      const { address } = await kit.getAddress();
      if (!address) throw new Error('No address returned by wallet.');

      // Detect network mismatch (wallet on a different network than configured).
      // `getNetwork` isn't in every kit typings version, so probe defensively.
      let mismatch = false;
      try {
        const getNetwork = (kit as { getNetwork?: () => Promise<unknown> }).getNetwork;
        if (getNetwork) {
          const net = await getNetwork.call(kit);
          const passphrase = (net as { networkPassphrase?: string })?.networkPassphrase;
          if (passphrase && passphrase !== ENV.networkPassphrase) mismatch = true;
        }
      } catch {
        // Non-fatal: some wallets don't expose network info.
      }

      localStorage.setItem(LS_WALLET_ID, walletId);
      set({ address, walletId, status: 'connected', networkMismatch: mismatch });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect wallet.';
      set({ status: 'disconnected', error: normalizeError(msg) });
      throw new Error(normalizeError(msg));
    }
  },

  restore: async () => {
    const walletId = typeof window !== 'undefined' ? localStorage.getItem(LS_WALLET_ID) : null;
    if (!walletId) return;
    try {
      const kit = getWalletKit();
      kit.setWallet(walletId);
      const { address } = await kit.getAddress();
      if (address) set({ address, walletId, status: 'connected' });
    } catch {
      // Session no longer valid (locked/uninstalled) — stay disconnected.
      localStorage.removeItem(LS_WALLET_ID);
    }
  },

  disconnect: () => {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_WALLET_ID);
    try {
      const kit = getWalletKit() as { disconnect?: () => void };
      kit.disconnect?.();
    } catch {
      /* noop */
    }
    set({ address: null, walletId: null, status: 'disconnected', networkMismatch: false, error: null });
  },

  signXdr: async (xdr: string) => {
    const { walletId, address } = get();
    if (!walletId || !address) throw new Error('Wallet not connected.');
    const kit = getWalletKit();
    kit.setWallet(walletId);
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      address,
      networkPassphrase: ENV.networkPassphrase,
    });
    return signedTxXdr;
  },
}));

/** Map common wallet SDK errors to friendly, user-facing messages. */
function normalizeError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('not installed') || m.includes('not available') || m.includes('no wallet'))
    return 'Wallet extension not found. Please install it and reload.';
  if (m.includes('reject') || m.includes('denied') || m.includes('declined'))
    return 'Connection request was rejected.';
  if (m.includes('locked')) return 'Wallet is locked. Unlock it and try again.';
  return raw;
}

'use client';

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import { ENV } from '../config/env';

/**
 * Singleton StellarWalletsKit instance. Wraps Freighter, Albedo, xBull and other
 * modules behind one API so the UI is wallet-agnostic. Instantiated lazily on the
 * client only (the kit touches window/globals).
 */
let kit: StellarWalletsKit | null = null;

export function getWalletKit(): StellarWalletsKit {
  if (typeof window === 'undefined') {
    throw new Error('WalletKit is only available in the browser');
  }
  if (!kit) {
    kit = new StellarWalletsKit({
      network: ENV.network === 'PUBLIC' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

export type { ISupportedWallet };
export { FREIGHTER_ID };

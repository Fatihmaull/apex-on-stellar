'use client';

import { useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';

/** Restores a prior wallet session on first client mount (auto-reconnect). */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const restore = useWalletStore((s) => s.restore);
  useEffect(() => {
    restore();
  }, [restore]);
  return <>{children}</>;
}

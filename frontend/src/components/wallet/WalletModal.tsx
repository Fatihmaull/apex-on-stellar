'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { getWalletKit, type ISupportedWallet } from '../../lib/walletKit';
import { useWalletStore } from '../../stores/walletStore';
import { useToast } from '../ui/Toast';

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [wallets, setWallets] = useState<ISupportedWallet[]>([]);
  const { connect } = useWalletStore();
  const status = useWalletStore((s) => s.status);
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getWalletKit()
      .getSupportedWallets()
      .then((w) => active && setWallets(w))
      .catch(() => active && setWallets([]));
    return () => {
      active = false;
    };
  }, [open]);

  const handleSelect = async (w: ISupportedWallet) => {
    if (!w.isAvailable) {
      // Not installed — send the user to the wallet's install page.
      toast({
        variant: 'info',
        title: `${w.name} not detected`,
        description: 'Install the wallet extension, then reload and try again.',
      });
      const installUrl = (w as { url?: string }).url;
      if (installUrl) window.open(installUrl, '_blank');
      return;
    }
    setPendingId(w.id);
    try {
      await connect(w.id);
      toast({ variant: 'success', title: `Connected with ${w.name}` });
      onClose();
    } catch (e) {
      toast({
        variant: 'error',
        title: 'Connection failed',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow="Stellar" title="Connect a wallet">
      <p className="mb-4 text-sm text-muted">
        Choose a wallet to trade compute futures on APEX. Your keys never leave your device.
      </p>
      <div className="flex flex-col gap-2">
        {wallets.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Detecting wallets…
          </div>
        )}
        {wallets.map((w) => (
          <motion.button
            key={w.id}
            whileHover={{ x: 2 }}
            onClick={() => handleSelect(w)}
            disabled={status === 'connecting'}
            className="group flex items-center gap-3 rounded-lg border border-line bg-ink-800 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-ink-600 disabled:opacity-60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.icon} alt="" className="h-8 w-8 rounded-md" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{w.name}</div>
              <div className="text-xs text-muted">
                {w.isAvailable ? 'Detected' : 'Not installed — click to get it'}
              </div>
            </div>
            {pendingId === w.id && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
          </motion.button>
        ))}
      </div>
    </Modal>
  );
}

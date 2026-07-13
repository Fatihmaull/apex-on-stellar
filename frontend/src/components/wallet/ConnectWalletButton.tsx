'use client';

import React, { useState } from 'react';
import { Wallet, Copy, ExternalLink, LogOut, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { WalletModal } from './WalletModal';
import { useWalletStore } from '../../stores/walletStore';
import { useToast } from '../ui/Toast';
import { truncate, copyToClipboard } from '../../lib/utils';
import { explorerAccount } from '../../config/env';

/** Dynamic connect control: opens the wallet picker when disconnected, shows an
 *  account dropdown (copy / explorer / disconnect) when connected. */
export function ConnectWalletButton() {
  const [open, setOpen] = useState(false);
  const { address, status, networkMismatch, disconnect } = useWalletStore();
  const { toast } = useToast();

  if (status !== 'connected' || !address) {
    return (
      <>
        <Button onClick={() => setOpen(true)} loading={status === 'connecting'} size="md">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
        <WalletModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {networkMismatch && (
        <span className="hidden items-center gap-1 rounded-pill border border-ember/40 bg-ember/10 px-2.5 py-1 font-mono text-[10px] uppercase text-ember sm:inline-flex">
          <AlertTriangle className="h-3 w-3" /> Wrong network
        </span>
      )}
      <Dropdown
        trigger={
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-700 px-3 py-2 transition-colors hover:border-white/20">
            <span className="h-2 w-2 rounded-full bg-up" />
            <span className="font-mono text-sm text-white">{truncate(address, 4, 4)}</span>
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
        }
        items={[
          {
            label: 'Copy Address',
            icon: <Copy className="h-4 w-4" />,
            onClick: async () => {
              const ok = await copyToClipboard(address);
              toast({
                variant: ok ? 'success' : 'error',
                title: ok ? 'Address copied' : 'Copy failed',
              });
            },
          },
          {
            label: 'View on Explorer',
            icon: <ExternalLink className="h-4 w-4" />,
            onClick: () => window.open(explorerAccount(address), '_blank'),
          },
          {
            label: 'Disconnect',
            icon: <LogOut className="h-4 w-4" />,
            tone: 'danger',
            onClick: () => {
              disconnect();
              toast({ variant: 'info', title: 'Wallet disconnected' });
            },
          },
        ]}
      />
    </div>
  );
}

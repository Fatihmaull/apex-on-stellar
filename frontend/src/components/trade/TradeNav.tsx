'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '../Logo';
import { Badge } from '../ui/Badge';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import { ENV } from '../../config/env';

export function TradeNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Logo />
          </Link>
          <Badge tone="accent">Compute Futures</Badge>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-subtle sm:inline">
            {ENV.network}
          </span>
        </div>
        <ConnectWalletButton />
      </div>
    </header>
  );
}

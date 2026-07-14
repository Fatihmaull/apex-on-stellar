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
          <Badge tone="accent">Futures</Badge>
          <nav className="ml-2 hidden gap-3 font-mono text-[10px] uppercase tracking-wider text-subtle md:flex">
            <Link href="/trade" className="text-white">
              Hedge
            </Link>
            <Link href="/trade/market" className="hover:text-white">
              Spot CU
            </Link>
            <Link href="/trade/index" className="hover:text-white">
              Index
            </Link>
            <Link href="/app" className="hover:text-white">
              Roles
            </Link>
          </nav>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-subtle sm:inline">
            {ENV.network}
          </span>
        </div>
        <ConnectWalletButton />
      </div>
    </header>
  );
}

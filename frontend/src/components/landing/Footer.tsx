import React from 'react';
import Link from 'next/link';
import { Logo } from '../Logo';

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-subtle">
            APEX — APAC Compute Exchange. A decentralized, cash-settled compute-futures protocol on
            Stellar. Testnet software; not financial advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs uppercase tracking-wider text-muted">
          <Link href="/trade" className="transition-colors hover:text-white">
            Exchange
          </Link>
          <a href="#product" className="transition-colors hover:text-white">
            Product
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <span className="text-subtle">© {new Date().getFullYear()} APEX</span>
        </div>
      </div>
    </footer>
  );
}

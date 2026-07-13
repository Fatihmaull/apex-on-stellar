import React from 'react';
import Link from 'next/link';
import { Logo } from '../Logo';

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Exchange', href: '/trade' },
      { label: 'Index', href: '#index' },
      { label: 'Problem', href: '#problem' },
    ],
  },
  {
    title: 'Protocol',
    links: [
      { label: 'Infrastructure', href: '#infrastructure' },
      { label: 'Stellar Testnet', href: 'https://stellar.expert/explorer/testnet' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink-900">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-fg-faint">
              APEX — APAC Compute Exchange. A decentralized, cash-settled compute-futures
              protocol on Stellar. Testnet software; not financial advice.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="label mb-4">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="link-reveal font-mono text-xs text-fg-dim hover:text-fg"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-2 border-t border-line pt-6 md:flex-row md:items-center">
          <span className="font-mono text-[11px] uppercase tracking-wider text-fg-ghost">
            © {new Date().getFullYear()} APEX · APAC Compute Exchange
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-fg-ghost">
            Built on Stellar · Soroban
          </span>
        </div>
      </div>
    </footer>
  );
}

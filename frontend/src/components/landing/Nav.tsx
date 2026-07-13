'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '../Logo';

const LINKS = [
  { label: 'Index', href: '#index' },
  { label: 'Problem', href: '#problem' },
  { label: 'Infrastructure', href: '#infrastructure' },
];

/** Minimal mono navigation (ornn-style). */
export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        <Link href="/" aria-label="APEX home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="link-reveal font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <Link
          href="/trade"
          className="font-mono text-[11px] uppercase tracking-wider text-fg link-reveal"
        >
          Launch App
        </Link>
      </div>
    </header>
  );
}

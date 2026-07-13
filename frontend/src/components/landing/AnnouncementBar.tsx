'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Thin top banner, ornn-style ("Ornn Just Raised $33M …"). */
export function AnnouncementBar() {
  return (
    <Link
      href="/trade"
      className="group block border-b border-line bg-ink-900 text-center"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-up" />
        <span>Live on Stellar Testnet · Trade the APAC GPU Index</span>
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

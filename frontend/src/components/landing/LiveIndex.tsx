'use client';

import React from 'react';
import { useIndex } from '../../hooks/useIndex';
import { fmtUsd } from '../../lib/utils';

function fmtUtc(d: Date | null): string {
  if (!d) return '—';
  return d
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    })
    .toUpperCase();
}

/** Hero centerpiece: the live on-chain APAC GPU Index price (ornn OCPI style). */
export function LiveIndex() {
  const { index, updatedAt, live } = useIndex();

  return (
    <div className="flex flex-col items-center text-center">
      <div className="font-display text-6xl font-medium tracking-tightest text-fg tabular md:text-8xl">
        ${fmtUsd(index, 2)}
      </div>
      <div className="label mt-3">APAC GPU Index Price</div>
      <div className="mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-faint">
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-blink bg-up' : 'bg-fg-ghost'}`}
        />
        Index updated
        <span className="text-fg-dim">&lt; {fmtUtc(updatedAt)} UTC &gt;</span>
      </div>
    </div>
  );
}

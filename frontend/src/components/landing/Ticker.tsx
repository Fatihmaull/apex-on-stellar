'use client';

import React from 'react';

const ITEMS = [
  { sym: 'H100 · SIN', px: '2.41', chg: '+1.8%' },
  { sym: 'H100 · JHR', px: '2.36', chg: '-0.4%' },
  { sym: 'B200 · SIN', px: '5.12', chg: '+3.1%' },
  { sym: 'GB200 · IDN', px: '7.88', chg: '+0.9%' },
  { sym: 'A100 · MYS', px: '1.54', chg: '-1.2%' },
  { sym: 'APAC GPU IDX', px: '3.90', chg: '+1.1%' },
];

/** Infinite marquee of APAC GPU index quotes — a Bloomberg-style ribbon. */
export function Ticker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-line bg-ink-800/60">
      <div className="flex w-max animate-marquee gap-8 py-2.5">
        {row.map((it, i) => (
          <div key={i} className="flex shrink-0 items-center gap-2 font-mono text-xs">
            <span className="text-muted">{it.sym}</span>
            <span className="text-white tabular">${it.px}</span>
            <span className={it.chg.startsWith('-') ? 'text-down' : 'text-up'}>{it.chg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { fmtUsd, fmtPct, fmtCompact } from '../../lib/utils';
import type { MarketSnapshot } from '../../lib/contract';

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px] flex-1 px-4 py-3">
      <div className="label mb-1.5">{label}</div>
      <div className="font-mono text-lg font-semibold text-white tabular">{children}</div>
    </div>
  );
}

export function StatsBar({ market }: { market: MarketSnapshot | null }) {
  if (!market) {
    return (
      <div className="surface flex flex-wrap divide-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-w-[140px] flex-1 px-4 py-3">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const premium =
    market.oraclePrice > 0
      ? ((market.markPrice - market.oraclePrice) / market.oraclePrice) * 100
      : 0;
  const depth = market.reserves.base * market.reserves.quote;

  return (
    <div className="surface flex flex-wrap items-stretch divide-x divide-line">
      <Item label="vAMM Mark">
        <span className="text-accent">${fmtUsd(market.markPrice, 4)}</span>
      </Item>
      <Item label="APAC GPU Index">${fmtUsd(market.oraclePrice, 4)}</Item>
      <Item label="Premium / Discount">
        <span className={premium >= 0 ? 'text-up' : 'text-down'}>{fmtPct(premium)}</span>
      </Item>
      <Item label="Insurance Fund">${fmtUsd(market.buckets.insuranceFund)}</Item>
      <Item label="vAMM Depth (k)">
        <span className="text-base">{fmtCompact(depth)}</span>
      </Item>
      <div className="flex items-center px-4 py-3">
        {market.paused ? (
          <Badge tone="warn">Paused</Badge>
        ) : (
          <Badge tone="up">Live</Badge>
        )}
      </div>
    </div>
  );
}

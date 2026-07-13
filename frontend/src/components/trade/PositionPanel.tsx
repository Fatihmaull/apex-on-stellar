'use client';

import React from 'react';
import { Card, CardHeader, Stat } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { fmtUsd, fmtPct, cn } from '../../lib/utils';
import type { useProtocol } from '../../hooks/useProtocol';
import type { MarketSnapshot } from '../../lib/contract';

type Protocol = ReturnType<typeof useProtocol>;

function healthLabel(hf: number): { tone: 'up' | 'warn' | 'down'; text: string; pct: number } {
  const pct = Math.max(0, Math.min(100, (Math.min(hf, 2) / 2) * 100));
  if (hf >= 1.5) return { tone: 'up', text: 'Healthy', pct };
  if (hf >= 1.0) return { tone: 'warn', text: 'Caution', pct };
  return { tone: 'down', text: 'Liquidatable', pct };
}

export function PositionPanel({ protocol, market }: { protocol: Protocol; market: MarketSnapshot | null }) {
  const { user, busy, closePosition } = protocol;
  const pos = user.position;
  const mark = market?.markPrice ?? 0;

  if (!pos.isOpen) {
    return (
      <Card>
        <CardHeader eyebrow="Portfolio" title="Active Position" />
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-line text-center">
          <p className="text-sm text-muted">No open position.</p>
          <p className="mt-1 text-xs text-subtle">Deposit collateral and open a trade to begin.</p>
        </div>
      </Card>
    );
  }

  const sizeAbs = Math.abs(pos.size);
  const notional = sizeAbs * mark;
  const entryValue = sizeAbs * pos.entryPrice;
  const pnl = pos.isLong ? notional - entryValue : entryValue - notional;
  const pnlPct = pos.marginAllocated > 0 ? (pnl / pos.marginAllocated) * 100 : 0;
  const health = healthLabel(user.healthFactor);

  return (
    <Card>
      <CardHeader
        eyebrow="Portfolio"
        title="Active Position"
        action={<Badge tone={pos.isLong ? 'up' : 'down'}>{pos.isLong ? 'Long' : 'Short'}</Badge>}
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Size" value={`${fmtUsd(sizeAbs)} `} sub="V-GPU hrs" />
        <Stat label="Entry" value={`$${fmtUsd(pos.entryPrice, 4)}`} />
        <Stat label="Collateral" value={`$${fmtUsd(pos.marginAllocated)}`} accent="accent" />
        <Stat label="Notional" value={`$${fmtUsd(notional)}`} />
        <Stat
          label="uPnL"
          value={`${pnl >= 0 ? '+' : ''}$${fmtUsd(pnl)}`}
          sub={fmtPct(pnlPct)}
          accent={pnl >= 0 ? 'up' : 'down'}
        />
        <Stat label="Health" value={user.healthFactor.toFixed(2)} accent={health.tone === 'down' ? 'down' : 'default'} />
      </div>

      {/* Health factor bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Health Factor</span>
          <Badge tone={health.tone}>{health.text}</Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-ink-600">
          <div
            className={cn(
              'h-full rounded-pill transition-all',
              health.tone === 'up' && 'bg-up',
              health.tone === 'warn' && 'bg-ember',
              health.tone === 'down' && 'bg-down',
            )}
            style={{ width: `${health.pct}%` }}
          />
        </div>
      </div>

      <Button className="mt-5" fullWidth variant="danger" loading={busy} onClick={() => closePosition(0)}>
        Market Close Position
      </Button>
    </Card>
  );
}

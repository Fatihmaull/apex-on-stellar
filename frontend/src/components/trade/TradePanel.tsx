'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { fmtUsd } from '../../lib/utils';
import type { useProtocol } from '../../hooks/useProtocol';
import type { MarketSnapshot } from '../../lib/contract';

type Protocol = ReturnType<typeof useProtocol>;

const SLIPPAGE_PCT = 1.0; // 1% default tolerance applied to the notional bound

export function TradePanel({ protocol, market }: { protocol: Protocol; market: MarketSnapshot | null }) {
  const { user, connected, busy, openPosition } = protocol;
  const [isLong, setIsLong] = useState(true);
  const [size, setSize] = useState('');

  const mark = market?.markPrice ?? 0;
  const sizeNum = Number(size);
  const hasPosition = user.position.isOpen;

  // The contract locks EXACTLY init_margin_bps of notional as margin, so leverage
  // is fixed (leverage = BPS_DENOM / init_margin_bps). There is no per-order
  // leverage input on-chain — showing a slider would misrepresent the position.
  const initMarginBps = market?.initMarginBps ?? 2000;
  const leverage = Math.round(10000 / initMarginBps); // e.g. 2000 => 5x
  const initMarginPct = initMarginBps / 100; // e.g. 20%

  // Estimated notional & margin — computed from the same on-chain ratio the
  // contract applies, so the number the user sees matches what executes.
  const estimate = useMemo(() => {
    if (!sizeNum || !mark) return null;
    const notional = sizeNum * mark;
    const requiredMargin = (notional * initMarginBps) / 10000;
    const fee = notional * 0.001;
    return { notional, requiredMargin, fee };
  }, [sizeNum, mark, initMarginBps]);

  const valid = connected && sizeNum > 0 && !busy && !hasPosition;

  const submit = async () => {
    if (!valid || !estimate) return;
    // Slippage bound on the entry notional: long caps max cost, short floors min proceeds.
    const bound = isLong
      ? estimate.notional * (1 + SLIPPAGE_PCT / 100)
      : estimate.notional * (1 - SLIPPAGE_PCT / 100);
    const ok = await openPosition(sizeNum, isLong, bound);
    if (ok) setSize('');
  };

  return (
    <Card>
      <CardHeader eyebrow="Trade" title="Open Position" />

      {/* Long / Short toggle */}
      <div className="relative mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-800 p-1">
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-md ${
            isLong ? 'left-1 bg-up/15' : 'left-[calc(50%+0px)] bg-down/15'
          }`}
        />
        <button
          onClick={() => setIsLong(true)}
          className={`relative z-10 py-2.5 font-mono text-sm uppercase tracking-wider transition-colors ${
            isLong ? 'text-up' : 'text-muted hover:text-white'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setIsLong(false)}
          className={`relative z-10 py-2.5 font-mono text-sm uppercase tracking-wider transition-colors ${
            !isLong ? 'text-down' : 'text-muted hover:text-white'
          }`}
        >
          Short
        </button>
      </div>

      <Input
        label="Size (V-GPU hours)"
        type="number"
        min="0"
        step="1"
        placeholder="0.00"
        suffix="V-GPU"
        value={size}
        onChange={(e) => setSize(e.target.value)}
        disabled={!connected || busy || hasPosition}
      />

      {/* Leverage — fixed by the on-chain initial-margin ratio (read live). */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-ink-800/60 px-3 py-2.5">
        <span className="label">Leverage (fixed)</span>
        <span className="font-mono text-sm font-semibold text-accent">
          {leverage}× · {initMarginPct}% margin
        </span>
      </div>

      {/* Estimate readout */}
      <div className="mt-4 space-y-1.5 rounded-lg border border-line bg-ink-800/60 p-3 font-mono text-xs">
        <Row label="Entry (mark)" value={mark ? `$${fmtUsd(mark, 4)}` : '—'} />
        <Row label="Est. notional" value={estimate ? `$${fmtUsd(estimate.notional)}` : '—'} />
        <Row label="Est. margin" value={estimate ? `$${fmtUsd(estimate.requiredMargin)}` : '—'} />
        <Row label="Trading fee (0.1%)" value={estimate ? `$${fmtUsd(estimate.fee)}` : '—'} />
        <Row label="Slippage tol." value={`${SLIPPAGE_PCT.toFixed(1)}%`} />
      </div>

      <Button
        className="mt-4"
        fullWidth
        variant={isLong ? 'success' : 'danger'}
        loading={busy}
        disabled={!valid}
        onClick={submit}
      >
        {hasPosition ? 'Close current position first' : isLong ? 'Open Long' : 'Open Short'}
      </Button>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-white tabular">{value}</span>
    </div>
  );
}

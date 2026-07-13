'use client';

import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { fmtUsd } from '../../lib/utils';
import type { useProtocol } from '../../hooks/useProtocol';

type Protocol = ReturnType<typeof useProtocol>;

export function MarginPanel({ protocol }: { protocol: Protocol }) {
  const { user, connected, busy, deposit, withdraw } = protocol;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');

  const value = Number(amount);
  const valid = connected && value > 0 && !busy;

  const submit = async () => {
    if (!valid) return;
    const ok = mode === 'deposit' ? await deposit(value) : await withdraw(value);
    if (ok) setAmount('');
  };

  return (
    <Card>
      <CardHeader eyebrow="Collateral" title="Margin Account" />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-ink-800/60 border border-line px-3 py-3">
          <div className="label mb-1.5">Free Margin</div>
          <div className="font-mono text-base font-semibold text-white tabular">
            ${fmtUsd(user.freeMargin)}
          </div>
        </div>
        <div className="rounded-lg bg-ink-800/60 border border-line px-3 py-3">
          <div className="label mb-1.5">Wallet USDC</div>
          <div className="font-mono text-base font-semibold text-white tabular">
            {user.balances ? user.balances.usdc : '—'}
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-ink-800 p-1">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              mode === m ? 'bg-ink-600 text-white' : 'text-muted hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Input
        label="Amount"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        suffix="USDC"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={!connected || busy}
      />

      <Button className="mt-4" fullWidth loading={busy} disabled={!valid} onClick={submit}>
        {mode === 'deposit' ? (
          <>
            <ArrowDownToLine className="h-4 w-4" /> Deposit
          </>
        ) : (
          <>
            <ArrowUpFromLine className="h-4 w-4" /> Withdraw
          </>
        )}
      </Button>
    </Card>
  );
}

'use client';

import React, { useState } from 'react';
import { Radio, Timer } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { useProtocol } from '../../hooks/useProtocol';

type Protocol = ReturnType<typeof useProtocol>;

/**
 * GRC oracle control — pushes an APAC GPU Index price and settles funding.
 * In production these are permissioned (oracle multisig / keeper); exposed here
 * for testnet evaluation. The contract still enforces the updater RBAC + funding
 * interval, so unauthorized callers are rejected on-chain.
 */
export function OracleSimulator({ protocol }: { protocol: Protocol }) {
  const { connected, busy, updateOracle, settleFunding } = protocol;
  const [price, setPrice] = useState('');
  const value = Number(price);

  const push = async () => {
    if (!(value > 0)) return;
    const ok = await updateOracle(value);
    if (ok) setPrice('');
  };

  return (
    <Card>
      <CardHeader
        eyebrow="GRC Oracle"
        title="Index & Funding"
        action={<Badge tone="warn">Keeper</Badge>}
      />
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Publish an APAC GPU Index price to move the mark/spot premium and drive PnL, funding and
        liquidations. Restricted to the registered oracle updater on-chain.
      </p>

      <Input
        label="New Index Price"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 5.50"
        suffix="USDC"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={!connected || busy}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" loading={busy} disabled={!connected || !(value > 0)} onClick={push}>
          <Radio className="h-4 w-4" /> Push Price
        </Button>
        <Button variant="ghost" loading={busy} disabled={!connected} onClick={() => settleFunding()}>
          <Timer className="h-4 w-4" /> Settle Funding
        </Button>
      </div>
    </Card>
  );
}

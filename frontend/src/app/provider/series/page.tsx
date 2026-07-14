'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '../../../components/Logo';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConnectWalletButton } from '../../../components/wallet/ConnectWalletButton';
import { useWalletStore } from '../../../stores/walletStore';
import {
  buildCreateSeries,
  buildMintCu,
  buildSetAsk,
  getCoefficient,
  marketplaceReady,
} from '../../../lib/marketplace';
import { useToast } from '../../../components/ui/Toast';
import { submitSigned } from '../../../lib/stellar';

const MODELS = ['H100', 'H200', 'B200', 'GB200', 'A100', 'RTX4090'];

export default function ProviderSeriesPage() {
  const address = useWalletStore((s) => s.address);
  const signXdr = useWalletStore((s) => s.signXdr);
  const { toast } = useToast();
  const [model, setModel] = useState('H100');
  const [ask, setAsk] = useState('5.00');
  const [seriesId, setSeriesId] = useState('1');
  const [mintAmt, setMintAmt] = useState('10');
  const [coeff, setCoeff] = useState<number | null>(1);
  const [busy, setBusy] = useState(false);

  const refreshCoeff = async (m: string) => {
    setModel(m);
    setCoeff(await getCoefficient(m));
  };

  const create = async () => {
    if (!address) return toast({ variant: 'info', title: 'Connect wallet' });
    if (!marketplaceReady()) {
      return toast({
        variant: 'info',
        title: 'Preview',
        description: 'Series create requires NEXT_PUBLIC_MARKETPLACE_ID',
      });
    }
    setBusy(true);
    try {
      const xdr = await buildCreateSeries(address, model, Number(ask));
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'Series created' });
    } catch (e) {
      toast({ variant: 'error', title: 'Create failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const mint = async () => {
    if (!address) return;
    if (!marketplaceReady()) {
      return toast({ variant: 'info', title: 'Preview — mint disabled offline' });
    }
    setBusy(true);
    try {
      const xdr = await buildMintCu(address, Number(seriesId), Number(mintAmt));
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'CU minted to inventory' });
    } catch (e) {
      toast({ variant: 'error', title: 'Mint failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const updateAsk = async () => {
    if (!address || !marketplaceReady()) return;
    setBusy(true);
    try {
      const xdr = await buildSetAsk(address, Number(seriesId), Number(ask));
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'Ask updated' });
    } catch (e) {
      toast({ variant: 'error', title: 'Ask failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-ink-900 text-white">
      <header className="border-b border-line bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/provider">
              <Logo />
            </Link>
            <Badge>Series</Badge>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-10 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl">CU series</h1>
          <p className="mt-2 text-sm text-white/55">
            Pick a GPU model — coefficient auto-fills from the on-chain table (cu-spec).
          </p>
        </div>

        <section className="space-y-4 border border-line p-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-subtle">Create</h2>
          <label className="label block">GPU model</label>
          <select
            className="w-full border border-line bg-ink-800 px-3 py-2.5 font-mono text-sm"
            value={model}
            onChange={(e) => void refreshCoeff(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="font-mono text-xs text-subtle">
            Coefficient (HEH): {coeff ?? '—'}
          </p>
          <Input
            label="Ask (USDC / CU)"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
          />
          <Button loading={busy} onClick={create}>
            Create series
          </Button>
        </section>

        <section className="space-y-4 border border-line p-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-subtle">
            Mint / set ask
          </h2>
          <Input
            label="Series id"
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
          />
          <Input
            label="Mint amount (CU)"
            value={mintAmt}
            onChange={(e) => setMintAmt(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button loading={busy} onClick={mint}>
              Mint CU
            </Button>
            <Button variant="secondary" loading={busy} onClick={updateAsk}>
              Update ask
            </Button>
          </div>
        </section>

        <Link href="/provider" className="block font-mono text-xs text-subtle">
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}

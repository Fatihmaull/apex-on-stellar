'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '../../../components/Logo';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConnectWalletButton } from '../../../components/wallet/ConnectWalletButton';
import { useWalletStore } from '../../../stores/walletStore';
import {
  buildBuyCu,
  buildRedeemCu,
  buildRedeemForAccess,
  listSeries,
  marketplaceReady,
  type SeriesView,
} from '../../../lib/marketplace';
import { clearStoredRole } from '../../../lib/role';
import { useToast } from '../../../components/ui/Toast';
import { submitSigned } from '../../../lib/stellar';
import { useRouter } from 'next/navigation';

export default function MarketplacePage() {
  const router = useRouter();
  const address = useWalletStore((s) => s.address);
  const signXdr = useWalletStore((s) => s.signXdr);
  const { toast } = useToast();
  const [series, setSeries] = useState<SeriesView[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSeries().then(setSeries).catch(console.error);
  }, []);

  const filtered =
    filter === 'ALL' ? series : series.filter((s) => s.gpuModel.startsWith(filter));

  const buy = async (s: SeriesView) => {
    if (!address) return toast({ variant: 'info', title: 'Connect wallet' });
    if (!marketplaceReady()) {
      return toast({
        variant: 'info',
        title: 'Preview marketplace',
        description: 'Demo fixtures — connect after NEXT_PUBLIC_MARKETPLACE_ID is set.',
      });
    }
    setBusy(true);
    try {
      const qty = Number(amount);
      const max = qty * s.askPrice * 1.05;
      const xdr = await buildBuyCu(address, s.id, qty, max);
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: `Bought ${qty} CU` });
    } catch (e) {
      toast({ variant: 'error', title: 'Buy failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async (s: SeriesView, access: boolean) => {
    if (!address || !marketplaceReady()) {
      return toast({
        variant: 'info',
        title: access ? 'Compute redeem (preview)' : 'Cash redeem',
        description: access
          ? 'Coming to mainnet — mock voucher path when marketplace is live.'
          : 'Requires live marketplace id.',
      });
    }
    setBusy(true);
    try {
      const qty = Number(amount);
      const xdr = access
        ? await buildRedeemForAccess(address, s.id, qty)
        : await buildRedeemCu(address, s.id, qty);
      await submitSigned(await signXdr(xdr));
      toast({
        variant: 'success',
        title: access ? 'Access voucher minted (mock)' : 'Cash redeemed',
      });
    } catch (e) {
      toast({ variant: 'error', title: 'Redeem failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo />
            </Link>
            <Badge tone="accent">CU Marketplace</Badge>
          </div>
          <nav className="hidden items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-subtle sm:flex">
            <Link href="/trade/market" className="text-white">
              Spot
            </Link>
            <Link href="/trade/index" className="hover:text-white">
              Index
            </Link>
            <Link href="/trade" className="hover:text-white">
              Futures
            </Link>
            <button
              type="button"
              className="hover:text-white"
              onClick={() => {
                clearStoredRole();
                router.push('/app');
              }}
            >
              Role
            </button>
          </nav>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Per-provider CU series</h1>
            <p className="mt-2 text-sm text-white/55">
              Fixed-ask spot. 1 CU = 1 H100-equivalent GPU-hour.
            </p>
          </div>
          {!marketplaceReady() && <Badge tone="warn">Preview fixtures</Badge>}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {['ALL', 'H', 'A', 'RTX'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
                filter === f ? 'border-accent text-accent' : 'border-line text-subtle'
              }`}
            >
              {f === 'H' ? 'H100/H200' : f === 'A' ? 'A100' : f === 'RTX' ? 'RTX' : 'All'}
            </button>
          ))}
          <div className="ml-auto w-36">
            <Input
              label="Amount (CU)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <article key={s.id} className="border border-line bg-ink-800/40 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-subtle">Series #{s.id}</div>
                  <h2 className="mt-1 font-display text-xl">{s.gpuModel}</h2>
                </div>
                <Badge tone={s.active ? 'up' : 'down'}>{s.active ? 'Live' : 'Off'}</Badge>
              </div>
              <dl className="mt-4 space-y-1 font-mono text-xs text-white/70">
                <div className="flex justify-between">
                  <dt>Ask</dt>
                  <dd className="tabular">${s.askPrice.toFixed(2)} / CU</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Coeff</dt>
                  <dd className="tabular">{s.coefficient.toFixed(2)} HEH</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Inventory</dt>
                  <dd className="tabular">{s.inventory.toFixed(1)} CU</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Provider</dt>
                  <dd className="truncate text-right text-subtle">{s.provider}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-col gap-2">
                <Button size="sm" loading={busy} onClick={() => void buy(s)}>
                  Buy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => void redeem(s, false)}
                >
                  Redeem cash
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy}
                  onClick={() => void redeem(s, true)}
                >
                  Redeem for compute (preview)
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

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
  buildBuyIndex,
  buildRedeemIndex,
  getCuOraclePrice,
  getIndexNav,
  indexShares,
  marketplaceReady,
} from '../../../lib/marketplace';
import { useToast } from '../../../components/ui/Toast';
import { submitSigned } from '../../../lib/stellar';

const INDICES = [
  { symbol: 'CUINDEX', label: 'CU-INDEX', blurb: 'Broad APAC compute — IHSG for GPUs' },
  { symbol: 'CUNVDA', label: 'CUNVDA', blurb: 'Nvidia-tilted sector sub-index' },
];

export default function IndexPage() {
  const address = useWalletStore((s) => s.address);
  const signXdr = useWalletStore((s) => s.signXdr);
  const { toast } = useToast();
  const [acpi, setAcpi] = useState(5);
  const [navs, setNavs] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Record<string, number>>({});
  const [usdc, setUsdc] = useState('50');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setAcpi(await getCuOraclePrice());
    const next: Record<string, number> = {};
    const sh: Record<string, number> = {};
    for (const i of INDICES) {
      next[i.symbol] = await getIndexNav(i.symbol);
      if (address) sh[i.symbol] = await indexShares(i.symbol, address);
    }
    setNavs(next);
    setShares(sh);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const buy = async (symbol: string) => {
    if (!address) return toast({ variant: 'info', title: 'Connect wallet' });
    if (!marketplaceReady()) {
      return toast({
        variant: 'info',
        title: 'Index preview',
        description: 'NAV shown from CU oracle fixture until marketplace deploy.',
      });
    }
    setBusy(true);
    try {
      const xdr = await buildBuyIndex(address, symbol, Number(usdc));
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: `Bought ${symbol}` });
      await refresh();
    } catch (e) {
      toast({ variant: 'error', title: 'Buy failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async (symbol: string) => {
    if (!address || !marketplaceReady()) return;
    const amt = shares[symbol] ?? 0;
    if (amt <= 0) return toast({ variant: 'info', title: 'No shares' });
    setBusy(true);
    try {
      const xdr = await buildRedeemIndex(address, symbol, amt);
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'Redeemed at NAV' });
      await refresh();
    } catch (e) {
      toast({ variant: 'error', title: 'Redeem failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo />
            </Link>
            <Badge tone="accent">Index</Badge>
          </div>
          <nav className="hidden gap-4 font-mono text-[11px] uppercase tracking-wider text-subtle sm:flex">
            <Link href="/trade/market" className="hover:text-white">
              Spot
            </Link>
            <Link href="/trade/index" className="text-white">
              Index
            </Link>
            <Link href="/trade" className="hover:text-white">
              Futures hedge
            </Link>
          </nav>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="font-display text-3xl">CU index vaults</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Synthetic NAV vaults — deposit USDC, receive shares priced off ACPI. Cash-settled
          redeem. Hedge spot CU holdings on the live futures terminal.
        </p>

        <div className="mt-6 border border-line bg-ink-800/50 p-5">
          <div className="label text-subtle">ACPI (CU oracle)</div>
          <div className="mt-1 font-mono text-3xl tabular">${acpi.toFixed(4)}</div>
          {!marketplaceReady() && (
            <p className="mt-2 text-xs text-ember">Preview — marketplace id not set</p>
          )}
        </div>

        <div className="mt-6 max-w-xs">
          <Input
            label="USDC to invest"
            value={usdc}
            onChange={(e) => setUsdc(e.target.value)}
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {INDICES.map((i) => (
            <article key={i.symbol} className="border border-line p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">{i.label}</h2>
                <Badge>NAV vault</Badge>
              </div>
              <p className="mt-2 text-sm text-white/50">{i.blurb}</p>
              <dl className="mt-6 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <dt className="text-subtle">NAV</dt>
                  <dd className="tabular">${(navs[i.symbol] ?? acpi).toFixed(4)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-subtle">Your shares</dt>
                  <dd className="tabular">{(shares[i.symbol] ?? 0).toFixed(4)}</dd>
                </div>
              </dl>
              <div className="mt-6 flex gap-2">
                <Button size="sm" loading={busy} onClick={() => void buy(i.symbol)}>
                  Buy shares
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => void redeem(i.symbol)}
                >
                  Redeem
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

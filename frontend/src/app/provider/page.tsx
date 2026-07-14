'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '../../components/Logo';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConnectWalletButton } from '../../components/wallet/ConnectWalletButton';
import { useWalletStore } from '../../stores/walletStore';
import { getProvider, marketplaceReady, type ProviderView } from '../../lib/marketplace';
import { clearStoredRole } from '../../lib/role';
import { useRouter } from 'next/navigation';

export default function ProviderDashboardPage() {
  const router = useRouter();
  const address = useWalletStore((s) => s.address);
  const [provider, setProvider] = useState<ProviderView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !marketplaceReady()) return;
    setLoading(true);
    getProvider(address)
      .then(setProvider)
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <main className="min-h-screen bg-ink-900 text-white">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo />
            </Link>
            <Badge tone="accent">Provider</Badge>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-wider text-subtle hover:text-white"
              onClick={() => {
                clearStoredRole();
                router.push('/app');
              }}
            >
              Switch role
            </button>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-3xl tracking-tight">Provider dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Register capacity, post USDC collateral, and mint CU series. Due diligence and
          proof-of-capacity are mocked on testnet — labeled clearly below.
        </p>

        {!marketplaceReady() && (
          <div className="mt-6 border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember">
            Marketplace contract not configured (`NEXT_PUBLIC_MARKETPLACE_ID`). UI is in{' '}
            <strong>preview</strong> mode until M6 deploy completes.
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Status" value={loading ? '…' : provider?.status ?? 'Not registered'} />
          <Stat
            label="Collateral"
            value={provider ? `${provider.collateral.toFixed(2)} USDC` : '—'}
          />
          <Stat
            label="Capacity / minted"
            value={
              provider
                ? `${provider.mintedCu.toFixed(1)} / ${provider.capacityCu.toFixed(1)} CU`
                : '—'
            }
          />
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/provider/register">
            <Button>Register / DD form</Button>
          </Link>
          <Link href="/provider/series">
            <Button variant="secondary">Manage series</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-ink-800/50 p-5">
      <div className="label text-subtle">{label}</div>
      <div className="mt-2 font-mono text-lg tabular">{value}</div>
    </div>
  );
}

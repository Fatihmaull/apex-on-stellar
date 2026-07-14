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
  buildPostCollateral,
  buildRegisterProvider,
  marketplaceReady,
} from '../../../lib/marketplace';
import { useToast } from '../../../components/ui/Toast';
import { submitSigned } from '../../../lib/stellar';

export default function ProviderRegisterPage() {
  const address = useWalletStore((s) => s.address);
  const signXdr = useWalletStore((s) => s.signXdr);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('SG-JH');
  const [gpuModel, setGpuModel] = useState('H100');
  const [qty, setQty] = useState('8');
  const [hours, setHours] = useState('720');
  const [collateral, setCollateral] = useState('1000');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!address) {
      toast({ variant: 'info', title: 'Connect wallet first' });
      return;
    }
    if (!marketplaceReady()) {
      toast({
        variant: 'info',
        title: 'Preview only',
        description: 'Marketplace not deployed — DD saved locally as mock.',
      });
      localStorage.setItem(
        'apex.provider.dd',
        JSON.stringify({ name, region, gpuModel, qty, hours, collateral, ts: Date.now() }),
      );
      return;
    }
    setBusy(true);
    const id = toast({ variant: 'pending', title: 'Registering provider…' });
    try {
      const reg = await buildRegisterProvider(address);
      await submitSigned(await signXdr(reg));
      const post = await buildPostCollateral(address, Number(collateral));
      await submitSigned(await signXdr(post));
      toast({ variant: 'success', title: 'Registered + collateral posted' });
    } catch (e) {
      toast({ variant: 'error', title: 'Registration failed', description: String(e) });
    } finally {
      setBusy(false);
      void id;
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
            <Badge>Register</Badge>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl">Provider registration</h1>
        <p className="mt-2 text-sm text-white/55">
          Off-chain due diligence (KYB + proof-of-capacity). Only a metadata hash is stored
          on-chain. Approval is performed by the verifier role.
        </p>
        <div className="mt-4">
          <Badge tone="accent">DD / KYB — mocked on testnet</Badge>
        </div>

        <div className="mt-8 space-y-4">
          <Input label="Legal / brand name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="GPU model"
              value={gpuModel}
              onChange={(e) => setGpuModel(e.target.value)}
            />
            <Input label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <Input
            label="Collateral (USDC)"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
          />
          <Button loading={busy} onClick={submit} fullWidth>
            Submit registration
          </Button>
          <Link href="/provider" className="block text-center font-mono text-xs text-subtle">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

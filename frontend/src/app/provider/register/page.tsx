'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  getProvider,
  marketplaceReady,
  type ProviderStatus,
} from '../../../lib/marketplace';
import { useToast } from '../../../components/ui/Toast';
import { submitSigned } from '../../../lib/stellar';

/** SHA-256 hex of the DD payload — the on-chain metadata commitment. */
async function sha256Hex(input: string): Promise<string> {
  const src = new TextEncoder().encode(input);
  const data = new Uint8Array(src.length); // ArrayBuffer-backed (satisfies BufferSource)
  data.set(src);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
  const [status, setStatus] = useState<ProviderStatus | 'None' | 'Unknown'>('Unknown');

  const refreshStatus = useCallback(async () => {
    if (!address || !marketplaceReady()) {
      setStatus('Unknown');
      return;
    }
    const p = await getProvider(address).catch(() => null);
    setStatus(p ? p.status : 'None');
  }, [address]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const registered = status === 'Pending' || status === 'Approved' || status === 'Suspended';

  // Step 1: submit DD (commits a real hash of the payload) + register on-chain.
  const register = async () => {
    if (!address) return toast({ variant: 'info', title: 'Connect wallet first' });
    if (!marketplaceReady()) {
      localStorage.setItem(
        'apex.provider.dd',
        JSON.stringify({ name, region, gpuModel, qty, hours, ts: Date.now() }),
      );
      return toast({ variant: 'info', title: 'Preview only', description: 'DD saved locally (mock).' });
    }
    if (registered) return toast({ variant: 'info', title: 'Already registered' });
    setBusy(true);
    try {
      const metadataHash = await sha256Hex(
        JSON.stringify({ name, region, gpuModel, qty, hours, owner: address }),
      );
      const xdr = await buildRegisterProvider(address, metadataHash);
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'Registered', description: 'DD hash committed on-chain.' });
      await refreshStatus();
    } catch (e) {
      toast({ variant: 'error', title: 'Registration failed', description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  // Step 2: post collateral — independent, only after registration exists.
  const postCollateral = async () => {
    if (!address) return toast({ variant: 'info', title: 'Connect wallet first' });
    if (!registered) return toast({ variant: 'info', title: 'Register first' });
    setBusy(true);
    try {
      const xdr = await buildPostCollateral(address, Number(collateral));
      await submitSigned(await signXdr(xdr));
      toast({ variant: 'success', title: 'Collateral posted' });
      await refreshStatus();
    } catch (e) {
      toast({
        variant: 'error',
        title: 'Collateral failed',
        description:
          'Needs USDC + a trustline in your wallet. ' + String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const statusBanner = () => {
    if (!address) return null;
    if (status === 'None')
      return <Badge tone="neutral">Not registered</Badge>;
    if (status === 'Pending')
      return <Badge tone="warn">Pending — awaiting verifier approval (KYB)</Badge>;
    if (status === 'Approved') return <Badge tone="up">Approved — you can list series</Badge>;
    if (status === 'Suspended') return <Badge tone="down">Suspended</Badge>;
    return null;
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
          Off-chain due diligence (KYB + proof-of-capacity). A SHA-256 hash of the details
          below is committed on-chain; the documents stay off-chain. Approval is performed by
          the verifier role (operator / CLI), not from this page.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="accent">DD / KYB — mocked on testnet</Badge>
          {statusBanner()}
        </div>

        <div className="mt-8 space-y-4">
          <Input label="Legal / brand name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="GPU model" value={gpuModel} onChange={(e) => setGpuModel(e.target.value)} />
            <Input label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>

          {/* Step 1 */}
          <Button loading={busy} onClick={register} fullWidth disabled={registered}>
            {registered ? 'Registered ✓' : '1 · Register provider (submit DD)'}
          </Button>

          {/* Step 2 — separate tx, guarded */}
          <div className="rounded-lg border border-line bg-ink-800/40 p-4">
            <Input
              label="Collateral (USDC)"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
            />
            <Button
              className="mt-3"
              variant="secondary"
              loading={busy}
              onClick={postCollateral}
              fullWidth
              disabled={!registered}
            >
              2 · Post collateral
            </Button>
            <p className="mt-2 text-xs text-white/40">
              Separate transaction — needs USDC + a testnet trustline in your wallet. Safe to
              retry independently of registration.
            </p>
          </div>

          <Link href="/provider" className="block text-center font-mono text-xs text-subtle">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

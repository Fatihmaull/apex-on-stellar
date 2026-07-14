'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Server, LineChart } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Badge } from '../../components/ui/Badge';
import { getStoredRole, setStoredRole, type AppRole } from '../../lib/role';
import { useRouter } from 'next/navigation';

export default function RoleGatePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = getStoredRole();
    if (existing === 'provider') router.replace('/provider');
    else if (existing === 'trader') router.replace('/trade/market');
    else setReady(true);
  }, [router]);

  const choose = (role: AppRole) => {
    setStoredRole(role);
    router.push(role === 'provider' ? '/provider' : '/trade/market');
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-900 text-subtle">
        Loading…
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, #0a0a0a 0%, #141414 100%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Badge tone="accent">Choose role</Badge>
        </div>

        <div className="mt-16 flex flex-1 flex-col justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl tracking-tight sm:text-5xl"
          >
            How will you use APEX?
          </motion.h1>
          <p className="mt-3 max-w-xl text-sm text-white/60">
            Providers tokenize verified GPU capacity as CU. Traders buy spot CU,
            index shares, or hedge on the live futures exchange.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <RoleCard
              icon={<Server className="h-6 w-6" />}
              title="Provider"
              body="Register, post collateral, mint CU series against verified capacity."
              onClick={() => choose('provider')}
            />
            <RoleCard
              icon={<LineChart className="h-6 w-6" />}
              title="Trader"
              body="Browse the CU marketplace, buy CU-INDEX / CUNVDA, or trade futures."
              onClick={() => choose('trader')}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group border border-line bg-ink-800/60 p-8 text-left transition-colors hover:border-white/25 hover:bg-ink-700/40"
    >
      <div className="flex h-12 w-12 items-center justify-center border border-line text-white/80 group-hover:text-accent">
        {icon}
      </div>
      <h2 className="mt-6 font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
      <span className="mt-6 inline-block font-mono text-[11px] uppercase tracking-wider text-accent">
        Continue →
      </span>
    </motion.button>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, ShieldCheck, Layers, Zap, Globe2, Scale } from 'lucide-react';

const FEATURES = [
  {
    icon: LineChart,
    title: 'vAMM price discovery',
    body: 'A virtual constant-product market (x·y=k) prices every trade instantly — no liquidity providers required to bootstrap the book.',
  },
  {
    icon: ShieldCheck,
    title: 'GRC oracle layer',
    body: 'Multi-sig, deviation-bounded and staleness-checked APAC GPU Index feeds anchor mark prices to real compute rental rates.',
  },
  {
    icon: Scale,
    title: 'Cash-settled in USDC',
    body: 'All PnL settles in native USDC via the Stellar Asset Contract. No synthetic tokens, full audit transparency.',
  },
  {
    icon: Layers,
    title: 'Solvency by construction',
    body: 'Segregated accounting buckets and an insurance fund keep the protocol vault fully backing every open position.',
  },
  {
    icon: Zap,
    title: 'Up to 10× leverage',
    body: 'Hedge hardware depreciation or capacity costs efficiently, with maintenance-margin liquidations protecting the pool.',
  },
  {
    icon: Globe2,
    title: 'Built for APAC',
    body: 'A price-discovery hub for the Singapore–Johor–Batam compute corridor and the broader sovereign-AI region.',
  },
];

export function Features() {
  return (
    <section id="product" className="mx-auto max-w-7xl px-5 py-24">
      <div className="mb-14 max-w-2xl">
        <div className="label mb-3">The protocol</div>
        <h2 className="font-display text-4xl font-bold tracking-tight text-white">
          A risk-management layer for compute
        </h2>
        <p className="mt-4 text-muted">
          APEX doesn&apos;t run servers. It&apos;s the financial infrastructure that lets data-center
          operators and AI labs price, hedge and trade compute risk on-chain.
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="group bg-ink-800 p-7 transition-colors hover:bg-ink-700"
          >
            <f.icon className="h-6 w-6 text-accent" />
            <h3 className="mt-4 font-display text-lg text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

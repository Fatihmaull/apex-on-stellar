'use client';

import React from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  {
    n: '01',
    title: 'Deposit collateral',
    body: 'Fund your margin account with USDC. Collateral is held in a segregated, fully-backed vault.',
  },
  {
    n: '02',
    title: 'Open a position',
    body: 'Go long to cap future capacity costs, or short to hedge hardware depreciation — up to 10× leverage.',
  },
  {
    n: '03',
    title: 'Oracle + funding',
    body: 'The GRC oracle streams the APAC GPU Index; periodic funding keeps the mark aligned to spot.',
  },
  {
    n: '04',
    title: 'Settle in USDC',
    body: 'Close any time. PnL, funding and fees net out and settle instantly in USDC.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-ink-800/40">
      <div className="mx-auto max-w-7xl px-5 py-24">
        <div className="mb-14 max-w-2xl">
          <div className="label mb-3">How it works</div>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white">
            From compute risk to a tradable contract
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="font-mono text-3xl font-bold text-accent/80">{s.n}</div>
              <h3 className="mt-3 font-display text-lg text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

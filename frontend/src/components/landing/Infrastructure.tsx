'use client';

import React from 'react';
import { motion } from 'framer-motion';

const CARDS = [
  {
    title: 'Reference pricing',
    body: 'A trusted APAC GPU Index giving buyers, sellers and capital providers a shared view of compute value.',
  },
  {
    title: 'Market intelligence',
    body: 'Live mark, index premium, funding and open interest — the pulse of regional compute supply and demand.',
  },
  {
    title: 'Capacity hedging',
    body: 'Cash-settled futures that let operators and AI labs underwrite and offload compute-price risk.',
  },
  {
    title: 'On-chain settlement',
    body: 'Every position collateralized and settled in USDC on Stellar — transparent, final, and permissionless.',
  },
];

export function Infrastructure() {
  return (
    <section id="infrastructure" className="border-b border-line">
      <div className="mx-auto max-w-5xl px-5 py-24 md:py-32">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl font-display text-2xl font-medium leading-snug tracking-tight text-fg md:text-4xl"
        >
          Every mature market runs on financial infrastructure. APEX is building it for
          APAC compute — and everyone who trades it.
        </motion.h2>

        <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 2) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="bg-ink-800 p-7"
            >
              <div className="label mb-4">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="font-display text-lg text-fg">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

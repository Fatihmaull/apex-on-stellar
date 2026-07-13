'use client';

import React from 'react';
import { motion } from 'framer-motion';

const CARDS = [
  {
    title: 'Transaction-based pricing',
    body: 'The index and mark move on real, executed vAMM trades — not scraped offers, surveys, or estimates.',
  },
  {
    title: 'On-chain infrastructure',
    body: 'Pricing, risk transfer and settlement live in one auditable Soroban contract, collateralized in USDC.',
  },
  {
    title: 'Solvent by construction',
    body: 'Segregated accounting buckets and an insurance fund keep the protocol vault fully backing every position.',
  },
];

/** Light "paper" section — the ornn black↔white rhythm. */
export function Trust() {
  return (
    <section className="paper-section border-b border-line">
      <div className="mx-auto max-w-5xl px-5 py-24 md:py-32">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-3xl font-medium leading-tight tracking-tight text-paper-ink md:text-5xl"
        >
          Transparent.
          <br />
          On-chain.
          <br />
          Decentralized.
        </motion.h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.title}>
              <h3 className="font-display text-lg text-paper-ink">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-black/60">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

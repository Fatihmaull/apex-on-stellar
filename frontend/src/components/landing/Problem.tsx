'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function Problem() {
  return (
    <section id="problem" className="border-b border-line">
      <div className="mx-auto max-w-5xl px-5 py-24 md:py-32">
        <div className="mb-10 flex items-center justify-between">
          <span className="label">Problem</span>
          <span className="label">2025 onwards</span>
        </div>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl font-display text-2xl font-medium leading-snug tracking-tight text-fg md:text-4xl"
        >
          Compute is the most important commodity of our lifetimes. Yet across
          Asia-Pacific its price is opaque, fragmented, and impossible to hedge — no
          benchmark, no derivatives, no way to manage the risk of a multi-million-dollar
          GPU fleet.
        </motion.h2>

        <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
          {[
            ['Opaque pricing', 'Rental rates across Singapore, Johor and Batam are quoted privately and never standardized.'],
            ['No hedging', 'Operators carry hardware-depreciation risk and labs carry capacity-cost risk with no instrument to offload it.'],
            ['Illiquid capacity', 'Idle GPU hours cannot be turned into a financial position and monetized quickly.'],
          ].map(([t, d]) => (
            <div key={t} className="bg-ink-800 p-6">
              <h3 className="font-display text-base text-fg">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

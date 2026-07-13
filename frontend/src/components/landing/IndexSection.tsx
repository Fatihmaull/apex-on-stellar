'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useIndex } from '../../hooks/useIndex';
import { fmtUsd, fmtPct, fmtCompact } from '../../lib/utils';

const SUPPORTED = ['ACPI-H200', 'ACPI-B200', 'ACPI-GB200', 'ACPI-A100'];

export function IndexSection() {
  const { index, mark, premium, depth, live } = useIndex();

  return (
    <section id="index" className="border-b border-line">
      <div className="mx-auto max-w-5xl px-5 py-24 md:py-32">
        <span className="label">Computing power</span>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-2xl font-display text-2xl font-medium leading-snug tracking-tight text-fg md:text-4xl"
        >
          The ACPI. The reference price for APAC compute.
        </motion.h2>

        {/* Live index board */}
        <div className="mt-12 overflow-hidden rounded-card border border-line">
          <div className="flex items-center justify-between border-b border-line bg-ink-800 px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="label">Index</span>
              <span className="font-mono text-xs text-fg">ACPI-H100</span>
              <span className="rounded-sm bg-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
                SIN
              </span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-blink bg-up' : 'bg-fg-ghost'}`} />
              {live ? 'Live on-chain' : 'Connecting'}
            </span>
          </div>

          <div className="grid grid-cols-1 divide-y divide-line bg-ink-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { k: 'Index (oracle)', v: `$${fmtUsd(index, 2)}` },
              { k: 'Mark (vAMM)', v: `$${fmtUsd(mark, 2)}` },
              {
                k: 'Premium',
                v: fmtPct(premium),
                cls: premium >= 0 ? 'text-up' : 'text-down',
              },
            ].map((c) => (
              <div key={c.k} className="px-5 py-6">
                <div className="label mb-2">{c.k}</div>
                <div className={`font-display text-3xl font-medium tabular ${c.cls ?? 'text-fg'}`}>
                  {c.v}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-ink-800 px-5 py-3">
            <span className="label">Also supported</span>
            {SUPPORTED.map((s) => (
              <span key={s} className="font-mono text-[11px] text-fg-dim">
                {s}
              </span>
            ))}
            <span className="ml-auto font-mono text-[11px] text-fg-faint">
              Depth k · {fmtCompact(depth)}
            </span>
          </div>
        </div>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-fg-muted">
          The ACPI tracks spot rental prices for GPU compute across major hardware types
          in the APAC corridor. It is aggregated from Tier-2 data-center operators,
          cryptographically attested, and published on-chain through a multi-sig GRC
          oracle — the foundation for pricing, hedging, and settlement across the region&apos;s
          compute-derivatives market.
        </p>
      </div>
    </section>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-5xl px-5 py-28 text-center md:py-40">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl font-display text-3xl font-medium leading-tight tracking-tightest text-fg md:text-5xl"
        >
          The compute economy is here.
          <br />
          APEX is its APAC market.
        </motion.h2>

        <Link
          href="/trade"
          className="group mt-10 inline-flex items-center gap-2 rounded-pill bg-accent px-6 py-3 font-mono text-xs uppercase tracking-wider text-ink-900 transition-colors hover:bg-accent-soft"
        >
          Launch the exchange
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </section>
  );
}

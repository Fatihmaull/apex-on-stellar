'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { LiveIndex } from './LiveIndex';

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PRODUCTS = [
  {
    name: 'APEX Trade',
    tag: 'Hedge the index',
    desc: 'Cash-settled futures on the APAC GPU Index — live on Stellar testnet.',
    href: '/trade',
  },
  {
    name: 'APEX Marketplace',
    tag: 'Tokenize capacity',
    desc: 'Providers mint CU; traders buy spot series and CU-INDEX shares.',
    href: '/app',
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="grid-bg absolute inset-0" />
      <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-20 md:pt-28">
        <motion.h1
          variants={fade}
          custom={0}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center font-display text-4xl font-medium leading-[1.06] tracking-tightest text-fg md:text-6xl"
        >
          The foundation of the APAC compute market
        </motion.h1>

        <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="mt-14">
          <LiveIndex />
        </motion.div>

        {/* Two product cards, ornn-style */}
        <motion.div
          variants={fade}
          custom={2}
          initial="hidden"
          animate="show"
          className="mt-16 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2"
        >
          {PRODUCTS.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              className="group bg-ink-800 p-6 transition-colors hover:bg-ink-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg text-fg">{p.name}</div>
                  <div className="label mt-1">{p.tag}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-fg-muted">{p.desc}</p>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

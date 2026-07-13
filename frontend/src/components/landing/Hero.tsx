'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-20 md:pt-28">
        <motion.div variants={fade} custom={0} initial="hidden" animate="show">
          <span className="label inline-flex items-center gap-2 rounded-pill border border-line bg-ink-800 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-ember-pulse rounded-full bg-accent" />
            Live on Stellar Testnet · APAC GPU Index
          </span>
        </motion.div>

        <motion.h1
          variants={fade}
          custom={1}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl"
        >
          The foundation of the{' '}
          <span className="text-accent">compute market</span>.
        </motion.h1>

        <motion.p
          variants={fade}
          custom={2}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-2xl text-lg leading-relaxed text-muted"
        >
          APEX turns GPU compute into a standardized, tradable commodity. Hedge hardware
          depreciation, lock in future capacity costs, or trade the APAC GPU Index — cash-settled
          in USDC through a fully on-chain vAMM.
        </motion.p>

        <motion.div
          variants={fade}
          custom={3}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <Link href="/trade">
            <Button size="lg">
              Launch Exchange <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="secondary">
              How it works
            </Button>
          </a>
          <span className="ml-1 hidden items-center gap-1.5 text-xs text-subtle sm:flex">
            <ShieldCheck className="h-4 w-4 text-up" /> Enterprise-hardened contracts
          </span>
        </motion.div>

        {/* Index price display block, ornn-style */}
        <motion.div
          variants={fade}
          custom={4}
          initial="hidden"
          animate="show"
          className="mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4"
        >
          {[
            ['APAC GPU Index', '$3.90'],
            ['24h Volume', '$1.2M'],
            ['Open Interest', '$840K'],
            ['Max Leverage', '10×'],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink-800 px-4 py-5">
              <div className="label mb-2">{k}</div>
              <div className="font-mono text-2xl font-semibold text-white tabular">{v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

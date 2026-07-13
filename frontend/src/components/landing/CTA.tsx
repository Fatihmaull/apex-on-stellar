'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/Button';

export function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-card border border-accent/20 bg-gradient-to-br from-ink-700 to-ink-800 px-8 py-16 text-center"
      >
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
            Trade the price of intelligence.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Join the alpha testnet and stress-test the vAMM. No sign-up — just connect a Stellar
            wallet and start.
          </p>
          <Link href="/trade" className="mt-8 inline-block">
            <Button size="lg">
              Launch Exchange <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

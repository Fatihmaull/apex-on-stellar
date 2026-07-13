'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '../Logo';
import { Button } from '../ui/Button';

const LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Market', href: '#market' },
  { label: 'How it works', href: '#how' },
];

export function Nav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 border-b border-line bg-ink-900/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <Link href="/trade">
          <Button size="sm">
            Launch App <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.header>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function AnimatedCard({
  className,
  children,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('surface p-5', className)}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="label mb-1">{eyebrow}</div>}
        <h3 className="font-display text-lg text-white">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/** Small label/value stat used in metric grids. */
export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: 'up' | 'down' | 'accent' | 'default';
}) {
  const color =
    accent === 'up'
      ? 'text-up'
      : accent === 'down'
        ? 'text-down'
        : accent === 'accent'
          ? 'text-accent'
          : 'text-white';
  return (
    <div className="rounded-lg bg-ink-800/60 border border-line px-3 py-3">
      <div className="label mb-1.5">{label}</div>
      <div className={cn('font-mono text-base font-semibold tabular', color)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted tabular">{sub}</div>}
    </div>
  );
}

'use client';

import React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'up' | 'down' | 'warn' | 'neutral' | 'accent';

const TONES: Record<Tone, string> = {
  up: 'bg-up/10 text-up border-up/30',
  down: 'bg-down/10 text-down border-down/30',
  warn: 'bg-ember/10 text-ember border-ember/30',
  neutral: 'bg-white/5 text-muted border-line',
  accent: 'bg-accent/10 text-accent border-accent/30',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5',
        'font-mono text-[10px] uppercase tracking-wider',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

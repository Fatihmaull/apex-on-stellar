import React from 'react';
import { cn } from '../lib/utils';

/** APEX wordmark with a forged-ember glyph. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-md bg-accent/20 blur-[6px]" />
        <svg viewBox="0 0 24 24" className="relative h-7 w-7">
          <path d="M12 2 L21 20 H15 L12 13 L9 20 H3 Z" fill="#FF6A2B" />
          <path d="M12 2 L12 13 L9 20 H3 Z" fill="#B8461B" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white">
        APEX
      </span>
    </div>
  );
}

import React from 'react';
import { cn } from '../lib/utils';

/** APEX wordmark — monochrome apex/peak glyph. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M12 2 L21 20 H15 L12 13 L9 20 H3 Z" fill="#F3F3F3" />
        <path d="M12 2 L12 13 L9 20 H3 Z" fill="#949BA5" />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-tight text-fg">APEX</span>
    </div>
  );
}

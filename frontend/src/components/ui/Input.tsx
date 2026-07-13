'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, suffix, error, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label mb-1.5 block">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center rounded-lg border bg-ink-800 transition-colors',
            error ? 'border-down/60' : 'border-line focus-within:border-accent/60',
          )}
        >
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-transparent px-3 py-2.5 font-mono text-sm text-white tabular',
              'placeholder:text-subtle focus:outline-none disabled:opacity-50',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="px-3 font-mono text-xs uppercase tracking-wider text-muted">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-down">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Info, ExternalLink } from 'lucide-react';
import { explorerTx } from '../../config/env';

export type ToastVariant = 'success' | 'error' | 'pending' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  txHash?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => string;
  update: (id: string, patch: Partial<Omit<Toast, 'id'>>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-up" />,
  error: <XCircle className="h-5 w-5 text-down" />,
  pending: <Loader2 className="h-5 w-5 animate-spin text-accent" />,
  info: <Info className="h-5 w-5 text-muted" />,
};

const ACCENT: Record<ToastVariant, string> = {
  success: 'border-l-up',
  error: 'border-l-down',
  pending: 'border-l-accent',
  info: 'border-l-white/20',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      const item: Toast = { id, duration: 6000, ...t };
      setToasts((prev) => [...prev, item]);
      // pending toasts persist until explicitly updated/dismissed
      if (item.variant !== 'pending' && item.duration) {
        setTimeout(() => dismiss(id), item.duration);
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<Toast, 'id'>>) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (patch.variant && patch.variant !== 'pending') {
        setTimeout(() => dismiss(id), patch.duration ?? 6000);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, update, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`surface pointer-events-auto flex gap-3 border-l-2 p-3.5 ${ACCENT[t.variant]}`}
            >
              <div className="mt-0.5 shrink-0">{ICONS[t.variant]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 break-words text-xs text-muted">{t.description}</p>
                )}
                {t.txHash && (
                  <a
                    href={explorerTx(t.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-subtle transition-colors hover:text-white"
                aria-label="Dismiss"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { getMarketSnapshot, type MarketSnapshot } from '../lib/contract';

const POLL_MS = 20_000;

export interface IndexData {
  /** APAC GPU Index (the GRC oracle spot price), USDC per compute unit. */
  index: number;
  /** vAMM mark price. */
  mark: number;
  /** Premium/discount of mark vs. index, in %. */
  premium: number;
  /** Virtual liquidity depth k = base * quote. */
  depth: number;
  /** When we last successfully read the chain. */
  updatedAt: Date | null;
  loading: boolean;
  /** True once at least one live read has succeeded. */
  live: boolean;
}

/**
 * Realtime index feed for the landing page. Reads the live on-chain APAC GPU
 * Index (oracle) and vAMM mark from the deployed contract every ~20s — no wallet
 * required (read-only simulation). Falls back to the launch reference price if
 * the RPC is unreachable so the page always renders.
 */
export function useIndex(): IndexData {
  const [snap, setSnap] = useState<MarketSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const tick = async () => {
      try {
        const s = await getMarketSnapshot();
        if (!mounted.current) return;
        setSnap(s);
        setUpdatedAt(new Date());
      } catch {
        /* keep last value / fallback until the next poll */
      } finally {
        if (mounted.current) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, []);

  const index = snap?.oraclePrice ?? 5.0;
  const mark = snap?.markPrice ?? 5.0;
  const premium = index > 0 ? ((mark - index) / index) * 100 : 0;
  const depth = snap ? snap.reserves.base * snap.reserves.quote : 0;

  return { index, mark, premium, depth, updatedAt, loading, live: !!snap };
}

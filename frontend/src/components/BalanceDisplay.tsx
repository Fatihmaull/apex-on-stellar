'use client';

import React from 'react';
import { useSoroban } from '../hooks/useSoroban';

export const BalanceDisplay: React.FC = () => {
  const { publicKey, balances, loading } = useSoroban();

  if (!publicKey) {
    return (
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Connect wallet to view balances</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="card-title">
        <span>Collateral & Balances</span>
        {loading && (
          <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>Refreshing...</span>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>NATIVE ASSET</p>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', fontFamily: 'var(--font-family-title)' }}>Stellar XLM</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>BALANCE</p>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', color: 'var(--text-primary)' }}>
              {balances ? balances.xlm : '0.0000'}
            </h3>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SETTLEMENT ASSET</p>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', fontFamily: 'var(--font-family-title)' }}>Stellar USDC</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>BALANCE</p>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px', color: 'var(--accent-cyan)' }}>
              {balances ? balances.usdc : '0.0000'}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BalanceDisplay;

'use client';

import React from 'react';
import { useSoroban } from '../hooks/useSoroban';

export const TransactionResult: React.FC = () => {
  const { txResult, error, clearTxResult } = useSoroban();

  if (!txResult && !error) return null;

  const isSuccess = txResult?.success ?? false;
  const message = txResult?.message ?? error ?? 'An unknown error occurred';
  const txHash = txResult?.hash;

  return (
    <div 
      className={`glass-card glowing`} 
      style={{ 
        borderColor: isSuccess ? 'var(--success)' : 'var(--error)', 
        animation: 'none', 
        borderWidth: '2px', 
        marginBottom: '24px' 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        {/* Success/Error Icon */}
        <div style={{ 
          background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isSuccess ? 'var(--success)' : 'var(--error)',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isSuccess ? (
            <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h4 style={{ 
            fontSize: '16px', 
            fontWeight: '700', 
            color: isSuccess ? 'var(--success)' : 'var(--error)',
            marginBottom: '4px' 
          }}>
            {isSuccess ? 'Transaction Success' : 'Transaction Failed'}
          </h4>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {message}
          </p>

          {isSuccess && txHash && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Transaction Hash:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {txHash}
              </span>
              <a 
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="tx-link"
                style={{ marginTop: '4px' }}
              >
                View on StellarExpert
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button 
          onClick={clearTxResult}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
export default TransactionResult;

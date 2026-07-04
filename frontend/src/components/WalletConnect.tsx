'use client';

import React from 'react';
import { useSoroban } from '../hooks/useSoroban';

export const WalletConnect: React.FC = () => {
  const { publicKey, isConnecting, connectWallet, disconnectWallet } = useSoroban();

  const getShortAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (publicKey) {
    return (
      <div className="wallet-details">
        <span className="address-pill">{getShortAddress(publicKey)}</span>
        <button 
          onClick={disconnectWallet} 
          className="btn btn-secondary" 
          style={{ width: 'auto', padding: '8px 16px', borderRadius: '20px', fontSize: '13px' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn btn-primary"
      style={{ width: 'auto', padding: '10px 24px', borderRadius: '20px', fontSize: '14px', animation: 'neon-pulse 2s infinite' }}
    >
      {isConnecting ? (
        <>
          <svg className="animate-spin" style={{ width: '16px', height: '16px', marginRight: '8px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Connecting...
        </>
      ) : (
        'Connect Freighter'
      )}
    </button>
  );
};
export default WalletConnect;

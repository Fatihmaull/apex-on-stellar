'use client';

import React, { useState } from 'react';
import { useSoroban } from '../hooks/useSoroban';

export const TradeForm: React.FC = () => {
  const { 
    publicKey, 
    loading, 
    markPrice, 
    userPosition,
    balances,
    depositMargin, 
    withdrawMargin, 
    openPosition, 
    closePosition 
  } = useSoroban();

  const [activeTab, setActiveTab] = useState<'trade' | 'collateral'>('trade');
  const [isLong, setIsLong] = useState(true);
  const [marginAction, setMarginAction] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Input fields
  const [collateralAmount, setCollateralAmount] = useState('');
  const [tradeSize, setTradeSize] = useState('');
  const [leverage, setLeverage] = useState(5);

  const handleCollateralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collateralAmount || isNaN(Number(collateralAmount))) return;
    
    const amount = Number(collateralAmount);
    if (marginAction === 'deposit') {
      await depositMargin(amount);
    } else {
      await withdrawMargin(amount);
    }
    setCollateralAmount('');
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSize || isNaN(Number(tradeSize))) return;
    
    const size = Number(tradeSize);
    await openPosition(size, isLong);
    setTradeSize('');
  };

  // Calculations
  const calculatedPositionValue = Number(tradeSize || 0) * markPrice;
  const estimatedRequiredMargin = calculatedPositionValue / leverage;

  if (!publicKey) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px' }}>
        <svg style={{ width: '48px', height: '48px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Please connect your Freighter wallet to start trading APEX Compute Futures.</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="tabs-container">
        <button 
          onClick={() => setActiveTab('trade')} 
          className={`tab-btn ${activeTab === 'trade' ? 'active long' : ''}`}
        >
          Futures Order
        </button>
        <button 
          onClick={() => setActiveTab('collateral')} 
          className={`tab-btn ${activeTab === 'collateral' ? 'active long' : ''}`}
        >
          Collateral Management
        </button>
      </div>

      {activeTab === 'trade' && (
        <div>
          {/* Long/Short Toggle */}
          <div className="tabs-container" style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
            <button 
              onClick={() => setIsLong(true)}
              className={`tab-btn ${isLong ? 'active long' : ''}`}
            >
              LONG
            </button>
            <button 
              onClick={() => setIsLong(false)}
              className={`tab-btn ${!isLong ? 'active short' : ''}`}
            >
              SHORT
            </button>
          </div>

          <form onSubmit={handleTradeSubmit}>
            <div className="input-group">
              <label className="input-label">Compute Order Size</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  value={tradeSize}
                  onChange={(e) => setTradeSize(e.target.value)}
                  placeholder="0.00" 
                  disabled={loading}
                  className="input-field" 
                  required
                />
                <span className="input-suffix">V-GPU Hrs</span>
              </div>
            </div>

            {/* Leverage Slider */}
            <div className="slider-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Leverage Multiplier</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>{leverage}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                disabled={loading}
                className="range-slider"
              />
              <div className="slider-labels">
                <span>1x</span>
                <span>2.5x</span>
                <span>5x</span>
                <span>7.5x</span>
                <span>10x</span>
              </div>
            </div>

            {/* Estimated Metrics */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '13px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Virtual Mark Price:</span>
                <span style={{ fontWeight: '600' }}>${markPrice.toFixed(4)} USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Position Notional Value:</span>
                <span style={{ fontWeight: '600' }}>${calculatedPositionValue.toFixed(4)} USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimated Required Margin:</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>${estimatedRequiredMargin.toFixed(4)} USDC</span>
              </div>
            </div>

            {userPosition && userPosition.size !== 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ color: 'var(--warning)', fontSize: '12px', textAlign: 'center', background: 'rgba(245,158,11,0.05)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  ⚠️ You already have an active position. Close it before opening a new one.
                </div>
                <button 
                  type="button"
                  onClick={closePosition}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                >
                  {loading ? 'Closing Position...' : `Close Active Position (${userPosition.size > 0 ? 'Long' : 'Short'})`}
                </button>
              </div>
            ) : (
              <button 
                type="submit" 
                disabled={loading || !tradeSize} 
                className="btn btn-primary"
              >
                {loading ? 'Submitting Order...' : `Open Leveraged ${isLong ? 'Long' : 'Short'}`}
              </button>
            )}
          </form>
        </div>
      )}

      {activeTab === 'collateral' && (
        <div>
          <div className="tabs-container" style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
            <button 
              onClick={() => setMarginAction('deposit')}
              className={`tab-btn ${marginAction === 'deposit' ? 'active long' : ''}`}
            >
              DEPOSIT COLLATERAL
            </button>
            <button 
              onClick={() => setMarginAction('withdraw')}
              className={`tab-btn ${marginAction === 'withdraw' ? 'active short' : ''}`}
            >
              WITHDRAW COLLATERAL
            </button>
          </div>

          <form onSubmit={handleCollateralSubmit}>
            <div className="input-group">
              <label className="input-label">Collateral Amount</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  step="0.0001"
                  min="0.0001"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.0000" 
                  disabled={loading}
                  className="input-field" 
                  required
                />
                <span className="input-suffix">USDC</span>
              </div>
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Wallet USDC Balance:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{balances ? balances.usdc : '0.0000'} USDC</span>
            </div>

            <button 
              type="submit" 
              disabled={loading || !collateralAmount} 
              className="btn btn-primary"
            >
              {loading ? 'Processing Transaction...' : `${marginAction === 'deposit' ? 'Deposit' : 'Withdraw'} Collateral`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default TradeForm;

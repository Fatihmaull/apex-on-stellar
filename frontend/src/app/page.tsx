'use client';

import React, { useState } from 'react';
import { useSoroban } from '../hooks/useSoroban';
import WalletConnect from '../components/WalletConnect';
import BalanceDisplay from '../components/BalanceDisplay';
import TradeForm from '../components/TradeForm';
import TransactionResult from '../components/TransactionResult';

export default function Home() {
  const { 
    publicKey, 
    markPrice, 
    oraclePrice, 
    healthFactor, 
    userPosition, 
    reserves,
    loading,
    updateOraclePrice,
    closePosition 
  } = useSoroban();

  const [simOraclePrice, setSimOraclePrice] = useState('');

  // Calculations
  const premiumDiscount = oraclePrice > 0 
    ? ((markPrice - oraclePrice) / oraclePrice) * 100 
    : 0;

  const positionValue = userPosition && userPosition.size !== 0
    ? userPosition.size.abs() * markPrice
    : 0;

  const entryValue = userPosition && userPosition.size !== 0
    ? userPosition.size.abs() * userPosition.entryPrice
    : 0;

  const pnl = userPosition && userPosition.size !== 0
    ? (userPosition.size > 0 ? (positionValue - entryValue) : (entryValue - positionValue))
    : 0;

  const pnlPercent = userPosition && userPosition.size !== 0 && userPosition.marginAllocated > 0
    ? (pnl / userPosition.marginAllocated) * 100
    : 0;

  const handleOracleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simOraclePrice || isNaN(Number(simOraclePrice))) return;
    await updateOraclePrice(Number(simOraclePrice));
    setSimOraclePrice('');
  };

  const getHealthBadge = (hf: number) => {
    if (hf >= 2) return <span className="badge badge-success">Excellent ({(hf).toFixed(2)})</span>;
    if (hf >= 1.2) return <span className="badge badge-success">Healthy ({(hf).toFixed(2)})</span>;
    if (hf >= 1.0) return <span className="badge badge-warning">Caution ({(hf).toFixed(2)})</span>;
    return <span className="badge badge-error">Liquidatable ({(hf).toFixed(2)})</span>;
  };

  return (
    <div className="app-container">
      {/* Platform Header */}
      <header className="header">
        <div className="brand">
          <h1 className="brand-logo">APEX</h1>
          <span className="brand-badge">Compute Futures</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stellar Testnet</span>
        </div>
        <WalletConnect />
      </header>

      {/* Market Stats Bar */}
      <section className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">vAMM Mark Price</div>
          <div className="metric-value glowing">
            ${markPrice > 0 ? markPrice.toFixed(4) : '5.0000'} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>USDC</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">GRC Spot GPU Index</div>
          <div className="metric-value">
            ${oraclePrice > 0 ? oraclePrice.toFixed(4) : '5.0000'} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>USDC</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Premium / Discount</div>
          <div className="metric-value" style={{ color: premiumDiscount >= 0 ? 'var(--success)' : 'var(--error)' }}>
            {premiumDiscount >= 0 ? '+' : ''}{premiumDiscount.toFixed(2)}%
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">vAMM Reserve Depth (k)</div>
          <div className="metric-value" style={{ fontSize: '16px', marginTop: '4px' }}>
            {reserves ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>V-GPU: {reserves.base.toLocaleString()} Hrs</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>V-USDC: {reserves.quote.toLocaleString()} USDC</div>
              </>
            ) : (
              '1,000,000 x 5,000,000'
            )}
          </div>
        </div>
      </section>

      {/* Transaction Status Updates */}
      <TransactionResult />

      {/* Dashboard Main Grid */}
      <div className="dashboard-grid">
        {/* Left Hand Details Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active Position Details */}
          <div className="glass-card">
            <h2 className="card-title">
              <span>Your Active Leveraged Position</span>
              {userPosition && userPosition.size !== 0 && (
                <span className={`badge ${userPosition.size > 0 ? 'badge-success' : 'badge-error'}`}>
                  {userPosition.size > 0 ? 'LONG' : 'SHORT'}
                </span>
              )}
            </h2>

            {userPosition && userPosition.size !== 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>POSITION SIZE</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px' }}>
                      {userPosition.size.abs().toFixed(2)} V-GPU Hrs
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ENTRY PRICE</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px' }}>
                      ${userPosition.entryPrice.toFixed(4)} USDC
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>COLLATERAL LOCKED</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px', color: 'var(--accent-cyan)' }}>
                      ${userPosition.marginAllocated.toFixed(4)} USDC
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NOTIONAL VALUE</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px' }}>
                      ${positionValue.toFixed(4)} USDC
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>UNREALIZED PNL</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px', color: pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} ({pnlPercent.toFixed(2)}%)
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>HEALTH FACTOR</div>
                    <div style={{ marginTop: '6px' }}>
                      {getHealthBadge(healthFactor)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button 
                    onClick={closePosition}
                    disabled={loading}
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 24px', borderColor: 'var(--error)', color: 'var(--error)' }}
                  >
                    {loading ? 'Closing Position...' : 'Market Close Position'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No active compute positions found for this account.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Deposit collateral and place an order using the Trade panel.</p>
              </div>
            )}
          </div>

          {/* GRC Oracle Simulation Tool */}
          <div className="glass-card">
            <h2 className="card-title">
              <span>Stellar GRC Oracle Simulator (Admin)</span>
              <span className="badge badge-warning">Testing Tool</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              For hackathon evaluation, use this form to update the GRC GPU Spot Index price in the smart contract. This updates the Mark/Spot premium and test position health factors (simulating profit, loss, and liquidations).
            </p>

            <form onSubmit={handleOracleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="input-label">New Index Price</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.1"
                    value={simOraclePrice}
                    onChange={(e) => setSimOraclePrice(e.target.value)}
                    placeholder="e.g. 5.50" 
                    disabled={loading}
                    className="input-field"
                    required
                  />
                  <span className="input-suffix">USDC</span>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading || !simOraclePrice} 
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap' }}
              >
                {loading ? 'Publishing...' : 'Update Oracle Price'}
              </button>
            </form>
          </div>

        </div>

        {/* Right Hand Forms Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <BalanceDisplay />
          <TradeForm />
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';

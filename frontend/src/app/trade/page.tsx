'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TradeNav } from '../../components/trade/TradeNav';
import { StatsBar } from '../../components/trade/StatsBar';
import { TradePanel } from '../../components/trade/TradePanel';
import { PositionPanel } from '../../components/trade/PositionPanel';
import { MarginPanel } from '../../components/trade/MarginPanel';
import { OracleSimulator } from '../../components/trade/OracleSimulator';
import { useProtocol } from '../../hooks/useProtocol';

const stagger = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function TradePage() {
  const protocol = useProtocol();
  const { market } = protocol;

  return (
    <main className="min-h-screen">
      <TradeNav />

      <div className="mx-auto max-w-7xl px-5 py-6">
        <motion.div variants={stagger} custom={0} initial="hidden" animate="show">
          <StatsBar market={market} />
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: portfolio + oracle */}
          <div className="flex flex-col gap-6">
            <motion.div variants={stagger} custom={1} initial="hidden" animate="show">
              <PositionPanel protocol={protocol} market={market} />
            </motion.div>
            <motion.div variants={stagger} custom={2} initial="hidden" animate="show">
              <OracleSimulator protocol={protocol} />
            </motion.div>
          </div>

          {/* Right: trade + margin */}
          <div className="flex flex-col gap-6">
            <motion.div variants={stagger} custom={1} initial="hidden" animate="show">
              <TradePanel protocol={protocol} market={market} />
            </motion.div>
            <motion.div variants={stagger} custom={2} initial="hidden" animate="show">
              <MarginPanel protocol={protocol} />
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}

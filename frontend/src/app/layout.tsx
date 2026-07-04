import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { SorobanProvider } from '../hooks/useSoroban';

export const metadata: Metadata = {
  title: 'APEX | APAC Compute Exchange',
  description: 'Decentralized cash-settled compute futures exchange using a Virtual Automated Market Maker (vAMM) model on Stellar.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SorobanProvider>
          {children}
        </SorobanProvider>
      </body>
    </html>
  );
}
export const dynamic = 'force-dynamic';

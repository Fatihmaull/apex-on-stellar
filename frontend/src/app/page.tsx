import React from 'react';
import { Nav } from '../components/landing/Nav';
import { Ticker } from '../components/landing/Ticker';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { CTA } from '../components/landing/CTA';
import { Footer } from '../components/landing/Footer';

export default function LandingPage() {
  return (
    <main>
      <Nav />
      <Ticker />
      <Hero />
      <div id="market" />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </main>
  );
}

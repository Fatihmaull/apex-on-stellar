import React from 'react';
import { AnnouncementBar } from '../components/landing/AnnouncementBar';
import { Nav } from '../components/landing/Nav';
import { Hero } from '../components/landing/Hero';
import { Problem } from '../components/landing/Problem';
import { IndexSection } from '../components/landing/IndexSection';
import { Infrastructure } from '../components/landing/Infrastructure';
import { Trust } from '../components/landing/Trust';
import { CTA } from '../components/landing/CTA';
import { Footer } from '../components/landing/Footer';

export default function LandingPage() {
  return (
    <main>
      <AnnouncementBar />
      <Nav />
      <Hero />
      <Problem />
      <IndexSection />
      <Infrastructure />
      <Trust />
      <CTA />
      <Footer />
    </main>
  );
}

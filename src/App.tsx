/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Acolhimento } from './components/Acolhimento';
import { PorQueInvestigar } from './components/PorQueInvestigar';
import { Modalidades } from './components/Modalidades';
import { OQueEstaIncluido } from './components/OQueEstaIncluido';
import { ComoFunciona } from './components/ComoFunciona';
import { PreparacaoEOutrasCidades } from './components/Preparacao';
import { DraKaryne } from './components/DraKaryne';
import { Avaliacoes } from './components/Avaliacoes';
import { Localizacao } from './components/Localizacao';
import { FAQ } from './components/FAQ';
import { CTAFinal } from './components/CTAFinal';
import { Footer } from './components/Footer';

declare global {
  interface Window {
    openQualificationModal?: () => void;
  }
}

export default function App() {
  useEffect(() => {
    // Placeholder function definition as requested
    window.openQualificationModal = () => {
      console.log('Open qualification modal triggered');
      // No implementation for this stage.
    };
    
    // Config do WhatsApp constant as requested
    const WHATSAPP_NUMBER = '5562981340675';
  }, []);

  return (
    <div className="font-sans text-primary-brown !scroll-smooth">
      <Header />
      <main>
        <Hero />
        <Acolhimento />
        <PorQueInvestigar />
        <Modalidades />
        <OQueEstaIncluido />
        <ComoFunciona />
        <PreparacaoEOutrasCidades />
        <DraKaryne />
        <Avaliacoes />
        <Localizacao />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
    </div>
  );
}

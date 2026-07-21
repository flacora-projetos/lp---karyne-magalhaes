/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Acolhimento } from './components/Acolhimento';
import { PorQueInvestigar } from './components/PorQueInvestigar';
import { Modalidades } from './components/Modalidades';
import { OQueEstaIncluido } from './components/OQueEstaIncluido';
import { ComoFunciona } from './components/ComoFunciona';
import { PreparacaoEOutrasCidades } from './components/Preparacao';
import { DraKaryne } from './components/DraKaryne';
import { YouTubeSection } from './components/YouTubeSection';
import { Avaliacoes } from './components/Avaliacoes';
import { Localizacao } from './components/Localizacao';
import { FAQ } from './components/FAQ';
import { CTAFinal } from './components/CTAFinal';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { QualificationModal } from './components/QualificationModal';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { preserveFbclid } from './utils/metaPixel';

// Painel administrativo (mini CRM) — carregado sob demanda, fora do bundle da LP.
const AdminApp = lazy(() => import('./admin/AdminApp'));

declare global {
  interface Window {
    openQualificationModal?: () => void;
  }
}

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    preserveFbclid();
    
    // Configura a função global para abrir o modal
    window.openQualificationModal = () => {
      setIsModalOpen(true);
    };
    
    // Config do WhatsApp constant as requested
    const WHATSAPP_NUMBER = '5562999320675';

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (currentPath === '/politica-de-privacidade') {
    return <PrivacyPolicy />;
  }

  if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F6F0E9] text-[#2B1B0A]/50 font-sans text-sm">
            Carregando…
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }

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
        <YouTubeSection />
        <Avaliacoes />
        <Localizacao />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <QualificationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

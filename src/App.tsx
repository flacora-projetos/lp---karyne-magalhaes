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
import { createGadsDirectHandler } from './utils/gadsDirect';

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
  const normalizedPath = currentPath.replace(/\/+$/, '') || '/';
  const isGads = normalizedPath === '/gads';

  useEffect(() => {
    preserveFbclid();
    const openGadsWhatsApp = createGadsDirectHandler();
    
    window.openQualificationModal = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/gads') {
        openGadsWhatsApp();
        return;
      }
      setIsModalOpen(true);
    };

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      delete window.openQualificationModal;
    };
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
      <Header directToWhatsapp={isGads} />
      <main>
        <Hero directToWhatsapp={isGads} />
        <Acolhimento />
        <PorQueInvestigar />
        <Modalidades directToWhatsapp={isGads} />
        <OQueEstaIncluido />
        <ComoFunciona />
        <PreparacaoEOutrasCidades />
        <DraKaryne />
        <YouTubeSection />
        <Avaliacoes />
        <Localizacao />
        <FAQ />
        <CTAFinal directToWhatsapp={isGads} />
      </main>
      <Footer />
      <FloatingWhatsApp directToWhatsapp={isGads} />
      <QualificationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

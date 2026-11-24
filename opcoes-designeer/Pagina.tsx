/**
 * A página completa do site (mesma ordem do App real), com os blocos trocáveis.
 * Texto aprovado vem dos próprios componentes do site: mudou lá, muda em todas as opções.
 */
import { useEffect, useState } from 'react';
import { Header } from '../src/components/Header';
import { Hero } from '../src/components/Hero';
import { Acolhimento } from '../src/components/Acolhimento';
import { PorQueInvestigar } from '../src/components/PorQueInvestigar';
import { Modalidades } from '../src/components/Modalidades';
import { OQueEstaIncluido } from '../src/components/OQueEstaIncluido';
import { ComoFunciona } from '../src/components/ComoFunciona';
import { PreparacaoEOutrasCidades } from '../src/components/Preparacao';
import { DraKaryne } from '../src/components/DraKaryne';
import { YouTubeSection } from '../src/components/YouTubeSection';
import { Avaliacoes } from '../src/components/Avaliacoes';
import { Localizacao } from '../src/components/Localizacao';
import { FAQ } from '../src/components/FAQ';
import { CTAFinal } from '../src/components/CTAFinal';
import { Footer } from '../src/components/Footer';
import { FloatingWhatsApp } from '../src/components/FloatingWhatsApp';
import { QualificationModal } from '../src/components/QualificationModal';
import { FichaHero, FichaIncluido, FichaModalidades } from './blocos/Ficha';
import { FiltroHero, MapaDaProva } from './blocos/FiltroAVista';
import { CartaoHero, CartaoDuasHoras, CartaoPreparo } from './blocos/Cartao';

export type Opcao = 'atual' | 'ficha' | 'filtro-a-vista' | 'cartao';

export const NOMES: Record<Opcao, string> = {
  atual: 'Página atual (base)',
  ficha: 'Ficha',
  'filtro-a-vista': 'Filtro à vista',
  cartao: 'Cartão de consulta',
};

export function Pagina({ opcao }: { opcao: Opcao }) {
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState('');

  useEffect(() => {
    window.openQualificationModal = (l = 'nao_informado') => {
      setLocal(l);
      setAberto(true);
    };
    return () => { delete window.openQualificationModal; };
  }, []);

  const heroi = {
    atual: <Hero />,
    ficha: <FichaHero><Hero /></FichaHero>,
    'filtro-a-vista': <FiltroHero><Hero /></FiltroHero>,
    cartao: <CartaoHero><Hero /></CartaoHero>,
  }[opcao];

  return (
    <div className="font-sans text-primary-brown motion-safe:scroll-smooth" data-opcao={opcao}>
      <Header />
      <main>
        {heroi}
        <Acolhimento />
        <PorQueInvestigar />
        {opcao === 'filtro-a-vista' && <MapaDaProva />}
        {opcao === 'ficha' ? <FichaModalidades><Modalidades /></FichaModalidades> : <Modalidades />}
        {opcao === 'ficha' ? <FichaIncluido><OQueEstaIncluido /></FichaIncluido> : <OQueEstaIncluido />}
        {opcao === 'cartao' ? <CartaoDuasHoras><ComoFunciona /></CartaoDuasHoras> : <ComoFunciona />}
        {opcao === 'cartao' ? <CartaoPreparo><PreparacaoEOutrasCidades /></CartaoPreparo> : <PreparacaoEOutrasCidades />}
        <DraKaryne />
        <YouTubeSection />
        <Avaliacoes />
        <Localizacao />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <QualificationModal isOpen={aberto} onClose={() => setAberto(false)} ctaLocation={local} />
      <div className="selo-previa" aria-hidden="true"><b>Prévia · {NOMES[opcao]}</b>{opcao !== 'atual' && <span>sublinhado tracejado = texto novo, a aprovar</span>}</div>
    </div>
  );
}

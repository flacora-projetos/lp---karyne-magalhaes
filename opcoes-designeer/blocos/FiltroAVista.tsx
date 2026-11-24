/**
 * Ideia 2 — Filtro à vista. A tela que convence sozinha é o próprio filtro:
 * a pergunta real do caso aparece logo abaixo do título e já responde com o
 * texto aprovado das modalidades. Mais o mapa de onde vem cada informação.
 */
import type * as React from 'react';
import { useState, type ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AAprovar, EtiquetaAAprovar, useParagrafoDepoisDe } from './comum';

// As seis opções são as do filtro real (etapa 2 de 7), sem mudança.
const OPCOES = [
  'O odor costuma estar presente com frequência',
  'O odor aparece e desaparece',
  'Fui alertado por alguém, mas não consigo perceber',
  'Tenho dúvida se realmente existe alteração',
  'Quero realizar uma avaliação preventiva',
  'Prefiro explicar diretamente à equipe',
] as const;

type Caminho = 'simples' | 'completa' | 'equipe';
// Ligação entre a situação e a modalidade: interpretação nova do texto aprovado, a aprovar pela clínica.
const CAMINHO: Record<(typeof OPCOES)[number], Caminho> = {
  'O odor costuma estar presente com frequência': 'simples',
  'O odor aparece e desaparece': 'completa',
  'Fui alertado por alguém, mas não consigo perceber': 'completa',
  'Tenho dúvida se realmente existe alteração': 'completa',
  'Quero realizar uma avaliação preventiva': 'equipe',
  'Prefiro explicar diretamente à equipe': 'equipe',
};

const PAINEL = '[data-ga-section="modalidades"]';

export const FiltroAoVivo = () => {
  const [escolha, setEscolha] = useState<(typeof OPCOES)[number] | null>(null);
  const textoSimples = useParagrafoDepoisDe('OralChroma', PAINEL);
  const textoCompleta = useParagrafoDepoisDe('OralChroma + Desafio da Cisteína', PAINEL);
  const caminho = escolha ? CAMINHO[escolha] : null;

  return (
    <div className="filtro-vivo" aria-live="polite">
      <div className="filtro-cabeca">
        <span className="filtro-quem"><img src="/images/karyne_hero.jpg" alt="" width="32" height="32" />Avaliação inicial</span>
        <span className="filtro-etapa"><AAprovar>Uma das 7 perguntas</AAprovar></span>
      </div>
      <h2 className="filtro-pergunta">Qual situação mais se aproxima do seu caso?</h2>
      <div className="filtro-opcoes" role="group" aria-label="Situações">
        {OPCOES.map((o) => (
          <button key={o} type="button" aria-pressed={escolha === o} onClick={() => setEscolha(o)} className="filtro-opcao">
            <span>{o}</span>
            <span className="filtro-marca" aria-hidden="true">{escolha === o && <Check size={12} />}</span>
          </button>
        ))}
      </div>

      <div className={`filtro-resposta ${caminho ? 'tem' : ''}`}>
        {!caminho && <p className="filtro-dica"><AAprovar>Escolha uma situação para ver qual avaliação a página descreve para ela.</AAprovar></p>}
        {caminho === 'simples' && (
          <>
            <p className="filtro-rotulo">OralChroma <small>· Alternativa mais simples</small></p>
            <p>{textoSimples}</p>
            <p className="filtro-nota"><AAprovar>A avaliação mais completa, com o Desafio da Cisteína, também investiga esse caso.</AAprovar></p>
          </>
        )}
        {caminho === 'completa' && (
          <>
            <p className="filtro-rotulo">OralChroma + Desafio da Cisteína <small>· Recomendada</small></p>
            <p>{textoCompleta}</p>
          </>
        )}
        {caminho === 'equipe' && (
          <>
            <p className="filtro-rotulo">A equipe orienta</p>
            <p>Se ainda tiver dúvida, a equipe pode orientar qual avaliação faz mais sentido antes do agendamento.</p>
          </>
        )}
        <button type="button" className="filtro-seguir" onClick={() => window.openQualificationModal?.('hero_filtro_a_vista')}>
          Começar avaliação inicial <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export const FiltroHero = ({ children }: { children: ReactNode }) => (
  <div className="heroi-com-objeto heroi-filtro">
    {children}
    <div className="objeto-heroi"><FiltroAoVivo /></div>
  </div>
);

/** Mapa: de onde vem cada informação que a consulta junta antes da explicação dos resultados. */
const FONTES = [
  { onde: 'A conversa', itens: ['Anamnese e história clínica'] },
  { onde: 'A boca', itens: ['Avaliação odontológica completa', 'Fotografias intraorais'] },
  { onde: 'A saliva', itens: ['Sialometria (avaliação do fluxo e qualidade salivar)'] },
  { onde: 'O ar', itens: ['Medição objetiva dos gases do hálito com OralChroma'] },
];

export const MapaDaProva = () => (
  <section className="mapa-prova" data-ga-section="mapa_prova" aria-labelledby="mapa-titulo">
    <div className="mapa-envolve">
      <div className="mapa-intro">
        <p className="mapa-sobre"><EtiquetaAAprovar /></p>
        <h2 id="mapa-titulo"><AAprovar>De onde vem cada informação da consulta</AAprovar></h2>
        <p><AAprovar>Quatro fontes, examinadas uma a uma, antes de qualquer conduta.</AAprovar></p>
      </div>
      <div className="mapa">
        <ol className="mapa-fontes">
          {FONTES.map((f, i) => (
            <li key={f.onde} style={{ '--i': i } as React.CSSProperties}>
              <span className="mapa-onde"><AAprovar>{f.onde}</AAprovar></span>
              {f.itens.map((t) => <span key={t} className="mapa-item">{t}</span>)}
            </li>
          ))}
        </ol>
        <svg className="mapa-linhas" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
          {[50, 150, 250, 350].map((x) => <path key={x} d={`M ${x} 0 C ${x} 34, 200 26, 200 60`} />)}
        </svg>
        <div className="mapa-destino">
          <span>Explicação dos resultados</span>
          <ArrowRight size={16} aria-hidden="true" />
          <span>Orientação dos próximos passos</span>
        </div>
      </div>
    </div>
  </section>
);

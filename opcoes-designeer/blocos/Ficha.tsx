/**
 * Ideia 1 — Ficha. A prova da consulta vira um objeto: a ficha de investigação
 * impressa linha por linha, com o traçado dos gases e o carimbo no fim.
 * As etapas são lidas do bloco "Como funciona" (texto aprovado).
 */
import type * as React from 'react';
import type { ReactNode } from 'react';
import { AAprovar, useTextos } from './comum';

/** Três picos ilustrativos (sem valores): só a forma de um registro de cromatografia. */
function tracado() {
  const picos = [
    { x: 62, h: 58, l: 9 },
    { x: 158, h: 78, l: 11 },
    { x: 256, h: 40, l: 10 },
  ];
  const base = 92;
  let d = `M 8 ${base}`;
  for (let x = 8; x <= 312; x += 2) {
    const y = picos.reduce((acc, p) => acc - p.h * Math.exp(-((x - p.x) ** 2) / (2 * p.l ** 2)), base);
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return { d, picos, base };
}

export const Tracado = () => {
  const { d, picos, base } = tracado();
  const nomes = ['H₂S', 'CH₃SH', '(CH₃)₂S'];
  return (
    <svg className="tracado" viewBox="0 0 320 118" role="img" aria-label="Traçado ilustrativo com três picos, um para cada gás medido. Sem valores.">
      <line x1="8" y1={base} x2="312" y2={base} className="tracado-eixo" />
      {[0, 1, 2, 3].map((i) => <line key={i} x1="8" x2="312" y1={20 + i * 18} y2={20 + i * 18} className="tracado-grade" />)}
      <path d={d} className="tracado-linha" pathLength={1} />
      {picos.map((p, i) => (
        <text key={i} x={p.x} y={base + 18} textAnchor="middle" className="tracado-rotulo">{nomes[i]}</text>
      ))}
    </svg>
  );
};

export const Ficha = () => {
  const etapas = useTextos('#como-funciona h3');
  return (
    <div className="ficha" aria-label="Ficha de investigação do hálito, com as cinco etapas da consulta">
      <div className="ficha-topo l" style={{ '--l': 0 } as React.CSSProperties}>
        <span>Dra. Karyne Magalhães · CRO-GO 7954</span>
        <b><AAprovar>Ficha de investigação do hálito</AAprovar></b>
      </div>
      <ol className="ficha-etapas">
        {etapas.map((t, i) => (
          <li key={t} className="l" style={{ '--l': i + 1 } as React.CSSProperties}>
            <span className="ficha-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="ficha-nome">{t}</span>
            <span className="ficha-ok" aria-hidden="true">✓</span>
            {i === 3 && (
              <div className="ficha-gases">
                <Tracado />
                <p><AAprovar>Os três gases medidos separadamente pelo OralChroma. Traçado ilustrativo, sem valores de paciente.</AAprovar></p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="ficha-pe l" style={{ '--l': 7 } as React.CSSProperties}>
        <span>Duração aproximada: 2&nbsp;horas.</span>
        <span className="carimbo"><AAprovar>Voltada ao diagnóstico</AAprovar></span>
      </div>
    </div>
  );
};

export const FichaHero = ({ children }: { children: ReactNode }) => (
  <div className="heroi-com-objeto heroi-ficha">
    {children}
    <div className="objeto-heroi"><Ficha /></div>
  </div>
);

/** "Duas formas de avaliar": os dois cartões viram guias de requisição; o selo vira carimbo. */
export const FichaModalidades = ({ children }: { children: ReactNode }) => <div className="ficha-modalidades">{children}</div>;

/** "A consulta vai além da medição": a lista vira o extrato impresso do que está incluído. */
export const FichaIncluido = ({ children }: { children: ReactNode }) => <div className="ficha-incluido">{children}</div>;

import { useEffect, useState, type ReactNode } from 'react';

/** Marca texto novo que a ideia exigiu e ainda precisa de aprovação. */
export const AAprovar = ({ children }: { children: ReactNode }) => (
  <span className="a-aprovar" title="Texto novo, a aprovar">{children}</span>
);

export const EtiquetaAAprovar = () => <span className="a-aprovar-tag">texto novo · a aprovar</span>;

/**
 * Lê textos aprovados direto dos blocos do site já desenhados na página
 * (ex.: as etapas de "Como funciona"), para não duplicar texto nas opções.
 */
export function useTextos(seletor: string): string[] {
  const [textos, setTextos] = useState<string[]>([]);
  useEffect(() => {
    setTextos([...document.querySelectorAll(seletor)].map((el) => (el.textContent || '').trim()).filter(Boolean));
  }, [seletor]);
  return textos;
}

/** Parágrafo que vem logo depois de um título com o texto exato (lido da página). */
export function useParagrafoDepoisDe(tituloExato: string, dentro: string): string {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    const h = [...document.querySelectorAll(`${dentro} h3`)].find((el) => el.textContent?.trim() === tituloExato);
    setTexto(h?.nextElementSibling?.textContent?.trim() || '');
  }, [tituloExato, dentro]);
  return texto;
}

export const calmo = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

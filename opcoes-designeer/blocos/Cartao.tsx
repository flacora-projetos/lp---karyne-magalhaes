/**
 * Ideia 3 — Cartão de consulta. O que se compra é um horário de 2 horas com
 * preparo de 21 dias: o topo vira o cartão de agendamento; "Como funciona"
 * ganha a régua das duas horas; o preparo ganha o calendário dos 21 dias.
 * Todos os fatos do cartão já estão na página (duração, preparo, endereço, CRO).
 */
import type * as React from 'react';
import type { ReactNode } from 'react';
import { AAprovar, useTextos } from './comum';

export const Cartao = () => (
  <div className="cartao" aria-label="Cartão de consulta com duração, preparo e local">
    <div className="cartao-furo" aria-hidden="true" />
    <p className="cartao-tipo"><AAprovar>Cartão de consulta</AAprovar></p>
    <p className="cartao-nome">Dra. Karyne Magalhães</p>
    <p className="cartao-sub">Especialista em Halitose · CRO-GO 7954</p>
    <dl className="cartao-campos">
      <div><dt>Consulta</dt><dd>Consulta especializada em Halitose</dd></div>
      <div><dt>Duração</dt><dd>Duração aproximada: 2&nbsp;horas.</dd></div>
      <div><dt>Preparo</dt><dd>Pelo menos 21 dias sem utilizar antibióticos</dd></div>
      <div><dt>Local</dt><dd>Alto da Glória, Goiânia - GO</dd></div>
      <div className="cartao-data"><dt>Data</dt><dd><span className="cartao-linha" aria-hidden="true" /><AAprovar>combinada com a equipe</AAprovar></dd></div>
    </dl>
  </div>
);

export const CartaoHero = ({ children }: { children: ReactNode }) => (
  <div className="heroi-com-objeto heroi-cartao">
    {children}
    <div className="objeto-heroi">
      <div className="cartao-cena">
        <img className="cartao-foto" src="/images/karyne_hero.jpg" alt="Dra. Karyne Magalhães, especialista em halitose, em seu consultório em Goiânia" width="1200" height="1500" />
        <Cartao />
      </div>
    </div>
  </div>
);

/** Régua das duas horas, com as etapas reais (lidas do próprio bloco) em ordem. */
export const CartaoDuasHoras = ({ children }: { children: ReactNode }) => {
  const etapas = useTextos('#como-funciona h3');
  return (
    <div className="cartao-duas-horas">
      {children}
      <div className="regua-envolve">
        <div className="regua" role="img" aria-label={`As cinco etapas em ordem, dentro de cerca de duas horas: ${etapas.join('; ')}`}>
          <div className="regua-marcas" aria-hidden="true"><span>início</span><span>cerca de 2&nbsp;horas</span></div>
          <ol className="regua-trilho">
            {etapas.map((t, i) => (
              <li key={t} style={{ '--i': i } as React.CSSProperties}>
                <span className="regua-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="regua-nome">{t}</span>
              </li>
            ))}
          </ol>
          <p className="regua-nota"><AAprovar>A régua mostra a ordem das etapas, não o tempo de cada uma.</AAprovar></p>
        </div>
      </div>
    </div>
  );
};

/** Calendário dos 21 dias sem antibiótico, terminando no dia da consulta. */
export const CartaoPreparo = ({ children }: { children: ReactNode }) => (
  <div className="cartao-preparo">
    <div className="calendario-envolve">
      <div className="calendario">
        <p className="calendario-titulo"><AAprovar>Contagem do preparo</AAprovar></p>
        <ol className="calendario-dias" aria-label="21 dias sem antibióticos e, depois, o dia da consulta">
          {Array.from({ length: 22 }, (_, i) => (
            <li key={i} className={i === 21 ? 'dia-consulta' : ''} style={{ '--i': i } as React.CSSProperties}>
              {i === 21 ? <AAprovar>consulta</AAprovar> : i + 1}
            </li>
          ))}
        </ol>
        <p className="calendario-legenda"><AAprovar>Cada quadrado é um dia sem antibiótico. No 22º, a consulta.</AAprovar></p>
      </div>
    </div>
    {children}
  </div>
);

import test from 'node:test';
import assert from 'node:assert/strict';
import {pushDataLayerEvent} from '../../src/utils/gtm';

test('funil emite uma vez no GA4, preserva Ads e exclui dados de contato e respostas', () => {
  const events: unknown[][] = [];
  const dataLayer: unknown[] = [];
  (globalThis as any).window = {dataLayer, gtag:(...args:unknown[]) => events.push(args)};
  pushDataLayerEvent('etapa_respondida', {step:3, nome:'Pessoa', email:'a@example.invalid', comportamentoHalito:'resposta'});
  assert.equal(dataLayer.length, 1);
  assert.deepEqual(events, [['event','etapa_respondida',{send_to:'G-3783BP5DSB',step:3}]]);
  pushDataLayerEvent('evento_desconhecido', {nome:'Pessoa'});
  assert.equal(dataLayer.length, 2);
  assert.equal(events.length, 1);
  pushDataLayerEvent('filtro_completo', {step:3, whatsapp:'000'});
  assert.deepEqual(events[1], ['event','filtro_completo',{send_to:'G-3783BP5DSB'}]);
});

test('funil não envia passo inválido nem depende da presença de gtag para Ads', () => {
  const events: unknown[][] = [];
  (globalThis as any).window = {gtag:(...args:unknown[]) => events.push(args)};
  pushDataLayerEvent('etapa_respondida', {step:'resposta clínica'});
  assert.deepEqual(events[0], ['event','etapa_respondida',{send_to:'G-3783BP5DSB'}]);
  (globalThis as any).window = {};
  assert.doesNotThrow(() => pushDataLayerEvent('clique_saida'));
  assert.equal((globalThis as any).window.dataLayer.length, 1);
});

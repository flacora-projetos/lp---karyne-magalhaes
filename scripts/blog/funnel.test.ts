import test from 'node:test';
import assert from 'node:assert/strict';
import {pushDataLayerEvent,trackEditorialCtaArrival} from '../../src/utils/gtm';

test('chegada editorial emite clique uma vez e recusa contexto antigo ou URL incompatível', () => {
  const calls:unknown[][]=[];
  const store=new Map<string,string>();
  const key='dacora_editorial_cta_pending_v1';
  (globalThis as any).sessionStorage={getItem:(key:string)=>store.get(key)||null,removeItem:(key:string)=>store.delete(key)};
  (globalThis as any).window={location:{pathname:'/',search:'?blog_cta=1&article=artigo-a'},gtag:(...args:unknown[])=>calls.push(args)};
  store.set(key,JSON.stringify({articleId:'a1',slug:'artigo-a',at:Date.now()}));
  trackEditorialCtaArrival();
  trackEditorialCtaArrival();
  assert.deepEqual(calls,[['event','blog_cta_click',{send_to:'G-3783BP5DSB',article_id:'a1',article_slug:'artigo-a',cta_id:'avaliacao_inicial',cta_destination:'home_filter'}]]);
  store.set(key,JSON.stringify({articleId:'a1',slug:'artigo-a',at:Date.now()-61000}));
  trackEditorialCtaArrival();
  store.set(key,JSON.stringify({articleId:'b1',slug:'artigo-b',at:Date.now()}));
  trackEditorialCtaArrival();
  assert.equal(calls.length,1);
});

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

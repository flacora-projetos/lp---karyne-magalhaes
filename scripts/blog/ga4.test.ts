import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanGa4Params, parseGaClientId, parseGaSessionId, trackGa4} from '../../src/utils/ga4';
import {modalidadeLabel, pushDataLayerEvent} from '../../src/utils/gtm';
import {buildGa4Payload} from '../../lib/ga4MeasurementProtocol';
import {mapPayloadToRow} from '../../lib/mapLead';

test('lê identificadores do GA4 nos dois formatos de cookie e recusa lixo', () => {
  assert.equal(parseGaClientId('GA1.1.1234567890.1696000000'), '1234567890.1696000000');
  assert.equal(parseGaClientId('GA1.2.55.66'), '55.66');
  assert.equal(parseGaClientId('qualquer'), '');
  assert.equal(parseGaClientId(undefined), '');
  assert.equal(parseGaSessionId('GS1.1.1696000000.3.1.1696000100.0.0.0'), '1696000000');
  assert.equal(parseGaSessionId('GS2.1.s1696000000$o3$g1$t1696000100$j0$l0$h0'), '1696000000');
  assert.equal(parseGaSessionId('GS2.1.s1696000000'), '1696000000');
  assert.equal(parseGaSessionId('xyz'), '');
});

test('parâmetros do GA4 só aceitam texto curto ou número', () => {
  assert.deepEqual(
    cleanGa4Params({a: ' x ', b: 3, c: '', d: null, e: {x: 1}, f: Number.NaN, g: 'y'.repeat(150)}),
    {a: 'x', b: 3, g: 'y'.repeat(100)},
  );
});

test('trackGa4 envia para a propriedade da LP e ignora ausência de gtag', () => {
  const events: unknown[][] = [];
  (globalThis as any).window = {gtag: (...args: unknown[]) => events.push(args)};
  trackGa4('cta_click', {cta_location: 'hero', vazio: ''});
  assert.deepEqual(events, [['event', 'cta_click', {send_to: 'G-3783BP5DSB', cta_location: 'hero'}]]);
  (globalThis as any).window = {};
  assert.doesNotThrow(() => trackGa4('cta_click'));
});

test('modalidade vira rótulo fechado, sem o texto exibido', () => {
  assert.equal(modalidadeLabel('Tenho interesse no OralChroma + Desafio da Cisteína'), 'oralchroma_cisteina');
  assert.equal(modalidadeLabel('Tenho interesse no OralChroma'), 'oralchroma');
  assert.equal(modalidadeLabel('Ainda não sei qual escolher'), 'indeciso');
  assert.equal(modalidadeLabel('Quero orientação da equipe antes de decidir'), 'quer_orientacao');
  assert.equal(modalidadeLabel(''), '');
});

test('funil leva rótulos do site ao GA4 e barra texto livre', () => {
  const events: unknown[][] = [];
  (globalThis as any).window = {gtag: (...args: unknown[]) => events.push(args)};
  pushDataLayerEvent('filtro_completo', {fluxo: 'filtro', modalidade: 'oralchroma_cisteina', nome: 'Pessoa'});
  pushDataLayerEvent('clique_saida', {fluxo: 'gads_direto', cta_location: 'Texto Livre Com Espaço'});
  pushDataLayerEvent('filtro_fechado', {step: 4, fluxo: 'filtro'});
  assert.deepEqual(events, [
    ['event', 'filtro_completo', {send_to: 'G-3783BP5DSB', fluxo: 'filtro', modalidade: 'oralchroma_cisteina'}],
    ['event', 'clique_saida', {send_to: 'G-3783BP5DSB', fluxo: 'gads_direto'}],
    ['event', 'filtro_fechado', {send_to: 'G-3783BP5DSB', step: 4, fluxo: 'filtro'}],
  ]);
});

test('consulta realizada vai ao GA4 no visitante do site, sem dado pessoal', () => {
  const linked = buildGa4Payload({
    eventName: 'close_convert_lead', clientId: '123.456', sessionId: '1696000000', fallbackId: 'lead-1',
    params: {lead_status: 'consulta_realizada', currency: 'BRL', value: 1090, lead_source: undefined},
  });
  assert.equal(linked.linkedVisitor, true);
  assert.deepEqual(linked.body, {
    client_id: '123.456',
    events: [{name: 'close_convert_lead', params: {
      lead_status: 'consulta_realizada', currency: 'BRL', value: 1090,
      session_id: '1696000000', engagement_time_msec: 1, vinculo_visitante: 'visitante_do_site',
    }}],
  });
  const orphan = buildGa4Payload({eventName: 'close_convert_lead', clientId: null, sessionId: 'abc', fallbackId: 'lead-2'});
  assert.equal(orphan.linkedVisitor, false);
  assert.equal(orphan.body.client_id, 'crm.lead-2');
  assert.deepEqual(orphan.body.events[0].params, {engagement_time_msec: 1, vinculo_visitante: 'sem_visitante'});
});

test('lead guarda só identificadores GA4 válidos', () => {
  assert.equal(mapPayloadToRow({leadId: 'l', gaClientId: '123.456', gaSessionId: '1696000000'}).ga_client_id, '123.456');
  const bad = mapPayloadToRow({leadId: 'l', gaClientId: 'GA1.1.x', gaSessionId: ''});
  assert.equal(bad.ga_client_id, null);
  assert.equal(bad.ga_session_id, null);
});

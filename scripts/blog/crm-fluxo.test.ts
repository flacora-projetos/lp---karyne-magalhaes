import test from 'node:test';
import assert from 'node:assert/strict';
import { enviarContatoFluxo, enviarEtapaFluxo, fluxoContato, fluxoEtapa } from '../../lib/crmFluxo';

const lead = {
  lead_id: 'lead-abc', nome: 'Ana Souza', whatsapp: '(62) 99999-1234', email: 'ana@exemplo.com',
  criado_em: '2026-10-22T13:05:00Z', origem: 'Meta Ads', channel_derived: 'Paid Social',
  utm_campaign: 'OUT/26', utm_content: 'Boca seca', opcao_interesse: 'Avaliação completa',
  periodo_preferido: 'Manhã', cidade: 'Goiânia', estado: 'GO', etapa_funil: 'Filtro concluído(Concluiu o filtro)',
  page_url: 'https://tratamentodomauhalito.com.br/?utm_source=instagram',
  comportamento_halito: 'dado clínico', uso_antibiotico: 'Sim', valor_fechado: 450,
};

test('lead com WhatsApp vira contato com as respostas, sem dados clínicos', () => {
  const c = fluxoContato(lead)!;
  assert.equal(c.telefone, '(62) 99999-1234');
  assert.equal(c.ref, 'lead-abc');
  assert.equal(c.nome, 'Ana Souza');
  assert.deepEqual(c.origem, { tipo: 'site', titulo: 'Formulário do site', url: lead.page_url });
  assert.match(c.observacoes, /^Formulário do site — 22\/10\/2026, 10:05/);
  assert.match(c.observacoes, /Anúncio: Boca seca/);
  assert.match(c.observacoes, /Cidade: Goiânia\/GO/);
  assert.doesNotMatch(c.observacoes, /clínico|antibiótico|Sim$/i);
});

test('sem WhatsApp válido não manda nada', () => {
  assert.equal(fluxoContato({ ...lead, whatsapp: '' }), null);
  assert.equal(fluxoContato({ ...lead, whatsapp: '9999-1234' }), null);
  assert.equal(fluxoContato({ ...lead, lead_id: '' }), null);
});

test('triagem e cadastro manual ganham título próprio', () => {
  assert.equal(fluxoContato({ ...lead, utm_source: 'whatsapp', utm_medium: 'triagem' })!.origem.titulo, 'Triagem do WhatsApp (site)');
  assert.equal(fluxoContato({ ...lead, utm_medium: 'manual', etapa_funil: 'Cadastro manual (WhatsApp)' })!.origem.titulo, 'Cadastro manual no painel do site');
});

test('etapa usa a mesma chave do status; valor só na consulta realizada', () => {
  const agora = new Date('2026-10-22T15:00:00Z');
  assert.deepEqual(fluxoEtapa(lead, 'consulta_agendada', agora),
    { etapa: 'consulta_agendada', telefone: '(62) 99999-1234', ref: 'lead-abc', valor: undefined, ocorrido_em: '2026-10-22T15:00:00.000Z' });
  assert.equal(fluxoEtapa(lead, 'consulta_realizada', agora)!.valor, 450);
  assert.equal(fluxoEtapa({ ...lead, valor_fechado: null }, 'consulta_realizada', agora)!.valor, undefined);
});

test('sem configuração não chama nada; com configuração manda contato e depois etapa', async () => {
  const chamadas: { url: string; auth: string; corpo: any }[] = [];
  const falso = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, auth: (init.headers as Record<string, string>).Authorization, corpo: JSON.parse(String(init.body)) });
    return new Response('{"ok":true}', { status: 200 });
  }) as unknown as typeof fetch;

  delete process.env.FLUXO_URL; delete process.env.FLUXO_CHAVE;
  await enviarContatoFluxo(lead, falso);
  assert.equal(chamadas.length, 0);

  process.env.FLUXO_URL = 'https://fluxo.exemplo/functions/v1/';
  process.env.FLUXO_CHAVE = 'crm_teste';
  await enviarEtapaFluxo(lead, 'consulta_agendada', falso);
  assert.deepEqual(chamadas.map((c) => c.url), ['https://fluxo.exemplo/functions/v1/contato-externo', 'https://fluxo.exemplo/functions/v1/resultado-externo']);
  assert.equal(chamadas[0].auth, 'Bearer crm_teste');
  assert.equal(chamadas[1].corpo.etapa, 'consulta_agendada');
});

test('Fluxo fora do ar não derruba quem chamou', async () => {
  process.env.FLUXO_URL = 'https://fluxo.exemplo/functions/v1';
  process.env.FLUXO_CHAVE = 'crm_teste';
  const quebrado = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
  const erro = console.error; console.error = () => {};
  try {
    await enviarContatoFluxo(lead, quebrado);
    await enviarEtapaFluxo(lead, 'consulta_agendada', quebrado);
  } finally {
    console.error = erro;
    delete process.env.FLUXO_URL; delete process.env.FLUXO_CHAVE;
  }
});

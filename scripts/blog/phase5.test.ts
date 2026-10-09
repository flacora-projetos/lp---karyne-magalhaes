import test from 'node:test';
import assert from 'node:assert/strict';
import { readArticles } from './core.mjs';
import { selectReleaseArticles } from './phase5-release.mjs';
import {
  assertReleaseApprovals,
  classifyInspection,
  getInspectionLimit,
  sha256Text,
  sitemapNeedsSubmit,
  validateReleasePreparation,
  verifyProductionHtml,
} from '../../lib/blogGsc.ts';
import { getGoogleSearchConsoleAuthMode } from '../../lib/googleSearchConsole.ts';
import { canRecoverGscRun } from '../../lib/blogGscStore.ts';
import cronHandler, { validCronSecret } from '../../api/blog-gsc-cron.ts';
import adminHandler from '../../api/blog-gsc.ts';

function response() {
  return {
    code: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

function validRecord() {
  const content = 'a'.repeat(64);
  const presentation = 'b'.repeat(64);
  return {
    publication: {
      id: 'pub', article_id: 'art', article_version_id: 'ver',
      content_sha256: content, presentation_sha256: presentation, release_sha256: 'c'.repeat(64),
    },
    version: { id: 'ver', article_id: 'art', version_number: 2, content_sha256: content, presentation_sha256: presentation },
    article: { id: 'art', target_slug: 'artigo-teste', status: 'aprovado' },
    reviews: [
      { review_type: 'editorial', status: 'approved', reviewed_at: '2026-10-09T10:00:00Z', content_sha256: content, presentation_sha256: presentation },
      { review_type: 'clinical', status: 'approved', reviewed_at: '2026-10-09T10:01:00Z', content_sha256: content, presentation_sha256: presentation },
    ],
  };
}

test('release da fase 5 exige seleção explícita por slug e nunca inclui o acervo inteiro implicitamente', () => {
  const articles = readArticles('content/blog/published');
  assert.equal(articles.length, 3);
  assert.throws(() => selectReleaseArticles(articles, []), /exige ao menos um --slug explícito/);
  const selected = selectReleaseArticles(articles, [articles[0].slug]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].slug, articles[0].slug);
  assert.throws(() => selectReleaseArticles(articles, ['nao-existe']), /Slug não encontrado/);
});

test('confirmação de publicação falha fechada se aprovação editorial/clínica não corresponder à versão exata', () => {
  assert.equal(assertReleaseApprovals(validRecord()), true);
  const bad = validRecord();
  bad.reviews[1].content_sha256 = 'd'.repeat(64);
  assert.throws(() => assertReleaseApprovals(bad), /Aprovação clinical válida não encontrada/);
});

test('preparo de release exige canonical, operation key e hashes da versão aprovada', () => {
  const record = validRecord();
  const input = {
    canonicalUrl: 'https://tratamentodomauhalito.com.br/blog/artigo-teste/',
    operationKey: `publish:art:v2:${'c'.repeat(64)}`,
    contentSha256: 'a'.repeat(64),
    presentationSha256: 'b'.repeat(64),
    releaseSha256: 'c'.repeat(64),
    htmlSha256: 'd'.repeat(64),
  };
  assert.equal(validateReleasePreparation(record, input), true);
  assert.throws(() => validateReleasePreparation(record, { ...input, operationKey: `publish:art:v3:${'c'.repeat(64)}` }), /operationKey não corresponde/);
  assert.throws(() => validateReleasePreparation(record, { ...input, canonicalUrl: 'https://evil.example/blog/artigo-teste/' }), /canonicalUrl não corresponde/);
});

test('credencial genérica do Google Ads não é reutilizada implicitamente pelo GSC', () => {
  const names = [
    'GSC_OAUTH_CLIENT_ID', 'GSC_OAUTH_CLIENT_SECRET', 'GSC_OAUTH_REFRESH_TOKEN',
    'GSC_GOOGLE_SA_KEY_B64', 'GSC_GOOGLE_SA_CLIENT_EMAIL', 'GSC_GOOGLE_SA_PRIVATE_KEY',
    'GOOGLE_SA_KEY_B64',
  ];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.GOOGLE_SA_KEY_B64 = Buffer.from(JSON.stringify({ client_email: 'ads@example.invalid', private_key: 'not-a-key' })).toString('base64');
    assert.equal(getGoogleSearchConsoleAuthMode(), 'not_configured');
    process.env.GSC_OAUTH_CLIENT_ID = 'client';
    process.env.GSC_OAUTH_CLIENT_SECRET = 'secret';
    process.env.GSC_OAUTH_REFRESH_TOKEN = 'refresh';
    assert.equal(getGoogleSearchConsoleAuthMode(), 'oauth_refresh');
  } finally {
    for (const name of names) {
      const value = before[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('produção só é confirmada quando o HTML efetivo tem o hash esperado', async () => {
  const html = '<!doctype html><title>versão correta</title>';
  const expected = sha256Text(html);
  assert.equal((await verifyProductionHtml('https://example.test', expected, async () => html)).htmlSha256, expected);
  await assert.rejects(
    () => verifyProductionHtml('https://example.test', expected, async () => '<!doctype html><title>versão antiga</title>'),
    /não corresponde à versão esperada/,
  );
});

test('sitemap inalterado não pede novo envio; mudança de conteúdo pede somente após baseline confirmado', () => {
  const current = 'a'.repeat(64);
  assert.equal(sitemapNeedsSubmit(current, current), false);
  assert.equal(sitemapNeedsSubmit(null, current), false);
  assert.equal(sitemapNeedsSubmit('b'.repeat(64), current), true);
});

test('lease bloqueia concorrência, permite uma recuperação limitada e nunca repete estado incerto', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  assert.equal(canRecoverGscRun({ status: 'running', attempts: 1, lease_until: '2026-10-09T12:10:00Z' }, now), false);
  assert.equal(canRecoverGscRun({ status: 'failed', attempts: 1, lease_until: '2026-10-09T11:00:00Z' }, now), true);
  assert.equal(canRecoverGscRun({ status: 'failed', attempts: 2, lease_until: '2026-10-09T11:00:00Z' }, now), false);
  assert.equal(canRecoverGscRun({ status: 'uncertain', attempts: 1, lease_until: '2026-10-09T11:00:00Z' }, now), false);
});

test('URL Inspection mantém ausência/inconclusão distinta de zero e só cria pendência persistente após 14 dias', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const recent = classifyInspection({ inspectionResult: { indexStatusResult: {} } }, '2026-10-08T12:00:00Z', now);
  assert.equal(recent.knowledge_state, 'inconclusive');
  assert.equal(recent.action_state, 'inconclusive');
  assert.equal(recent.last_crawl_time, null);

  const unknown = classifyInspection({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' } } }, '2026-10-01T12:00:00Z', now);
  assert.equal(unknown.knowledge_state, 'unknown_to_google');
  assert.equal(unknown.action_state, 'waiting');

  const persistent = classifyInspection({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' } } }, '2026-09-20T12:00:00Z', now);
  assert.equal(persistent.action_state, 'action_required');
  assert.equal(persistent.action_reason, 'not_indexed_after_14_days');

  const blocked = classifyInspection({ inspectionResult: { indexStatusResult: { robotsTxtState: 'DISALLOWED' } } }, '2026-10-08T12:00:00Z', now);
  assert.equal(blocked.action_state, 'action_required');
});

test('limite por execução respeita teto local independente da cota do Google', () => {
  const before = process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN;
  try {
    process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN = '999';
    assert.equal(getInspectionLimit(), 10);
    process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN = '7';
    assert.equal(getInspectionLimit(), 7);
  } finally {
    if (before === undefined) delete process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN;
    else process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN = before;
  }
});

test('cron permanece desligado por padrão e segredo usa comparação estrita', async () => {
  const enabled = process.env.BLOG_GSC_AUTOMATION_ENABLED;
  try {
    delete process.env.BLOG_GSC_AUTOMATION_ENABLED;
    assert.equal(validCronSecret('Bearer abc', 'abc'), true);
    assert.equal(validCronSecret('Bearer abc', 'abd'), false);
    const res = response();
    await cronHandler({ method: 'GET', headers: {} } as any, res as any);
    assert.equal(res.code, 503);
    assert.equal(res.body.error, 'automation_disabled');
  } finally {
    if (enabled === undefined) delete process.env.BLOG_GSC_AUTOMATION_ENABLED;
    else process.env.BLOG_GSC_AUTOMATION_ENABLED = enabled;
  }
});

test('relatório administrativo rejeita acesso anônimo sem consultar banco ou Google', async () => {
  const res = response();
  await adminHandler({ method: 'GET', headers: {} } as any, res as any);
  assert.equal(res.code, 401);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});
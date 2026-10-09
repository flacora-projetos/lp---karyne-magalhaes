import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {contentFingerprint, presentationFingerprint, readArticles, releaseFingerprint, validateArticle} from './core.mjs';
import {articleImage, isPresentationReady} from './editorial.mjs';
import {buildImportPlan, readNdjson} from './phase4-import.mjs';
import {buildReleaseManifest} from './phase4-release.mjs';
import {validateDraft} from './phase4-draft.mjs';

const docsRoot = path.resolve(process.cwd(), '../docs/blog-organico');
const published = readArticles('content/blog/published');

test('contrato de apresentação preserva os três artigos atuais e separa hash clínico do visual', () => {
  assert.equal(published.length, 3);
  for (const article of published) {
    assert.equal(isPresentationReady(article), true);
    assert.ok(articleImage(article));
    assert.match(presentationFingerprint(article), /^[0-9a-f]{64}$/);
    assert.match(releaseFingerprint(article), /^[0-9a-f]{64}$/);
    assert.equal(contentFingerprint(article), article.approval.contentHash);
  }

  const base = structuredClone(published[0]);
  const contentBefore = contentFingerprint(base);
  const releaseBefore = releaseFingerprint(base);
  base.presentation = {
    kind:'image', reviewStatus:'reviewed', subject:'consulta odontológica sem paciente identificável',
    image:{file:'karyne_cta.jpg', width:854, height:1280, label:'Avaliação', alt:'Retrato da Dra. Karyne no consultório', caption:'Imagem de apresentação; não representa atendimento clínico.'},
  };
  assert.equal(contentFingerprint(base), contentBefore);
  assert.notEqual(releaseFingerprint(base), releaseBefore);
  assert.equal(isPresentationReady(base), true);
});

test('artigo futuro falha fechado sem apresentação revisada; fallback sem imagem exige motivo explícito', () => {
  const article = structuredClone(published[0]);
  article.slug = 'artigo-futuro-sem-foto';
  delete article.presentation;
  assert.equal(isPresentationReady(article), false);

  article.presentation = {kind:'none', reviewStatus:'reviewed', subject:'sem-imagem-adequada', reason:'Nenhuma imagem disponível passou pela revisão semântica.'};
  assert.equal(isPresentationReady(article), true);
  assert.equal(articleImage(article), null);
  assert.match(presentationFingerprint(article), /^[0-9a-f]{64}$/);

  article.presentation = {kind:'image', reviewStatus:'pending', subject:'x', image:{file:'x.jpg',width:1,height:1,label:'x',alt:'x',caption:'x'}};
  assert.throws(() => validateArticle(article, 'future.json'), /contrato de apresentação inválido ou não revisado/);
});

test('plano de importação cobre 129 fontes, enriquece 4 existentes e é determinístico', () => {
  const rows = readNdjson(path.join(docsRoot, 'etapa-1/acervo/normalizado/current/articles.ndjson'));
  const existing = JSON.parse(fs.readFileSync(path.join(docsRoot, 'etapa-4/evidencias/editorial-sources-remoto.json'), 'utf8'));
  const one = buildImportPlan(rows, existing);
  const two = buildImportPlan(rows, existing);
  assert.equal(one.count, 129);
  assert.equal(one.enrichments, 4);
  assert.equal(one.inserts, 125);
  assert.equal(one.inserts + one.enrichments, one.count);
  assert.equal(one.plan_sha256, two.plan_sha256);
  const emptyLegacy = one.operations.find(item => item.desired.external_id === '969');
  assert.equal(emptyLegacy?.desired.normalized_body_text, '');
});

test('manifesto de release gera chaves idempotentes e não expõe notas privadas', () => {
  const one = buildReleaseManifest(published);
  const two = buildReleaseManifest(published);
  assert.equal(one.count, 3);
  assert.equal(one.manifest_sha256, two.manifest_sha256);
  assert.equal(new Set(one.releases.map(item => item.operation_key)).size, 3);
  for (const item of one.releases) {
    assert.match(item.release_sha256, /^[0-9a-f]{64}$/);
    assert.match(item.html_sha256, /^[0-9a-f]{64}$/);
    assert.ok(item.html.startsWith('<!doctype html>'));
    assert.ok(item.html.includes(`<link rel="canonical" href="${item.canonical}">`));
    assert.ok(item.html.includes('application/ld+json'));
    assert.ok(item.html.includes('https://wa.me/5562999320675?text='));
    assert.equal('reviewPending' in item.payload, false);
    assert.equal('sourceContent' in item.payload, false);
  }
});

test('validador do rascunho bloqueia fonte, referência e link inventados', () => {
  const source = {sourceId:12059};
  const briefing = {allowedInternalLinks:['/blog/como-funciona-avaliacao-especializada-mau-halito/']};
  const references = [{url:'https://pubmed.ncbi.nlm.nih.gov/41678945/'}];
  const valid:any = {
    sourceId:'12059', targetSlug:'oralchroma-exame-mau-halito-como-funciona', clinicalReviewPending:true,
    workingTitle:'Avaliação do hálito', description:'Avaliação profissional.', searchIntent:'informacional', editorialContribution:'Contextualizar o exame sem promessas.',
    presentationSuggestion:{subject:'OralChroma',decision:'manual_review_required',notes:'Selecionar imagem real.'},
    reviewPending:['revisão clínica da Dra. Karyne'],
    body:Array.from({length:6}, () => ({type:'p', text:'Rascunho para revisão.'})),
    references:[{title:'Guideline',url:references[0].url,supports:'diagnóstico'}],
    internalLinks:[{label:'Avaliação',url:briefing.allowedInternalLinks[0]}],
  };
  assert.equal(validateDraft(structuredClone(valid), {source, briefing, references}).sourceId, '12059');
  const badRef = structuredClone(valid); badRef.references[0].url = 'https://example.invalid/inventada';
  assert.throws(() => validateDraft(badRef, {source, briefing, references}), /referência não fornecida/);
  const badLink = structuredClone(valid); badLink.internalLinks[0].url = '/blog/link-nao-autorizado/';
  assert.throws(() => validateDraft(badLink, {source, briefing, references}), /link interno não autorizado/);
});

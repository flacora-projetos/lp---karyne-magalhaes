import crypto from 'crypto';
import {
  GoogleSearchConsoleError,
  getGscSite,
  getGscSitemap,
  inspectGscUrl,
  submitGscSitemap,
} from './googleSearchConsole.js';
import {
  claimGscRun,
  finishGscRun,
  getEditorialVersionRecord,
  getGscState,
  getGscReport,
  getPreparedRelease,
  listDueGscUrls,
  markPublicationVerified,
  recordPreparedRelease,
  saveGscInspection,
  syncPublishedUrls,
  upsertGscState,
} from './blogGscStore.js';

export const GSC_SITE_URL = 'sc-domain:tratamentodomauhalito.com.br';
export const BLOG_ORIGIN = 'https://tratamentodomauhalito.com.br';
export const GSC_SITEMAP_URL = `${BLOG_ORIGIN}/sitemap.xml`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ACTION_AFTER_DAYS = 14;

export function sha256Text(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function getInspectionLimit() {
  const parsed = Number.parseInt(process.env.BLOG_GSC_MAX_INSPECTIONS_PER_RUN || '10', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 10);
}

export function sitemapNeedsSubmit(lastConfirmedSha256: string | null | undefined, currentSha256: string) {
  return Boolean(lastConfirmedSha256 && lastConfirmedSha256 !== currentSha256);
}

export function extractSitemapLocs(xml: string) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'"));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function lower(value: unknown) {
  return String(value || '').toLowerCase();
}

export function classifyInspection(payload: any, publicationConfirmedAt: string | Date, now = new Date()) {
  const result = payload?.inspectionResult?.indexStatusResult || {};
  const verdict = result.verdict || null;
  const coverageState = result.coverageState || null;
  const robotsTxtState = result.robotsTxtState || null;
  const indexingState = result.indexingState || null;
  const pageFetchState = result.pageFetchState || null;
  const publicationDate = new Date(publicationConfirmedAt);
  const ageDays = Math.max(0, Math.floor((now.getTime() - publicationDate.getTime()) / ONE_DAY_MS));

  let knowledgeState: 'indexed' | 'excluded' | 'unknown_to_google' | 'inconclusive' = 'inconclusive';
  if (verdict === 'PASS') knowledgeState = 'indexed';
  else if (['unknown to google', 'desconhecida pelo google', 'desconhecido pelo google', 'não é conhecida pelo google'].some(text => lower(coverageState).includes(text))) knowledgeState = 'unknown_to_google';
  else if (verdict === 'NEUTRAL') knowledgeState = 'excluded';

  const hardBlock = robotsTxtState === 'DISALLOWED'
    || ['BLOCKED_BY_META_TAG', 'BLOCKED_BY_HTTP_HEADER'].includes(indexingState)
    || ['NOT_FOUND', 'ACCESS_DENIED', 'SERVER_ERROR', 'REDIRECT_ERROR', 'ACCESS_FORBIDDEN', 'BLOCKED_4XX', 'SOFT_404', 'INVALID_URL', 'BLOCKED_ROBOTS_TXT'].includes(pageFetchState);

  let actionState: 'waiting' | 'stable' | 'action_required' | 'inconclusive' = 'waiting';
  let actionReason: string | null = null;
  let actionDueAt: string | null = addDays(publicationDate, ACTION_AFTER_DAYS).toISOString();
  let nextInspectionAt = addDays(now, 1).toISOString();

  if (hardBlock) {
    actionState = 'action_required';
    actionReason = `gsc_blocker:${robotsTxtState || indexingState || pageFetchState}`;
    actionDueAt = now.toISOString();
  } else if (knowledgeState === 'indexed') {
    actionState = 'stable';
    actionDueAt = null;
    nextInspectionAt = addDays(now, 7).toISOString();
  } else if (knowledgeState === 'inconclusive') {
    actionState = 'inconclusive';
    actionReason = 'gsc_response_inconclusive';
  } else if (ageDays >= ACTION_AFTER_DAYS) {
    actionState = 'action_required';
    actionReason = `not_indexed_after_${ACTION_AFTER_DAYS}_days`;
    actionDueAt = now.toISOString();
    nextInspectionAt = addDays(now, 3).toISOString();
  }

  return {
    verdict,
    coverage_state: coverageState,
    robots_txt_state: robotsTxtState,
    indexing_state: indexingState,
    page_fetch_state: pageFetchState,
    last_crawl_time: result.lastCrawlTime || null,
    google_canonical: result.googleCanonical || null,
    user_canonical: result.userCanonical || null,
    knowledge_state: knowledgeState,
    action_state: actionState,
    action_reason: actionReason,
    action_due_at: actionDueAt,
    next_inspection_at: nextInspectionAt,
  };
}

export function assertVersionApprovals(record: any, expected: { contentSha256?: string; presentationSha256?: string } = {}) {
  const { version, reviews, article } = record || {};
  if (!version || !article) throw new Error('Versão sem artigo correspondente');
  if (version.article_id !== article.id) throw new Error('Versão aponta para artigo incompatível');
  if (!version.content_sha256) throw new Error('Versão sem hash clínico');
  if (!version.presentation_sha256) throw new Error('Versão sem apresentação revisada');
  if (expected.contentSha256 && version.content_sha256 !== expected.contentSha256) throw new Error('Hash clínico da versão não corresponde ao pacote preparado');
  if (expected.presentationSha256 && version.presentation_sha256 !== expected.presentationSha256) throw new Error('Apresentação da versão não corresponde ao pacote preparado');
  if (!['aprovado', 'publicado'].includes(article.status)) throw new Error('Artigo não está aprovado para publicação');

  for (const required of ['editorial', 'clinical']) {
    const valid = (reviews || []).some((review: any) =>
      review.review_type === required
      && review.status === 'approved'
      && review.reviewed_at
      && review.content_sha256 === version.content_sha256
      && review.presentation_sha256 === version.presentation_sha256);
    if (!valid) throw new Error(`Aprovação ${required} válida não encontrada para a versão exata`);
  }
  return true;
}

export function assertReleaseApprovals(record: any) {
  const { publication, version, article } = record || {};
  if (!publication) throw new Error('Publicação ausente');
  if (!version || !article) throw new Error('Publicação sem artigo/versão correspondente');
  if (version.article_id !== publication.article_id || version.id !== publication.article_version_id) throw new Error('Publicação aponta para versão incompatível');
  if (!publication.release_sha256) throw new Error('Publicação sem release_sha256');
  return assertVersionApprovals(record, {
    contentSha256: publication.content_sha256,
    presentationSha256: publication.presentation_sha256,
  });
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Produção respondeu ${response.status} para ${url}`);
    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`Timeout ao ler ${url}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyProductionHtml(url: string, expectedHtmlSha256: string, fetcher = fetchText) {
  const html = await fetcher(url);
  const actual = sha256Text(html);
  if (actual !== expectedHtmlSha256) throw new Error(`HTML em produção não corresponde à versão esperada (${actual})`);
  return { html, htmlSha256: actual };
}

export async function establishGscBaseline(input: { expectedSitemapSha256: string; minGoogleLastSubmitted?: string }, now = new Date()) {
  if (!/^[0-9a-f]{64}$/.test(input.expectedSitemapSha256)) throw new Error('expectedSitemapSha256 inválido');
  const minSubmittedMs = input.minGoogleLastSubmitted ? new Date(input.minGoogleLastSubmitted).getTime() : null;
  if (input.minGoogleLastSubmitted && !Number.isFinite(minSubmittedMs)) throw new Error('minGoogleLastSubmitted inválido');

  const claim = await claimGscRun('baseline', `baseline:${input.expectedSitemapSha256}`);
  if (!claim.claimed) return { status: 'skipped', reason: claim.reason };
  try {
    const site = await getGscSite(GSC_SITE_URL);
    if (!['siteOwner', 'siteFullUser'].includes(site.permissionLevel || '')) {
      await finishGscRun(claim.row.operation_key, claim.leaseToken!, 'blocked', { reason: 'gsc_full_permission_required', permissionLevel: site.permissionLevel || null });
      return { status: 'blocked', reason: 'gsc_full_permission_required', permissionLevel: site.permissionLevel || null };
    }
    const sitemapXml = await fetchText(GSC_SITEMAP_URL);
    const sitemapSha256 = sha256Text(sitemapXml);
    if (sitemapSha256 !== input.expectedSitemapSha256) {
      await finishGscRun(claim.row.operation_key, claim.leaseToken!, 'blocked', { reason: 'sitemap_hash_mismatch', expected: input.expectedSitemapSha256, actual: sitemapSha256 });
      return { status: 'blocked', reason: 'sitemap_hash_mismatch', actualSitemapSha256: sitemapSha256 };
    }
    const sitemap = await getGscSitemap(GSC_SITE_URL, GSC_SITEMAP_URL);
    if (!sitemap.lastSubmitted) throw new Error('GSC não confirmou submissão prévia do sitemap; baseline não pode ser estabelecida');
    if (minSubmittedMs !== null && new Date(sitemap.lastSubmitted).getTime() < minSubmittedMs) {
      await finishGscRun(claim.row.operation_key, claim.leaseToken!, 'blocked', { reason: 'gsc_submission_older_than_expected', google_last_submitted: sitemap.lastSubmitted, min_google_last_submitted: input.minGoogleLastSubmitted });
      return { status: 'blocked', reason: 'gsc_submission_older_than_expected', googleLastSubmitted: sitemap.lastSubmitted };
    }
    const row = await upsertGscState({
      site_url: GSC_SITE_URL,
      sitemap_url: GSC_SITEMAP_URL,
      last_confirmed_sitemap_sha256: sitemapSha256,
      last_submit_attempt_sha256: sitemapSha256,
      last_submit_status: 'confirmed',
      last_submit_attempt_at: now.toISOString(),
      last_submit_confirmed_at: now.toISOString(),
      last_google_submitted_at: sitemap.lastSubmitted,
      last_error_code: null,
      last_error_at: null,
    });
    await finishGscRun(claim.row.operation_key, claim.leaseToken!, 'succeeded', { sitemap_sha256: sitemapSha256, google_last_submitted: sitemap.lastSubmitted });
    await syncPublishedUrls();
    return { status: 'confirmed', state: row };
  } catch (error) {
    await finishGscRun(claim.row.operation_key, claim.leaseToken!, 'failed', { error: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

const sitemapDependencies = { getGscSitemap, upsertGscState, claimGscRun, finishGscRun, submitGscSitemap };

async function reconcileUncertainSitemap(state: any, currentSha256: string, deps = sitemapDependencies) {
  if (state?.last_submit_status !== 'uncertain' || state?.last_submit_attempt_sha256 !== currentSha256 || !state?.last_submit_attempt_at) return false;
  const sitemap = await deps.getGscSitemap(GSC_SITE_URL, GSC_SITEMAP_URL);
  if (!sitemap.lastSubmitted) return false;
  if (new Date(sitemap.lastSubmitted).getTime() < new Date(state.last_submit_attempt_at).getTime() - 120_000) return false;
  await deps.upsertGscState({
    ...state,
    site_url: GSC_SITE_URL,
    sitemap_url: GSC_SITEMAP_URL,
    last_confirmed_sitemap_sha256: currentSha256,
    last_submit_status: 'confirmed',
    last_submit_confirmed_at: new Date().toISOString(),
    last_google_submitted_at: sitemap.lastSubmitted,
    last_error_code: null,
    last_error_at: null,
  });
  return true;
}

export function sitemapOperationKey(state: any, currentSha256: string) {
  return `sitemap:${sha256Text(JSON.stringify([state.last_confirmed_sitemap_sha256, state.last_submit_confirmed_at, currentSha256]))}`;
}

export async function ensureSitemapCurrent(state: any, currentSha256: string, now: Date, deps = sitemapDependencies) {
  const { upsertGscState, claimGscRun, finishGscRun, submitGscSitemap, getGscSitemap } = deps;
  if (!state) return { status: 'baseline_required' };
  if (state.last_confirmed_sitemap_sha256 === currentSha256) {
    await upsertGscState({ ...state, last_submit_status: 'unchanged' });
    return { status: 'unchanged' };
  }
  if (await reconcileUncertainSitemap(state, currentSha256, deps)) return { status: 'reconciled' };
  if (!sitemapNeedsSubmit(state.last_confirmed_sitemap_sha256, currentSha256)) return { status: 'baseline_required' };

  const operationKey = sitemapOperationKey(state, currentSha256);
  const claim = await claimGscRun('sitemap_submit', operationKey, { maxAttempts: 2 });
  if (!claim.claimed) return { status: claim.reason || 'skipped' };

  await upsertGscState({
    ...state,
    site_url: GSC_SITE_URL,
    sitemap_url: GSC_SITEMAP_URL,
    last_submit_attempt_sha256: currentSha256,
    last_submit_attempt_at: now.toISOString(),
    last_submit_status: 'uncertain',
  });

  try {
    await submitGscSitemap(GSC_SITE_URL, GSC_SITEMAP_URL);
    let readback;
    try {
      readback = await getGscSitemap(GSC_SITE_URL, GSC_SITEMAP_URL);
    } catch (error) {
      await upsertGscState({ ...state, site_url: GSC_SITE_URL, sitemap_url: GSC_SITEMAP_URL, last_submit_attempt_sha256: currentSha256, last_submit_status: 'uncertain', last_submit_attempt_at: now.toISOString(), last_error_code: 'gsc_submit_readback_failed', last_error_at: now.toISOString() });
      await finishGscRun(operationKey, claim.leaseToken!, 'uncertain', { reason: 'submit_succeeded_readback_failed' });
      return { status: 'uncertain' };
    }
    const readbackTimestamp = readback.lastSubmitted ? new Date(readback.lastSubmitted).getTime() : 0;
    if (!readback.lastSubmitted || readbackTimestamp < now.getTime() - 120_000) {
      await upsertGscState({ ...state, site_url: GSC_SITE_URL, sitemap_url: GSC_SITEMAP_URL, last_submit_attempt_sha256: currentSha256, last_submit_status: 'uncertain', last_submit_attempt_at: now.toISOString(), last_error_code: 'gsc_submit_unconfirmed', last_error_at: now.toISOString() });
      await finishGscRun(operationKey, claim.leaseToken!, 'uncertain', { reason: 'readback_not_new_enough' });
      return { status: 'uncertain' };
    }
    await upsertGscState({
      ...state,
      site_url: GSC_SITE_URL,
      sitemap_url: GSC_SITEMAP_URL,
      last_confirmed_sitemap_sha256: currentSha256,
      last_submit_attempt_sha256: currentSha256,
      last_submit_status: 'confirmed',
      last_submit_attempt_at: now.toISOString(),
      last_submit_confirmed_at: now.toISOString(),
      last_google_submitted_at: readback.lastSubmitted,
      last_error_code: null,
      last_error_at: null,
    });
    await finishGscRun(operationKey, claim.leaseToken!, 'succeeded', { google_last_submitted: readback.lastSubmitted });
    return { status: 'confirmed' };
  } catch (error) {
    const gsc = error instanceof GoogleSearchConsoleError ? error : null;
    if (gsc?.uncertain) {
      await upsertGscState({ ...state, site_url: GSC_SITE_URL, sitemap_url: GSC_SITEMAP_URL, last_submit_attempt_sha256: currentSha256, last_submit_status: 'uncertain', last_submit_attempt_at: now.toISOString(), last_error_code: gsc.code, last_error_at: now.toISOString() });
      await finishGscRun(operationKey, claim.leaseToken!, 'uncertain', { code: gsc.code });
      return { status: 'uncertain' };
    }
    if (gsc?.transient) {
      await upsertGscState({ ...state, site_url: GSC_SITE_URL, sitemap_url: GSC_SITEMAP_URL, last_submit_attempt_sha256: currentSha256, last_submit_status: 'failed_transient', last_submit_attempt_at: now.toISOString(), last_error_code: gsc.code, last_error_at: now.toISOString() });
      await finishGscRun(operationKey, claim.leaseToken!, 'failed', { code: gsc.code }, 6);
      return { status: 'failed_transient' };
    }
    await upsertGscState({ ...state, site_url: GSC_SITE_URL, sitemap_url: GSC_SITEMAP_URL, last_submit_attempt_sha256: currentSha256, last_submit_status: 'blocked', last_submit_attempt_at: now.toISOString(), last_error_code: gsc?.code || 'gsc_submit_failed', last_error_at: now.toISOString() });
    await finishGscRun(operationKey, claim.leaseToken!, 'blocked', { code: gsc?.code || 'gsc_submit_failed' });
    return { status: 'blocked' };
  }
}

export function validateReleasePreparation(record: any, input: {
  canonicalUrl: string;
  operationKey: string;
  contentSha256: string;
  presentationSha256: string;
  releaseSha256: string;
  htmlSha256: string;
}) {
  for (const [label, value] of Object.entries({
    contentSha256: input.contentSha256,
    presentationSha256: input.presentationSha256,
    releaseSha256: input.releaseSha256,
    htmlSha256: input.htmlSha256,
  })) {
    if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} inválido`);
  }
  assertVersionApprovals(record, { contentSha256: input.contentSha256, presentationSha256: input.presentationSha256 });
  const { version, article } = record;
  const expectedOperationKey = `publish:${article.id}:v${version.version_number}:${input.releaseSha256}`;
  if (input.operationKey !== expectedOperationKey) throw new Error('operationKey não corresponde à versão/hash aprovados');
  const canonical = new URL(input.canonicalUrl);
  if (canonical.origin !== BLOG_ORIGIN || canonical.pathname !== `/blog/${article.target_slug}/` || canonical.search || canonical.hash) {
    throw new Error('canonicalUrl não corresponde ao artigo aprovado');
  }
  return true;
}

export async function preparePublicationRelease(input: {
  articleVersionId: string;
  canonicalUrl: string;
  operationKey: string;
  contentSha256: string;
  presentationSha256: string;
  releaseSha256: string;
  htmlSha256: string;
}) {
  const record = await getEditorialVersionRecord(input.articleVersionId);
  if (!record) throw new Error('Versão editorial não encontrada');
  validateReleasePreparation(record, input);
  const stored = await recordPreparedRelease({
    articleId: record.article.id,
    articleVersionId: record.version.id,
    operationKey: input.operationKey,
    url: input.canonicalUrl,
    contentSha256: input.contentSha256,
    presentationSha256: input.presentationSha256,
    releaseSha256: input.releaseSha256,
    htmlSha256: input.htmlSha256,
  });
  return { status: stored.created ? 'prepared' : 'already_prepared', operationKey: input.operationKey, url: input.canonicalUrl };
}

export async function confirmPublicationInProduction(input: { operationKey: string }) {
  if (!input.operationKey || input.operationKey.length > 300) throw new Error('operationKey inválido');
  const record = await getPreparedRelease(input.operationKey);
  if (!record) throw new Error('Release preparado não encontrado');
  const { prepared, version, article } = record;
  const htmlSha256 = String(prepared.details_json?.html_sha256 || '');
  validateReleasePreparation(record, {
    canonicalUrl: prepared.url,
    operationKey: prepared.operation_key,
    contentSha256: prepared.content_sha256,
    presentationSha256: prepared.presentation_sha256,
    releaseSha256: prepared.release_sha256,
    htmlSha256,
  });
  const url = prepared.url;
  const verified = await verifyProductionHtml(url, htmlSha256);
  const sitemapXml = await fetchText(GSC_SITEMAP_URL);
  if (!extractSitemapLocs(sitemapXml).includes(url)) throw new Error('URL publicada ainda não aparece no sitemap de produção');
  const publication = await markPublicationVerified({
    articleId: article.id,
    articleVersionId: version.id,
    operationKey: prepared.operation_key,
    url,
    contentSha256: version.content_sha256,
    presentationSha256: version.presentation_sha256,
    releaseSha256: prepared.release_sha256,
    htmlSha256: verified.htmlSha256,
    verification: { canonical_url: url, sitemap_present: true, prepared_operation_key: prepared.operation_key },
  });
  return { status: 'verified', publicationId: publication.publicationId, operationKey: prepared.operation_key, url, htmlSha256: verified.htmlSha256 };
}

export async function runBlogGscCycle(now = new Date()) {
  const operationKey = `daily:${now.toISOString().slice(0, 10)}`;
  const claim = await claimGscRun('daily', operationKey, { maxAttempts: 2 });
  if (!claim.claimed) return { status: 'skipped', reason: claim.reason };

  try {
    const site = await getGscSite(GSC_SITE_URL);
    if (!['siteOwner', 'siteFullUser'].includes(site.permissionLevel || '')) {
      await finishGscRun(operationKey, claim.leaseToken!, 'blocked', { reason: 'gsc_full_permission_required', permissionLevel: site.permissionLevel || null });
      return { status: 'blocked', reason: 'gsc_full_permission_required' };
    }

    const tracked = await syncPublishedUrls();
    const sitemapXml = await fetchText(GSC_SITEMAP_URL);
    const sitemapSha256 = sha256Text(sitemapXml);
    const state = await getGscState(GSC_SITE_URL);
    const sitemap = await ensureSitemapCurrent(state, sitemapSha256, now);

    const due = await listDueGscUrls(now, getInspectionLimit());
    const inspectionResults = await Promise.all(due.map(async (row) => {
      try {
        const payload = await inspectGscUrl(GSC_SITE_URL, row.url);
        const classified = classifyInspection(payload, row.publication_confirmed_at, now);
        await saveGscInspection(row.publication_id, {
          ...classified,
          last_inspected_at: now.toISOString(),
          inspection_count: Number(row.inspection_count || 0) + 1,
          last_error_code: null,
          last_error_at: null,
        });
        return true;
      } catch (error) {
        await saveGscInspection(row.publication_id, {
          last_inspected_at: now.toISOString(),
          next_inspection_at: addDays(now, 1).toISOString(),
          last_error_code: error instanceof GoogleSearchConsoleError ? error.code : 'gsc_inspection_failed',
          last_error_at: now.toISOString(),
          action_state: 'inconclusive',
          action_reason: 'inspection_failed',
        });
        return false;
      }
    }));
    const inspected = inspectionResults.filter(Boolean).length;
    const inspectionErrors = inspectionResults.length - inspected;

    const details = { tracked, sitemap: sitemap.status, inspected, inspection_errors: inspectionErrors, inspection_limit: getInspectionLimit() };
    await finishGscRun(operationKey, claim.leaseToken!, 'succeeded', details);
    return { status: 'succeeded', ...details };
  } catch (error) {
    await finishGscRun(operationKey, claim.leaseToken!, 'failed', { error: error instanceof Error ? error.message : 'unknown' }, 6);
    throw error;
  }
}

export async function readBlogGscReport() {
  return getGscReport(GSC_SITE_URL);
}

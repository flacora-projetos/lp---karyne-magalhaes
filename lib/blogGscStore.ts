import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'blocked' | 'uncertain' | 'skipped';
const STATE_TABLE = 'editorial_gsc_state';
const URLS_TABLE = 'editorial_gsc_urls';
const RUNS_TABLE = 'editorial_gsc_runs';

function db() { return getSupabaseAdmin(); }

export function canRecoverGscRun(row: any, now = new Date(), maxAttempts = 2) {
  if (!row) return false;
  if (['succeeded', 'blocked', 'uncertain', 'skipped'].includes(row.status)) return false;
  if (Number(row.attempts || 0) >= maxAttempts) return false;
  if (!row.lease_until) return true;
  return new Date(row.lease_until).getTime() <= now.getTime();
}

export async function claimGscRun(
  runKind: 'daily' | 'sitemap_submit' | 'baseline',
  operationKey: string,
  options: { now?: Date; leaseMinutes?: number; maxAttempts?: number } = {},
) {
  const now = options.now ?? new Date();
  const leaseMinutes = options.leaseMinutes ?? 10;
  const maxAttempts = options.maxAttempts ?? 2;
  const leaseToken = crypto.randomUUID();
  const leaseUntil = new Date(now.getTime() + leaseMinutes * 60_000).toISOString();
  const fresh = {
    operation_key: operationKey,
    run_kind: runKind,
    status: 'running',
    lease_token: leaseToken,
    lease_until: leaseUntil,
    attempts: 1,
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const inserted = await db().from(RUNS_TABLE).insert(fresh).select('*').maybeSingle();
  if (!inserted.error && inserted.data) return { claimed: true, row: inserted.data, leaseToken };
  if (inserted.error?.code !== '23505') {
    throw new Error(`Falha ao reservar execução GSC: ${inserted.error?.message || 'erro desconhecido'}`);
  }

  const current = await db().from(RUNS_TABLE).select('*').eq('operation_key', operationKey).maybeSingle();
  if (current.error) throw new Error(`Falha ao reconciliar execução GSC: ${current.error.message}`);
  if (!current.data || !canRecoverGscRun(current.data, now, maxAttempts)) {
    return { claimed: false, reason: current.data?.status || 'missing_after_conflict', row: current.data ?? null };
  }

  let recovery = db()
    .from(RUNS_TABLE)
    .update({
      status: 'running',
      lease_token: leaseToken,
      lease_until: leaseUntil,
      attempts: Number(current.data.attempts || 0) + 1,
      started_at: now.toISOString(),
      finished_at: null,
      updated_at: now.toISOString(),
    })
    .eq('operation_key', operationKey)
    .eq('lease_token', current.data.lease_token);
  if (current.data.lease_until) recovery = recovery.lte('lease_until', now.toISOString());
  const recovered = await recovery.select('*').maybeSingle();
  if (recovered.error) throw new Error(`Falha ao recuperar execução GSC: ${recovered.error.message}`);
  return recovered.data
    ? { claimed: true, row: recovered.data, leaseToken }
    : { claimed: false, reason: 'lost_recovery_race', row: current.data };
}

export async function finishGscRun(
  operationKey: string,
  leaseToken: string,
  status: RunStatus,
  details: Record<string, unknown> = {},
  retryDelayHours = 0,
) {
  const now = new Date();
  const leaseUntil = retryDelayHours > 0
    ? new Date(now.getTime() + retryDelayHours * 3_600_000).toISOString()
    : now.toISOString();
  const result = await db()
    .from(RUNS_TABLE)
    .update({ status, details_json: details, finished_at: now.toISOString(), lease_until: leaseUntil, updated_at: now.toISOString() })
    .eq('operation_key', operationKey)
    .eq('lease_token', leaseToken)
    .select('operation_key')
    .maybeSingle();
  if (result.error) throw new Error(`Falha ao finalizar execução GSC: ${result.error.message}`);
  if (!result.data) throw new Error('Lease GSC perdida antes da finalização');
}

export async function getGscState(siteUrl: string) {
  const result = await db().from(STATE_TABLE).select('*').eq('site_url', siteUrl).maybeSingle();
  if (result.error) throw new Error(`Falha ao ler estado GSC: ${result.error.message}`);
  return result.data;
}

export async function upsertGscState(row: Record<string, unknown>) {
  const result = await db().from(STATE_TABLE).upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: 'site_url' },
  ).select('*').single();
  if (result.error) throw new Error(`Falha ao persistir estado GSC: ${result.error.message}`);
  return result.data;
}

export async function syncPublishedUrls() {
  const publications = await db()
    .from('editorial_publications')
    .select('id,article_id,article_version_id,url,canonical_url,published_at,last_verified_at,publication_status')
    .eq('publication_status', 'published')
    .not('last_verified_at', 'is', null);
  if (publications.error) throw new Error(`Falha ao listar publicações: ${publications.error.message}`);

  for (const publication of publications.data || []) {
    const result = await db().rpc('editorial_sync_gsc_url', { p_publication_id: publication.id });
    if (result.error) throw new Error(`Falha ao sincronizar URL publicada: ${result.error.message}`);
  }
  return publications.data?.length || 0;
}

export async function listDueGscUrls(now: Date, limit: number) {
  const result = await db()
    .from(URLS_TABLE)
    .select('*')
    .lte('next_inspection_at', now.toISOString())
    .order('next_inspection_at', { ascending: true })
    .limit(limit);
  if (result.error) throw new Error(`Falha ao listar URLs para inspeção: ${result.error.message}`);
  return result.data || [];
}

export async function saveGscInspection(publicationId: string, patch: Record<string, unknown>) {
  const result = await db()
    .from(URLS_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('publication_id', publicationId)
    .select('publication_id')
    .maybeSingle();
  if (result.error) throw new Error(`Falha ao persistir inspeção GSC: ${result.error.message}`);
  if (!result.data) throw new Error('URL rastreada desapareceu durante a atualização');
}

export async function getEditorialVersionRecord(articleVersionId: string) {
  const version = await db()
    .from('editorial_versions')
    .select('id,article_id,version_number,content_sha256,presentation_sha256')
    .eq('id', articleVersionId)
    .maybeSingle();
  if (version.error) throw new Error(`Falha ao ler versão editorial: ${version.error.message}`);
  if (!version.data) return null;

  const reviews = await db()
    .from('editorial_reviews')
    .select('review_type,status,content_sha256,presentation_sha256,reviewed_at')
    .eq('article_version_id', articleVersionId);
  if (reviews.error) throw new Error(`Falha ao ler aprovações: ${reviews.error.message}`);

  const article = await db()
    .from('editorial_articles')
    .select('id,target_slug,working_title,status')
    .eq('id', version.data.article_id)
    .maybeSingle();
  if (article.error) throw new Error(`Falha ao ler artigo: ${article.error.message}`);
  if (!article.data) return null;
  return { version: version.data, reviews: reviews.data || [], article: article.data };
}

function preparedEventMatches(row: any, input: {
  articleId: string;
  articleVersionId: string;
  operationKey: string;
  url: string;
  contentSha256: string;
  presentationSha256: string;
  releaseSha256: string;
  htmlSha256: string;
}) {
  return row
    && row.event_type === 'prepared'
    && row.article_id === input.articleId
    && row.article_version_id === input.articleVersionId
    && row.operation_key === input.operationKey
    && row.url === input.url
    && row.content_sha256 === input.contentSha256
    && row.presentation_sha256 === input.presentationSha256
    && row.release_sha256 === input.releaseSha256
    && row.details_json?.html_sha256 === input.htmlSha256;
}

export async function recordPreparedRelease(input: {
  articleId: string;
  articleVersionId: string;
  operationKey: string;
  url: string;
  contentSha256: string;
  presentationSha256: string;
  releaseSha256: string;
  htmlSha256: string;
}) {
  const existing = await db().from('editorial_publication_events').select('*').eq('operation_key', input.operationKey).maybeSingle();
  if (existing.error) throw new Error(`Falha ao procurar preparo existente: ${existing.error.message}`);
  if (existing.data) {
    if (!preparedEventMatches(existing.data, input)) throw new Error('operation_key já existe com outro conteúdo');
    return { event: existing.data, created: false };
  }

  const inserted = await db().from('editorial_publication_events').insert({
    article_id: input.articleId,
    article_version_id: input.articleVersionId,
    event_type: 'prepared',
    operation_key: input.operationKey,
    url: input.url,
    content_sha256: input.contentSha256,
    presentation_sha256: input.presentationSha256,
    release_sha256: input.releaseSha256,
    details_json: { html_sha256: input.htmlSha256, prepared_at: new Date().toISOString() },
  }).select('*').maybeSingle();
  if (!inserted.error && inserted.data) return { event: inserted.data, created: true };
  if (inserted.error?.code !== '23505') throw new Error(`Falha ao registrar preparo: ${inserted.error?.message || 'erro desconhecido'}`);

  const raced = await db().from('editorial_publication_events').select('*').eq('operation_key', input.operationKey).maybeSingle();
  if (raced.error) throw new Error(`Falha ao reconciliar preparo concorrente: ${raced.error.message}`);
  if (!preparedEventMatches(raced.data, input)) throw new Error('Conflito concorrente no preparo da publicação');
  return { event: raced.data, created: false };
}

export async function getPreparedRelease(operationKey: string) {
  const prepared = await db()
    .from('editorial_publication_events')
    .select('*')
    .eq('operation_key', operationKey)
    .eq('event_type', 'prepared')
    .maybeSingle();
  if (prepared.error) throw new Error(`Falha ao ler release preparado: ${prepared.error.message}`);
  if (!prepared.data) return null;
  const record = await getEditorialVersionRecord(prepared.data.article_version_id);
  if (!record) throw new Error('Release preparado aponta para versão inexistente');
  return { prepared: prepared.data, ...record };
}

export async function markPublicationVerified(input: {
  articleId: string;
  articleVersionId: string;
  operationKey: string;
  url: string;
  contentSha256: string;
  presentationSha256: string;
  releaseSha256: string;
  htmlSha256: string;
  verification: Record<string, unknown>;
}) {
  const result = await db().rpc('editorial_confirm_gsc_publication', { p_input: input });
  if (result.error) throw new Error(`Falha ao confirmar publicação: ${result.error.message}`);
  return { publicationId: result.data as string };
}

export async function getGscReport(siteUrl: string) {
  const [state, urls, runs] = await Promise.all([
    getGscState(siteUrl),
    db().from(URLS_TABLE).select('*').order('publication_confirmed_at', { ascending: false }),
    db().from(RUNS_TABLE).select('operation_key,run_kind,status,attempts,started_at,finished_at,details_json,updated_at').order('updated_at', { ascending: false }).limit(20),
  ]);
  if (urls.error) throw new Error(`Falha ao montar relatório de URLs: ${urls.error.message}`);
  if (runs.error) throw new Error(`Falha ao montar relatório de execuções: ${runs.error.message}`);

  const articleIds = [...new Set((urls.data || []).map((row: any) => row.article_id).filter(Boolean))];
  let articles: any[] = [];
  if (articleIds.length) {
    const articleResult = await db().from('editorial_articles').select('id,working_title,target_slug,status').in('id', articleIds);
    if (articleResult.error) throw new Error(`Falha ao montar relatório de artigos: ${articleResult.error.message}`);
    articles = articleResult.data || [];
  }
  const byArticle = new Map(articles.map((article: any) => [article.id, article]));
  const enrichedUrls = (urls.data || []).map((row: any) => {
    const article = byArticle.get(row.article_id);
    return {
      ...row,
      article_title: article?.working_title || null,
      article_slug: article?.target_slug || null,
      article_status: article?.status || null,
    };
  });
  return { state, urls: enrichedUrls, runs: runs.data || [] };
}

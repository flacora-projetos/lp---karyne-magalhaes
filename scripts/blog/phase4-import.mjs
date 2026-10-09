import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPrivateOutput} from './private-output.mjs';

const SOURCE_SYSTEM = 'wordpress_karyne';
const SNAPSHOT_RUN_ID = '2026-10-08T17-03-22-763Z';
const DEFAULT_SNAPSHOT = path.resolve(process.cwd(), '../docs/blog-organico/etapa-1/acervo/normalizado/current/articles.ndjson');
const DEFAULT_EXISTING = path.resolve(process.cwd(), '../docs/blog-organico/etapa-4/evidencias/editorial-sources-remoto.json');

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {snapshot:DEFAULT_SNAPSHOT, existing:DEFAULT_EXISTING, output:''};
  for (const raw of argv) {
    if (raw.startsWith('--snapshot=')) args.snapshot = path.resolve(process.cwd(), raw.slice(11));
    else if (raw.startsWith('--existing=')) args.existing = path.resolve(process.cwd(), raw.slice(11));
    else if (raw.startsWith('--output=')) args.output = path.resolve(process.cwd(), raw.slice(9));
    else if (raw === '--apply') args.apply = true;
    else if (raw.startsWith('--confirm=')) args.confirm = raw.slice(10);
    else if (raw.startsWith('--plan-hash=')) args.planHash = raw.slice(12);
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  return args;
}

export function readNdjson(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${filePath}:${index + 1}: JSON inválido: ${error.message}`); }
  });
}

export function desiredSource(row, snapshotRunId = SNAPSHOT_RUN_ID) {
  const externalId = String(row.sourceId ?? '').trim();
  if (!externalId) throw new Error('Fonte sem sourceId');
  if (!row.sourceUrl || !row.title || !row.rawSha256) throw new Error(`Fonte ${externalId} incompleta`);
  return {
    source_system: SOURCE_SYSTEM,
    external_id: externalId,
    source_url: row.sourceUrl,
    source_slug: row.slug || null,
    source_title: row.title,
    normalized_excerpt: row.excerpt || null,
    normalized_body_text: row.contentText ?? '',
    published_at_source: row.publishedAt || null,
    modified_at_source: row.modifiedAt || null,
    raw_sha256: row.rawSha256,
    snapshot_run_id: snapshotRunId,
    normalized_payload_json: {
      source: row.source,
      status: row.status,
      author: row.author ?? null,
      categories: row.categories ?? [],
      tagIds: row.tagIds ?? [],
      featuredMedia: row.featuredMedia ?? null,
      mediaUrls: row.mediaUrls ?? [],
    },
    metadata_json: {
      imported_from_snapshot: snapshotRunId,
      legacy_preserved: true,
      original_title: row.title,
    },
  };
}

function existingKey(row) {
  return `${row.source_system}:${String(row.external_id)}`;
}

function stableSourceHash(source) {
  return sha256(source);
}

export function buildImportPlan(rows, existingRows = []) {
  const seen = new Set();
  const existing = new Map(existingRows.map(row => [existingKey(row), row]));
  const operations = rows.map(row => {
    const desired = desiredSource(row);
    const key = existingKey(desired);
    if (seen.has(key)) throw new Error(`Fonte duplicada no snapshot: ${key}`);
    seen.add(key);
    const before = existing.get(key) || null;
    return {
      key,
      action: before ? 'enrich' : 'insert',
      existing_id: before?.id || null,
      operation_key: `source:${key}:${stableSourceHash(desired)}`,
      desired,
    };
  });
  const inserts = operations.filter(item => item.action === 'insert').length;
  const enrichments = operations.filter(item => item.action === 'enrich').length;
  const stable = {schemaVersion:2, snapshotRunId:SNAPSHOT_RUN_ID, sourceSystem:SOURCE_SYSTEM, count:operations.length, inserts, enrichments, operations};
  return {...stable, plan_sha256:sha256(stable)};
}

export function mergeMetadata(before = {}, desired = {}) {
  return {...before, ...desired};
}

async function applyPlan(plan, confirm, planHash) {
  if (confirm !== `IMPORT_${plan.count}_SOURCES`) throw new Error(`Aplicação bloqueada. Use --confirm=IMPORT_${plan.count}_SOURCES somente após aprovação da Fase 4 e aplicação da migration.`);
  if (planHash !== plan.plan_sha256) throw new Error('Hash do plano aprovado não corresponde ao acervo atual.');
  const {createClient} = await import('@supabase/supabase-js');
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para --apply.');
  const supabase = createClient(url, key, {auth:{persistSession:false}});
  for (const op of plan.operations) {
    const desired = op.desired;
    let metadata = desired.metadata_json;
    {
      const {data, error} = await supabase.from('editorial_sources').select('metadata_json').eq('source_system', desired.source_system).eq('external_id', desired.external_id).maybeSingle();
      if (error) throw error;
      metadata = mergeMetadata(data?.metadata_json || {}, desired.metadata_json);
    }
    const {error} = await supabase.from('editorial_sources').upsert({...desired, metadata_json:metadata}, {onConflict:'source_system,external_id'});
    if (error) throw error;
  }
  return {applied:true, count:plan.count, plan_sha256:plan.plan_sha256};
}

async function main() {
  const args = parseArgs();
  if (args.output) assertPrivateOutput(args.output);
  const rows = readNdjson(args.snapshot);
  const existingRows = fs.existsSync(args.existing) ? JSON.parse(fs.readFileSync(args.existing, 'utf8')) : [];
  const plan = buildImportPlan(rows, existingRows);
  const result = args.apply ? await applyPlan(plan, args.confirm, args.planHash) : {mode:'dry-run', ...plan};
  const text = JSON.stringify(result, null, 2) + '\n';
  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), {recursive:true});
    fs.writeFileSync(args.output, text, 'utf8');
  }
  console.log(JSON.stringify({mode:args.apply ? 'apply' : 'dry-run', count:plan.count, inserts:plan.inserts, enrichments:plan.enrichments, plan_sha256:plan.plan_sha256, output:args.output || null}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

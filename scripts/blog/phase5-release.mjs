import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProductionEligible, readArticles } from './core.mjs';
import { buildReleaseManifest } from './phase4-release.mjs';
import { assertPrivateOutput } from './private-output.mjs';
import { isPresentationReady } from './editorial.mjs';
import { buildSnapshotRelease } from './phase6-release.mjs';

export function selectReleaseArticles(articles, slugs) {
  const requested = [...new Set((slugs || []).filter(Boolean))];
  if (!requested.length) throw new Error('Fase 5 exige ao menos um --slug explícito; publicação em lote implícita é bloqueada.');
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const missing = requested.filter((slug) => !bySlug.has(slug));
  if (missing.length) throw new Error(`Slug não encontrado no acervo de entrada: ${missing.join(', ')}`);
  return requested.map((slug) => bySlug.get(slug));
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { input: path.resolve(process.cwd(), 'content/blog/published'), output: '', slugs: [], snapshot: '' };
  for (const raw of argv) {
    if (raw.startsWith('--input=')) args.input = path.resolve(process.cwd(), raw.slice(8));
    else if (raw.startsWith('--output=')) args.output = path.resolve(process.cwd(), raw.slice(9));
    else if (raw.startsWith('--slug=')) args.slugs.push(raw.slice(7).trim());
    else if (raw.startsWith('--snapshot=')) args.snapshot = path.resolve(process.cwd(), raw.slice(11));
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!args.output) throw new Error('--output é obrigatório e deve apontar para diretório privado fora do repo.');
  assertPrivateOutput(args.output);
  const articles = readArticles(args.input);
  for (const article of articles) {
    if (!isProductionEligible(article)) throw new Error(`Contexto da fase 5 contém artigo sem aprovação válida: ${article.slug}`);
    if (!isPresentationReady(article)) throw new Error(`Contexto da fase 5 contém apresentação não revisada: ${article.slug}`);
  }
  let manifest;
  if (args.snapshot) {
    assertPrivateOutput(args.snapshot);
    const snapshot = JSON.parse(fs.readFileSync(args.snapshot, 'utf8'));
    const slug = snapshot?.article?.slug;
    if (!slug || args.slugs.length !== 1 || args.slugs[0] !== slug) throw new Error('Snapshot exige exatamente um --slug explícito igual ao artigo aprovado.');
    manifest = buildSnapshotRelease(snapshot, articles).manifest;
  } else {
    const selected = selectReleaseArticles(articles, args.slugs);
    manifest = buildReleaseManifest(selected, articles);
  }
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify({ ...manifest, mode: 'prepared-local-only', selected_slugs: args.slugs }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    mode: 'prepared-local-only',
    count: manifest.count,
    selected_slugs: args.slugs,
    manifest_sha256: manifest.manifest_sha256,
    operation_keys: manifest.releases.map((item) => item.operation_key),
    output: args.output,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}

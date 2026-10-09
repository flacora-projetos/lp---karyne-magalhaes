import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPrivateOutput} from './private-output.mjs';
import {contentFingerprint, isProductionEligible, presentationFingerprint, readArticles, releaseFingerprint, renderArticle, SITE_URL} from './core.mjs';
import {isPresentationReady, presentationContract} from './editorial.mjs';

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {input:path.resolve(process.cwd(), 'content/blog/published'), output:''};
  for (const raw of argv) {
    if (raw.startsWith('--input=')) args.input = path.resolve(process.cwd(), raw.slice(8));
    else if (raw.startsWith('--output=')) args.output = path.resolve(process.cwd(), raw.slice(9));
    else if (raw === '--prepare') args.prepare = true;
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  return args;
}

function safeOutput(filePath) {
  const published = path.resolve(process.cwd(), 'content/blog/published');
  const dist = path.resolve(process.cwd(), 'dist');
  const resolved = path.resolve(filePath);
  if (resolved === published || resolved.startsWith(`${published}${path.sep}`)) return false;
  if (resolved === dist || resolved.startsWith(`${dist}${path.sep}`)) return false;
  return true;
}

export function publicPayload(article) {
  if (!isProductionEligible(article)) throw new Error(`Versão sem aprovação clínica/editorial exata: ${article.slug}`);
  if (!isPresentationReady(article)) throw new Error(`Apresentação não revisada: ${article.slug}`);
  const contentHash = contentFingerprint(article);
  const presentationHash = presentationFingerprint(article);
  const releaseHash = releaseFingerprint(article);
  return {
    schemaVersion:1,
    id:article.id,
    sourceId:article.sourceId || null,
    version:article.version,
    slug:article.slug,
    title:article.title,
    description:article.description,
    status:article.status,
    body:article.body,
    ctaLabel:article.ctaLabel || null,
    internalLinks:article.internalLinks || [],
    references:article.references || [],
    author:article.author,
    datePublished:article.datePublished,
    dateModified:article.dateModified || article.datePublished,
    presentation:presentationContract(article),
    approval:{
      version:article.approval.version,
      editorial:true,
      clinical:true,
      contentHash,
      presentationHash,
      releaseHash,
    },
  };
}

export function buildReleaseManifest(articles, renderArticles = articles) {
  const availableSlugs = new Set(renderArticles.map(article => article.slug));
  const releases = articles.map(article => {
    const payload = publicPayload(article);
    const releaseHash = payload.approval.releaseHash;
    const relatedArticles = (article.internalLinks || []).filter(link => link.slug).map(link => renderArticles.find(candidate => candidate.slug === link.slug)).filter(Boolean);
    const html = renderArticle(article, {preview:false, availableSlugs, relatedArticles});
    const canonical = `${SITE_URL}/blog/${article.slug}/`;
    return {
      slug:article.slug,
      version:article.version,
      canonical,
      operation_key:`publish:${article.id}:v${article.version}:${releaseHash}`,
      content_sha256:payload.approval.contentHash,
      presentation_sha256:payload.approval.presentationHash,
      release_sha256:releaseHash,
      payload_sha256:sha256(payload),
      html_sha256:sha256(html),
      payload,
      html,
    };
  });
  const stable = {schemaVersion:1, mode:'simulation', count:releases.length, releases};
  return {...stable, manifest_sha256:sha256(stable)};
}

async function main() {
  const args = parseArgs();
  if (args.output) assertPrivateOutput(args.output);
  const articles = readArticles(args.input);
  const manifest = buildReleaseManifest(articles);
  if (args.prepare) {
    if (!args.output) throw new Error('--prepare exige --output em diretório privado/de staging.');
    if (!safeOutput(args.output)) throw new Error('Saída de preparação não pode apontar para content/blog/published nem dist.');
    fs.mkdirSync(path.dirname(args.output), {recursive:true});
    fs.writeFileSync(args.output, JSON.stringify({...manifest, mode:'prepared-local-only'}, null, 2) + '\n', 'utf8');
  } else if (args.output) {
    if (!safeOutput(args.output)) throw new Error('Saída da simulação não pode apontar para content/blog/published nem dist.');
    fs.mkdirSync(path.dirname(args.output), {recursive:true});
    fs.writeFileSync(args.output, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({mode:args.prepare ? 'prepared-local-only' : 'simulation', count:manifest.count, manifest_sha256:manifest.manifest_sha256, operation_keys:manifest.releases.map(item => item.operation_key), output:args.output || null}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

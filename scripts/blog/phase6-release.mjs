import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPrivateOutput } from './private-output.mjs';
import { contentFingerprint, presentationFingerprint, readArticles, releaseFingerprint, renderArticle, validateArticle } from './core.mjs';
import { buildReleaseManifest } from './phase4-release.mjs';
import { isPresentationReady } from './editorial.mjs';

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function validateApprovedSnapshot(snapshot) {
  if (!snapshot || snapshot.kind !== 'karyne-blog-approved-snapshot' || snapshot.schemaVersion !== 1) throw new Error('Snapshot da Fase 6 inválido');
  const article = validateArticle(snapshot.article, 'snapshot.article');
  if (article.status !== 'approved' || article.approval?.editorial !== true || article.approval?.clinical !== true) throw new Error('Snapshot não contém versão aprovada');
  if (!isPresentationReady(article)) throw new Error('Snapshot sem apresentação revisada');
  const contentHash = contentFingerprint(article);
  const presentationHash = presentationFingerprint(article);
  const releaseHash = releaseFingerprint(article);
  if (snapshot.content_sha256 !== contentHash || article.approval.contentHash !== contentHash) throw new Error('Hash de conteúdo do snapshot divergente');
  if (snapshot.presentation_sha256 !== presentationHash || article.approval.presentationHash !== presentationHash) throw new Error('Hash de apresentação do snapshot divergente');
  if (snapshot.release_sha256 !== releaseHash || article.approval.releaseHash !== releaseHash) throw new Error('Hash de release do snapshot divergente');
  return article;
}

export function buildSnapshotRelease(snapshot, publishedArticles) {
  const selected = validateApprovedSnapshot(snapshot);
  const existingIndex = publishedArticles.findIndex(article => article.slug === selected.slug);
  const context = [...publishedArticles];
  if (existingIndex >= 0) context.splice(existingIndex, 1, selected);
  else context.push(selected);
  const manifest = buildReleaseManifest([selected], context);
  const release = manifest.releases[0];
  if (!/^[0-9a-f-]{36}$/i.test(snapshot.articleId) || !/^[0-9a-f-]{36}$/i.test(snapshot.articleVersionId)) throw new Error('Identidade editorial do snapshot inválida');
  release.operation_key=`publish:${snapshot.articleId}:v${selected.version}:${snapshot.release_sha256}`;
  manifest.manifest_sha256=sha256(JSON.stringify({schemaVersion:manifest.schemaVersion,mode:manifest.mode,count:manifest.count,releases:manifest.releases}));
  const relatedArticles = (selected.internalLinks || []).filter(link => link.slug).map(link => context.find(article => article.slug === link.slug)).filter(Boolean);
  const finalHtml = renderArticle(selected, { preview:false, availableSlugs:new Set(context.map(article=>article.slug)), relatedArticles });
  if (sha256(finalHtml) !== release.html_sha256 || finalHtml !== release.html) throw new Error('HTML do manifest não corresponde ao renderer final');
  if (release.content_sha256 !== snapshot.content_sha256 || release.presentation_sha256 !== snapshot.presentation_sha256 || release.release_sha256 !== snapshot.release_sha256) throw new Error('Manifest não corresponde ao snapshot aprovado');
  return { manifest, context, selected };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { snapshot:'', input:path.resolve(process.cwd(),'content/blog/published'), output:'' };
  for (const raw of argv) {
    if (raw.startsWith('--snapshot=')) args.snapshot=path.resolve(process.cwd(),raw.slice(11));
    else if (raw.startsWith('--input=')) args.input=path.resolve(process.cwd(),raw.slice(8));
    else if (raw.startsWith('--output=')) args.output=path.resolve(process.cwd(),raw.slice(9));
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  return args;
}

async function main() {
  const args=parseArgs();
  if(!args.snapshot || !args.output) throw new Error('--snapshot e --output são obrigatórios');
  assertPrivateOutput(args.snapshot);
  assertPrivateOutput(args.output);
  const snapshot=JSON.parse(fs.readFileSync(args.snapshot,'utf8'));
  const published=readArticles(args.input);
  const {manifest,selected}=buildSnapshotRelease(snapshot,published);
  fs.mkdirSync(path.dirname(args.output),{recursive:true});
  fs.writeFileSync(args.output,JSON.stringify({...manifest,mode:'phase6-approved-snapshot',snapshot_file:path.basename(args.snapshot)},null,2)+'\n','utf8');
  console.log(JSON.stringify({mode:'phase6-approved-snapshot',slug:selected.slug,version:selected.version,operation_key:manifest.releases[0].operation_key,manifest_sha256:manifest.manifest_sha256,output:args.output}));
}

if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))) main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertUniqueSlugs, buildSitemap, isProductionEligible, PREVIEW_DRAFT_DIR, readArticles, renderArticle, renderIndex, resetGeneratedBlogDir} from './core.mjs';

const args = new Set(process.argv.slice(2));
const preview = args.has('--preview');
const fixture = args.has('--fixture');
if (fixture && !preview) throw new Error('--fixture só pode ser usado junto com --preview');

const outDir = path.resolve(process.cwd(), 'dist');
const publicDir = path.resolve(process.cwd(), 'content/blog/published');
const fixtureDir = path.resolve(process.cwd(), 'content/blog/fixtures');

const candidates = preview ? readArticles(PREVIEW_DRAFT_DIR) : readArticles(publicDir);
if (!preview) {
  for (const article of candidates) {
    if (!isProductionEligible(article)) throw new Error(`Publicação sem aprovação válida: ${article.slug}`);
  }
}
let articles = candidates;
if (fixture) articles = [...articles, ...readArticles(fixtureDir)];
assertUniqueSlugs(articles);

const blogDir = resetGeneratedBlogDir(outDir);
if (preview) {
  const sitemapPath = path.join(outDir, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const quarantine = path.join(os.tmpdir(), `karyne-sitemap-stale-${process.pid}-${Date.now()}.xml`);
    try {
      fs.renameSync(sitemapPath, quarantine);
      try { fs.rmSync(quarantine, {force:true}); } catch { /* fora do artefato */ }
    } catch {
      fs.rmSync(sitemapPath, {force:true});
    }
  }
  if (fs.existsSync(sitemapPath)) throw new Error('Falha ao remover sitemap da prévia');
}
const availableSlugs = new Set(articles.map((a) => a.slug));
fs.writeFileSync(path.join(blogDir, 'index.html'), renderIndex(articles, {preview}), 'utf8');
for (const article of articles) {
  const dir = path.join(blogDir, article.slug);
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(article, {preview, availableSlugs}), 'utf8');
}
if (!preview) fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemap(articles), 'utf8');

const manifest = {mode: preview ? 'preview' : 'production', generatedAt: new Date().toISOString(), count: articles.length, slugs: articles.map((a) => a.slug)};
fs.writeFileSync(path.join(blogDir, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify(manifest));

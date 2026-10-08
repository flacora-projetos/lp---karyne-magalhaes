import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSitemap, isProductionEligible, readArticles, SITE_URL} from './core.mjs';
const articles = readArticles('content/blog/published');
assert.ok(articles.every(isProductionEligible), 'Há artigo sem aprovação válida');
const home = fs.readFileSync('dist/index.html','utf8');
const privacy = fs.readFileSync('dist/politica-de-privacidade/index.html','utf8');
const sitemap = fs.readFileSync('dist/sitemap.xml','utf8');
const blog = fs.readFileSync('dist/blog/index.html','utf8');
const dirs = fs.readdirSync('dist/blog',{withFileTypes:true}).filter(e => e.isDirectory()).map(e => e.name).sort();
assert.equal((home.match(/"@type":"Question"/g) || []).length, 8);
assert.ok(!home.includes('aggregateRating') && !/250 avalia/i.test(home));
assert.ok(privacy.includes('<title>Política de Privacidade | Dra. Karyne Magalhães</title>'));
assert.ok(privacy.includes('rel="canonical" href="'+SITE_URL+'/politica-de-privacidade"'));
assert.ok(privacy.includes('>Política de Privacidade</h1>'));
assert.ok(!privacy.includes('FAQPage') && !/"@type":\s*"(?:Dentist|Physician)"/.test(privacy));
assert.deepEqual(dirs, articles.map(a => a.slug).sort(), 'Build contém rascunho ou perdeu artigo');
assert.equal(sitemap, buildSitemap(articles));
assert.equal(blog.includes('noindex, follow'), articles.length === 0);
assert.ok(blog.includes('data-blog-page="index"'));
for (const article of articles) {
  const html = fs.readFileSync('dist/blog/'+article.slug+'/index.html', 'utf8');
  assert.ok(html.includes('rel="canonical" href="'+SITE_URL+'/blog/'+article.slug+'/"'));
  assert.ok(!html.includes('noindex') && html.includes('BlogPosting'));
  assert.ok(html.includes('CRO-GO 7954'));
  assert.ok(!/este rascunho|antes da publicação|antes de publicar|revisão deste texto|precisam ser confirmados/i.test(html));
}
console.log(JSON.stringify({passed:true, approvedArticles:articles.length, slugs:dirs},null,2));

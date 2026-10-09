import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {contentFingerprint, escapeHtml, isProductionEligible, readArticles, renderArticle, renderIndex, SITE_URL} from './core.mjs';

const articles = readArticles('content/blog/published');
const availableSlugs = new Set(articles.map(article => article.slug));

test('visual editorial preserva cada texto e referência aprovados e usa imagens existentes', () => {
  for (const article of articles) {
    const fingerprint = contentFingerprint(article);
    const html = renderArticle(article, {availableSlugs, relatedArticles:articles});
    for (const text of [article.title,article.description,...article.body.flatMap(block=>block.items || [block.text])].filter(Boolean)) {
      assert.ok(html.includes(escapeHtml(text)), `Texto aprovado ausente: ${article.slug}`);
    }
    for (const reference of article.references) assert.ok(html.includes(escapeHtml(reference.url)));
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) assert.ok(fs.existsSync('public'+match[1]));
    assert.equal(contentFingerprint(article), fingerprint);
    assert.equal(isProductionEligible(article), true);
    assert.ok(html.includes('← Voltar ao blog'));
    assert.ok(html.includes('<time datetime="'));
    assert.ok(!html.includes(`>Publicado em ${article.datePublished}`));
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)![1]);
    assert.ok(structured.image.startsWith(SITE_URL+'/images/'));
    assert.equal(structured.author.url, SITE_URL+'/');
    const ids = [...html.matchAll(/<h2 id="(secao-\d+)"/g)].map(match=>match[1]);
    assert.equal(ids.length,article.body.filter(block=>block.type==='h2').length);
    assert.equal(new Set(ids).size,ids.length);
    assert.ok(ids.every(id=>html.includes(`href="#${id}"`)));
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  }
});

test('índice editorial não duplica artigo em destaque nem fabrica ranking de leitura', () => {
  const html = renderIndex(articles);
  for (const article of articles) assert.equal(html.split(escapeHtml(article.title)).length-1,1);
  assert.ok(html.includes('Em destaque'));
  assert.ok(!html.includes('Mais lidos'));
  assert.ok(!html.includes('data-share='));
  assert.ok(html.includes('https://wa.me/5562999320675?text='));
});

test('prévia editorial preserva isolamento de contato, rastreamento e dados estruturados', () => {
  for (const html of [renderIndex(articles,{preview:true}),...articles.map(article=>renderArticle(article,{preview:true,availableSlugs}))]) {
    assert.ok(html.includes('noindex, nofollow'));
    assert.ok(!html.includes('href="https://wa.me/'));
    assert.ok(!html.includes('googletagmanager.com'));
    assert.ok(!html.includes('application/ld+json'));
    assert.ok(html.includes('data-blog-preview="1"'));
  }
});

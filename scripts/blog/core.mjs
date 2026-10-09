import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {articleImage, contactLink, editorialArticle, editorialIndex, editorialStyles, presentationContract} from './editorial.mjs';

export const SITE_URL = 'https://tratamentodomauhalito.com.br';
export const PREVIEW_DRAFT_DIR = path.resolve(process.cwd(), '../docs/blog-organico/etapa-2/rascunhos');

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '');
}

export function isSafeExternalUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseInternalUrl(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('/')) return null;
  try {
    const parsed = new URL(value, SITE_URL);
    if (parsed.origin !== SITE_URL || parsed.search) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedInternalUrlShape(value) {
  const parsed = parseInternalUrl(value);
  if (!parsed) return false;
  if (parsed.pathname === '/' || parsed.pathname === '/blog/' || parsed.pathname === '/politica-de-privacidade' || parsed.pathname === '/politica-de-privacidade/') return true;
  return /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(parsed.pathname);
}

export function resolveInternalUrl(value, availableSlugs = new Set()) {
  const parsed = parseInternalUrl(value);
  if (!parsed) return '';
  if (parsed.pathname === '/') return `/${parsed.hash || ''}`;
  if (parsed.pathname === '/blog/') return `/blog/${parsed.hash || ''}`;
  if (parsed.pathname === '/politica-de-privacidade' || parsed.pathname === '/politica-de-privacidade/') {
    return `/politica-de-privacidade${parsed.hash || ''}`;
  }
  const articleMatch = parsed.pathname.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (!articleMatch || !availableSlugs.has(articleMatch[1])) return '';
  return `/blog/${articleMatch[1]}/${parsed.hash || ''}`;
}

function fingerprintPayload(article) {
  return {
    id: article?.id ?? null,
    version: article?.version ?? null,
    slug: article?.slug ?? null,
    title: article?.title ?? null,
    description: article?.description ?? null,
    body: article?.body ?? null,
    ctaLabel: article?.ctaLabel ?? null,
    internalLinks: article?.internalLinks ?? null,
    references: article?.references ?? null,
    author: article?.author ?? null,
    datePublished: article?.datePublished ?? null,
    dateModified: article?.dateModified ?? null,
  };
}

export function contentFingerprint(article) {
  return crypto.createHash('sha256').update(JSON.stringify(fingerprintPayload(article))).digest('hex');
}

export function presentationFingerprint(article) {
  const contract = presentationContract(article);
  if (!contract) return '';
  return crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

export function releaseFingerprint(article) {
  const presentationHash = presentationFingerprint(article);
  if (!presentationHash) return '';
  return crypto.createHash('sha256').update(JSON.stringify({
    contentHash: contentFingerprint(article),
    presentationHash,
  })).digest('hex');
}

export function isProductionEligible(article) {
  return Boolean(
    article &&
    article.status === 'approved' &&
    article.approval?.version === article.version &&
    article.approval?.editorial === true &&
    article.approval?.clinical === true &&
    article.approval?.contentHash === contentFingerprint(article) &&
    article.author &&
    article.datePublished &&
    article.body?.length
  );
}

export function validateArticle(article, source = 'article') {
  const required = ['id', 'version', 'slug', 'title', 'description', 'body'];
  for (const key of required) {
    if (article?.[key] === undefined || article?.[key] === null || article?.[key] === '') {
      throw new Error(`${source}: campo obrigatório ausente: ${key}`);
    }
  }
  if (!isValidSlug(article.slug)) throw new Error(`${source}: slug inválido: ${article.slug}`);
  if (!Array.isArray(article.body) || article.body.length === 0) throw new Error(`${source}: body vazio`);
  if (article.presentation && !presentationContract(article)) throw new Error(`${source}: contrato de apresentação inválido ou não revisado`);
  for (const reference of article.references || []) {
    if (reference?.url && !isSafeExternalUrl(reference.url)) {
      throw new Error(`${source}: URL de referência inválida: ${reference.url}`);
    }
  }
  for (const link of article.internalLinks || []) {
    if (link?.slug && !isValidSlug(link.slug)) throw new Error(`${source}: slug de link interno inválido: ${link.slug}`);
    if (link?.url && !isAllowedInternalUrlShape(link.url)) throw new Error(`${source}: link interno fora das rotas editoriais permitidas: ${link.url}`);
  }
  return article;
}

export function readArticles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => validateArticle(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')), name));
}

export function resetGeneratedBlogDir(outDir) {
  const resolvedOut = path.resolve(outDir);
  const blogDir = path.resolve(resolvedOut, 'blog');
  if (!blogDir.startsWith(`${resolvedOut}${path.sep}`)) throw new Error('Diretório de blog fora do build');

  let quarantine = '';
  if (fs.existsSync(blogDir)) {
    quarantine = path.join(os.tmpdir(), `karyne-blog-stale-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    try {
      fs.renameSync(blogDir, quarantine);
    } catch {
      fs.rmSync(blogDir, {recursive:true, force:true});
    }
  }
  fs.mkdirSync(blogDir, {recursive:true});
  const residual = fs.readdirSync(blogDir);
  if (residual.length) throw new Error(`Falha ao limpar saída do blog: ${residual.join(', ')}`);
  if (quarantine) {
    try { fs.rmSync(quarantine, {recursive:true, force:true}); } catch { /* quarentena fica fora do artefato de build */ }
  }
  return blogDir;
}

export function renderBlocks(blocks = []) {
  return blocks.map((block) => {
    if (block.type === 'h2') return `<h2>${escapeHtml(block.text)}</h2>`;
    if (block.type === 'h3') return `<h3>${escapeHtml(block.text)}</h3>`;
    if (block.type === 'quote') return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
    if (block.type === 'ul') {
      const items = Array.isArray(block.items) ? block.items : [];
      return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    if (block.type === 'ol') {
      const items = Array.isArray(block.items) ? block.items : [];
      return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
    }
    return `<p>${escapeHtml(block.text || '')}</p>`;
  }).join('\n');
}

function trackingHead(preview) {
  if (preview) return '';
  return `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3783BP5DSB"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-3783BP5DSB',{send_page_view:false});
</script>
`;
}

function baseStyles() {
  return `<style>${editorialStyles}</style>`;
}

function blogClientTag({preview, article, pageType}) {
  const articleAttrs = article
    ? ` data-blog-article="${escapeHtml(article.id)}" data-blog-source="${escapeHtml(article.sourceId || '')}" data-blog-slug="${escapeHtml(article.slug)}"`
    : '';
  return `<script src="/blog-client.js" defer data-blog-page="${escapeHtml(pageType)}"${articleAttrs} data-blog-preview="${preview ? '1' : '0'}"></script>`;
}

function layout({title, description, canonical, body, preview = false, type = 'website', article, pageType = 'index', robotsOverride = ''}) {
  const robots = robotsOverride || (preview ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  const photo = articleImage(article);
  const imageUrl = SITE_URL + '/images/' + (photo?.file || 'karyne_og.jpg');
  const structured = article && !preview && article.author && article.datePublished ? '<script type="application/ld+json">' + JSON.stringify({
    '@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description:article.description,
    mainEntityOfPage:canonical,datePublished:article.datePublished,dateModified:article.dateModified || article.datePublished,
    ...(photo ? {image:SITE_URL+'/images/'+photo.file} : {}),
    author:{'@type':'Person',name:article.author,...(article.author === 'Dra. Karyne Magalhães' ? {'@id':SITE_URL+'/#dra-karyne',url:SITE_URL+'/',image:SITE_URL+'/images/karyne_cta.jpg'} : {})}
  }).replaceAll('<','\\u003c') + '</script>' : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><meta name="theme-color" content="#F6F0E9"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="${type}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(imageUrl)}"><meta property="og:image:alt" content="${escapeHtml(photo?.alt || 'Dra. Karyne Magalhães')}"><meta name="twitter:card" content="summary_large_image">${baseStyles()}${trackingHead(preview)}${structured}</head><body>${preview ? '<div class="review review-banner"><strong>PRÉVIA LOCAL DE REVISÃO · NOINDEX</strong> · conteúdo não publicado e sem eventos reais.</div>' : ''}<a class="skip" href="#conteudo">Ir para o conteúdo</a><div class="wrap"><header class="site-header"><a class="brand" href="/"><strong>Karyne Magalhães</strong><small>Odontologia · Halitose</small></a><nav class="nav" aria-label="Principal"><a href="/blog/"${pageType === 'index' ? ' aria-current="page"' : ''}>Blog</a><a href="/">A consulta</a>${contactLink(article, preview, escapeHtml, 'Contato')}</nav></header></div>${body}<div class="wrap"><footer class="footer"><p>Dra. Karyne Magalhães · CRO-GO 7954 · Goiânia<br>Informação geral não substitui avaliação individual.</p><p><a href="/politica-de-privacidade">Política de Privacidade</a></p></footer></div>${blogClientTag({preview, article, pageType})}</body></html>`;
}

function renderInternalLinks(article, availableSlugs) {
  const links = (article.internalLinks || []).map((link) => {
    if (link?.slug && availableSlugs.has(link.slug)) return {link, href:`/blog/${link.slug}/`};
    if (link?.url) {
      const href = resolveInternalUrl(link.url, availableSlugs);
      if (href) return {link, href};
    }
    return null;
  }).filter(Boolean);
  if (!links.length) return '';
  return `<section class="related"><h2>Leia também</h2><ul>${links.map(({link, href}) => {
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(link.label || href)}</a></li>`;
  }).join('')}</ul></section>`;
}

export function renderArticle(article, {preview = false, availableSlugs = new Set(), relatedArticles = []} = {}) {
  const canonical = `${SITE_URL}/blog/${article.slug}/`;
  const articleBody = editorialArticle(article, {preview, availableSlugs, relatedArticles, renderBlocks, renderInternalLinks, escape:escapeHtml, isSafeExternalUrl, canonical});
  return layout({title:`${article.title} | Dra. Karyne Magalhães`,description:article.description,canonical,body:articleBody,preview,type:'article',article,pageType:'article'});
}

export function renderIndex(articles, {preview = false} = {}) {
  const body = editorialIndex(articles, preview, escapeHtml);
  const robotsOverride = !preview && articles.length === 0 ? 'noindex, follow' : '';
  return layout({title:'Blog | Dra. Karyne Magalhães',description:'Conteúdo sobre halitose, saliva e avaliação especializada.',canonical:`${SITE_URL}/blog/`,body,preview,pageType:'index',robotsOverride});
}

function dateOnly(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function buildSitemap(articles) {
  const articleDates = articles.map((a) => dateOnly(a.dateModified || a.datePublished)).filter(Boolean).sort();
  const entries = [
    {loc:`${SITE_URL}/`},
    {loc:`${SITE_URL}/politica-de-privacidade`, lastmod:'2026-06-22'},
    ...(articles.length ? [{loc:`${SITE_URL}/blog/`, lastmod:articleDates.at(-1) || ''}] : []),
    ...articles.map((a) => ({loc:`${SITE_URL}/blog/${a.slug}/`, lastmod:dateOnly(a.dateModified || a.datePublished)})),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({loc,lastmod}) => `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}

export function assertUniqueSlugs(articles) {
  const seen = new Set();
  for (const article of articles) {
    if (seen.has(article.slug)) throw new Error(`slug duplicado: ${article.slug}`);
    seen.add(article.slug);
  }
}

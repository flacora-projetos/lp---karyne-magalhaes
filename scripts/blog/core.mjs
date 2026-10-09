import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  return `<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Lora:wght@400;500;600&display=swap');
:root{--beige:#F6F0E9;--white:#FEFEFE;--brown:#2B1B0A;--green:#222D19;--soft:#565E48;--copper:#A95B21;--border:#E4DFD9}*{box-sizing:border-box}body{margin:0;background:var(--beige);color:var(--brown);font-family:Geist,system-ui,sans-serif;line-height:1.7}h1,h2,h3{font-family:Lora,Georgia,serif;line-height:1.2}a{color:inherit}.shell{max-width:1120px;margin:auto;padding:0 24px}.top{border-bottom:1px solid var(--border);background:rgba(246,240,233,.97)}.top .shell{min-height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-family:Lora,serif;font-size:20px;text-decoration:none}.nav{display:flex;gap:22px;align-items:center}.nav a{text-decoration:none;color:var(--soft)}.hero{padding:72px 0 36px}.hero h1{font-size:clamp(38px,6vw,68px);max-width:900px;margin:0 0 18px}.eyebrow{color:var(--copper);font-weight:600;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.lede{font-size:20px;max-width:780px;color:var(--soft)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;padding:24px 0 72px}.card{background:var(--white);border:1px solid var(--border);border-radius:22px;padding:26px;text-decoration:none}.card h2{font-size:25px;margin:8px 0}.article{max-width:780px;margin:auto;padding:52px 24px 84px}.article h1{font-size:clamp(36px,6vw,58px)}.article h2{margin-top:46px;font-size:30px}.article h3{margin-top:32px}.article p,.article li{font-size:18px}.article blockquote{border-left:4px solid var(--copper);margin:34px 0;padding:8px 24px;color:var(--soft)}.meta,.pending{font-size:14px;color:var(--soft)}.review{background:#fff7e6;border:1px solid #e9c46a;border-radius:16px;padding:16px 18px;margin:24px 0}.cta{display:inline-block;margin:32px 0;padding:14px 24px;border-radius:999px;background:var(--green);color:white;text-decoration:none;font-weight:600}.refs,.related{border-top:1px solid var(--border);margin-top:54px;padding-top:24px}.refs li,.related li{font-size:14px}.footer{background:var(--brown);color:var(--beige);padding:44px 0}.footer a{color:var(--beige)}@media(max-width:720px){.nav{display:none}.hero{padding-top:42px}.article{padding-top:34px}.article p,.article li{font-size:17px}}
</style>`;
}

function blogClientTag({preview, article, pageType}) {
  const articleAttrs = article
    ? ` data-blog-article="${escapeHtml(article.id)}" data-blog-source="${escapeHtml(article.sourceId || '')}" data-blog-slug="${escapeHtml(article.slug)}"`
    : '';
  return `<script src="/blog-client.js" defer data-blog-page="${escapeHtml(pageType)}"${articleAttrs} data-blog-preview="${preview ? '1' : '0'}"></script>`;
}

function layout({title, description, canonical, body, preview = false, type = 'website', article, pageType = 'index', robotsOverride = ''}) {
  const robots = robotsOverride || (preview ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  const structured = article && !preview && article.author && article.datePublished ? `<script type="application/ld+json">${JSON.stringify({
    '@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description:article.description,
    mainEntityOfPage:canonical,datePublished:article.datePublished,dateModified:article.dateModified || article.datePublished,
    author:{'@type':'Person',name:article.author}
  }).replaceAll('<','\\u003c')}</script>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><meta name="theme-color" content="#F6F0E9"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="${type}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${baseStyles()}${trackingHead(preview)}${structured}</head><body>${preview ? '<div class="review"><div class="shell"><strong>PRÉVIA LOCAL DE REVISÃO · NOINDEX</strong> · conteúdo não publicado e sem eventos reais.</div></div>' : ''}<header class="top"><div class="shell"><a class="brand" href="/">Dra. Karyne Magalhães</a><nav class="nav"><a href="/blog/">Blog</a><a href="/">A consulta</a><a href="/politica-de-privacidade">Privacidade</a></nav></div></header>${body}<footer class="footer"><div class="shell">Dra. Karyne Magalhães · CRO-GO 7954 · Goiânia · <a href="/politica-de-privacidade">Política de Privacidade</a></div></footer>${blogClientTag({preview, article, pageType})}</body></html>`;
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

export function renderArticle(article, {preview = false, availableSlugs = new Set()} = {}) {
  const canonical = `${SITE_URL}/blog/${article.slug}/`;
  const refs = Array.isArray(article.references) && article.references.length
    ? `<section class="refs"><h2>Referências consultadas</h2><ol>${article.references.map((r) => `<li>${escapeHtml(r.title)}${r.url && isSafeExternalUrl(r.url) ? ` · <a href="${escapeHtml(r.url)}" rel="noopener noreferrer">fonte</a>` : ''}</li>`).join('')}</ol></section>` : '';
  const pending = preview ? `<div class="review"><strong>Pendências de revisão:</strong> ${escapeHtml((article.reviewPending || ['revisão editorial e clínica']).join('; '))}</div>` : '';
  const related = renderInternalLinks(article, availableSlugs);
  const contactUrl = preview ? '#contato' : `https://wa.me/5562999320675?text=${encodeURIComponent(`Olá! Li o artigo "${article.title}" no blog da Dra. Karyne e gostaria de informações sobre a consulta.`)}`;
  const articleBody = `<main class="article"><div class="eyebrow">${preview ? 'Rascunho em revisão' : 'Blog'}</div><h1>${escapeHtml(article.title)}</h1><p class="lede">${escapeHtml(article.description)}</p><p class="meta">${article.author ? `Autoria: ${escapeHtml(article.author)}` : 'Autoria: pendente de confirmação'}${article.datePublished ? ` · Publicado em ${escapeHtml(article.datePublished)}` : ''}</p>${pending}${renderBlocks(article.body)}<a class="cta" href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer">Falar com a equipe pelo WhatsApp</a>${related}${refs}</main>`;
  return layout({title:`${article.title} | Dra. Karyne Magalhães`,description:article.description,canonical,body:articleBody,preview,type:'article',article,pageType:'article'});
}

export function renderIndex(articles, {preview = false} = {}) {
  const cards = articles.length ? articles.map((article) => `<a class="card" href="/blog/${escapeHtml(article.slug)}/"><div class="eyebrow">${preview ? 'Em revisão' : 'Artigo'}</div><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.description)}</p></a>`).join('') : '<p>Nenhum artigo foi aprovado para publicação ainda.</p>';
  const body = `<main><section class="hero shell"><div class="eyebrow">Informação para entender melhor o hálito</div><h1>Conteúdo claro para chegar à avaliação com perguntas melhores.</h1><p class="lede">Artigos sobre halitose, saliva e investigação clínica. Informação geral não substitui avaliação individual.</p></section><section class="grid shell">${cards}</section></main>`;
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

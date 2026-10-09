import fs from 'node:fs';

export const editorialStyles = fs.readFileSync(new URL('./editorial.css', import.meta.url), 'utf8');

const legacyImages = {
  'como-funciona-avaliacao-especializada-mau-halito': {
    file:'oralchroma_equipamento.jpg', width:1280, height:854, label:'A avaliação',
    alt:'Dra. Karyne junto a equipamento no consultório',
    caption:'Aparelho apresentado no site da Dra. Karyne como OralChroma. Os exames complementam a avaliação clínica.',
  },
  'mau-halito-persistente-qual-profissional-procurar': {
    file:'avaliacao_paciente.jpg', width:854, height:1280, label:'Por onde começar',
    alt:'Dra. Karyne demonstrando um modelo odontológico',
    caption:'Dra. Karyne demonstrando um modelo odontológico. A imagem não mostra atendimento a um paciente.',
  },
  'saliva-mau-halito-boca-seca-avaliacao': {
    file:'karyne_cta.jpg', width:854, height:1280, label:'Saliva e boca seca',
    alt:'Retrato da Dra. Karyne no consultório',
    caption:'Dra. Karyne Magalhães. Imagem de apresentação da profissional; não representa um exame de saliva.',
  },
};

function explicitPresentation(article) {
  const presentation = article?.presentation;
  if (!presentation || presentation.reviewStatus !== 'reviewed') return null;
  if (presentation.kind === 'none') {
    if (!String(presentation.reason || '').trim()) return null;
    return {
      kind:'none',
      reviewStatus:'reviewed',
      subject:String(presentation.subject || 'sem-imagem-adequada'),
      reason:String(presentation.reason),
      image:null,
    };
  }
  const image = presentation.image;
  if (
    presentation.kind !== 'image' ||
    !String(presentation.subject || '').trim() ||
    !String(image?.file || '').trim() ||
    !Number.isInteger(image?.width) || image.width <= 0 ||
    !Number.isInteger(image?.height) || image.height <= 0 ||
    !String(image?.label || '').trim() ||
    !String(image?.alt || '').trim() ||
    !String(image?.caption || '').trim()
  ) return null;
  return {
    kind:'image',
    reviewStatus:'reviewed',
    subject:String(presentation.subject),
    image:{
      file:String(image.file), width:image.width, height:image.height,
      label:String(image.label), alt:String(image.alt), caption:String(image.caption),
    },
  };
}

export function presentationContract(article) {
  const explicit = explicitPresentation(article);
  if (explicit) return explicit;
  const legacy = legacyImages[article?.slug];
  if (!legacy) return null;
  return {
    kind:'legacy',
    reviewStatus:'reviewed',
    subject:`legacy:${article.slug}`,
    source:'fase-3-visual-aprovado',
    image:legacy,
  };
}

export function isPresentationReady(article) {
  return Boolean(presentationContract(article));
}

export function articleImage(article) {
  return presentationContract(article)?.image || null;
}

export function readingMinutes(article) {
  const text = article.body.map(block => block.text || (block.items || []).join(' ')).join(' ').trim();
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

export function readableDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', {
    day:'numeric', month:'long', year:'numeric', timeZone:'America/Sao_Paulo',
  });
}

function image(info, escape, attributes = '') {
  return `<img src="/images/${escape(info.file)}" alt="${escape(info.alt)}" width="${info.width}" height="${info.height}" ${attributes}>`;
}

export function contactLink(article, preview, escape, label = 'Falar com a equipe pelo WhatsApp') {
  const message = article
    ? `Olá! Li o artigo "${article.title}" no blog da Dra. Karyne e gostaria de informações sobre a consulta.`
    : 'Olá! Conheci o blog da Dra. Karyne e gostaria de informações sobre a consulta.';
  const href = preview ? '#contato' : `https://wa.me/5562999320675?text=${encodeURIComponent(message)}`;
  return `<a class="contact cta" href="${escape(href)}"${preview ? '' : ' target="_blank" rel="noopener noreferrer"'}>${escape(label)}<span aria-hidden="true">↗</span></a>`;
}

export function authorByline(article, escape) {
  const date = readableDate(article.dateModified || article.datePublished);
  return `<div class="byline"><span class="avatar"><img src="/images/karyne_cta.jpg" alt="" width="854" height="1280"></span><div><span class="author">${escape(article.author || 'Autoria pendente de confirmação')}</span>${article.author === 'Dra. Karyne Magalhães' ? '<span class="small">Cirurgiã-dentista · CRO-GO 7954</span>' : ''}</div></div><p class="metadata">${date ? `<time datetime="${escape(article.dateModified || article.datePublished)}">${escape(date)}</time> · ` : ''}Leitura estimada: ${readingMinutes(article)} min</p>`;
}

export function articleCard(article, escape) {
  const info = articleImage(article);
  return `<a class="card" href="/blog/${escape(article.slug)}/">${info ? image(info, escape, 'class="card-image" loading="lazy"') : ''}<span class="eyebrow">${escape(info?.label || 'Artigo')}</span><h3>${escape(article.title)}</h3><p>${escape(article.description)}</p><div class="time">${escape(article.author || 'Autoria pendente')} · ${readingMinutes(article)} min de leitura estimada</div><span class="read-link">Ler artigo <span aria-hidden="true">↗</span></span></a>`;
}

export function editorialIndex(articles, preview, escape) {
  const featured = articles.find(article => article.slug === 'como-funciona-avaliacao-especializada-mau-halito') || articles[0];
  const info = articleImage(featured);
  const highlight = featured ? `<section class="feature ${info ? '' : 'without-image'}" aria-label="Artigo em destaque">${info ? `<a class="feature-image" href="/blog/${escape(featured.slug)}/">${image(info, escape, 'fetchpriority="high"')}</a>` : ''}<div class="feature-copy"><span class="eyebrow">${preview ? 'Em revisão' : 'Em destaque'} · ${escape(info?.label || 'Artigo')}</span><a class="feature-story" href="/blog/${escape(featured.slug)}/"><h2>${escape(featured.title)}</h2></a><p>${escape(featured.description)}</p><span class="time">${readingMinutes(featured)} min de leitura estimada</span><a class="read-link" href="/blog/${escape(featured.slug)}/">Ler artigo <span aria-hidden="true">↗</span></a></div></section>` : '<p>Nenhum artigo foi aprovado para publicação ainda.</p>';
  const remaining = articles.filter(article => article !== featured);
  return `<main id="conteudo" class="wrap"><section class="intro" aria-labelledby="titulo"><div><span class="eyebrow">Blog da Dra. Karyne</span><h1 id="titulo">Informação para cuidar do seu hálito.</h1></div><p>Entenda o mau hálito, conheça os caminhos da avaliação e encontre orientação para cuidar da saúde bucal.</p></section>${highlight}${remaining.length ? `<section aria-labelledby="mais"><div class="section-head"><h2 id="mais">Continue sua leitura</h2><p>Outros caminhos para entender o assunto</p></div><div class="stories">${remaining.map(article => articleCard(article, escape)).join('')}</div></section>` : ''}<section class="author-band" aria-labelledby="autora"><img src="/images/karyne_hero.jpg" alt="Dra. Karyne Magalhães" width="854" height="1280" loading="lazy"><div><span class="eyebrow">Informação com autoria</span><h2 id="autora">Dra. Karyne Magalhães</h2><p>Cirurgiã-dentista · CRO-GO 7954</p><p>Ficou com uma dúvida sobre a consulta? Converse com a equipe e saiba como funciona a avaliação.</p><div id="contato">${contactLink(null, preview, escape)}</div></div></section></main>`;
}

export function editorialArticle(article, {preview, availableSlugs, relatedArticles, renderBlocks, renderInternalLinks, escape, isSafeExternalUrl, canonical}) {
  const info = articleImage(article);
  const headings = article.body.filter(block => block.type === 'h2').map((block, index) => ({text:block.text, id:`secao-${index+1}`}));
  const navigation = headings.map(heading => `<a href="#${heading.id}">${escape(heading.text)}</a>`).join('');
  let headingIndex = 0;
  let paragraphs = 0;
  const blocks = article.body.map(block => {
    if (block.type === 'h2') return `<h2 id="${headings[headingIndex++].id}">${escape(block.text)}</h2>`;
    const html = renderBlocks([block]);
    if (block.type !== 'p') return html;
    paragraphs++;
    if (paragraphs !== 2) return html;
    const contents = headings.length ? `<details class="mobile-toc"><summary>O que você encontra neste artigo</summary>${navigation}</details>` : '';
    const photo = info ? `<figure class="context-image ${info.height > info.width ? 'portrait' : ''}">${image(info, escape, 'loading="lazy"')}<figcaption>${escape(info.caption)}</figcaption></figure>` : '';
    return html + contents + photo;
  }).join('\n');
  const pending = preview ? `<div class="review"><strong>Pendências de revisão:</strong> ${escape((article.reviewPending || ['revisão editorial e clínica']).join('; '))}</div>` : '';
  const references = article.references?.length ? `<section class="source-box" aria-labelledby="fontes"><h2 id="fontes">Fontes e referências</h2><ol>${article.references.map(reference => `<li>${reference.url && isSafeExternalUrl(reference.url) ? `<a href="${escape(reference.url)}" target="_blank" rel="noopener noreferrer">${escape(reference.title)}</a>` : escape(reference.title)}</li>`).join('')}</ol></section>` : '';
  const related = relatedArticles.filter(item => item.slug !== article.slug);
  const next = related.length ? `<section class="article-related" aria-labelledby="relacionados"><div class="section-head"><h2 id="relacionados">Para continuar entendendo</h2></div><div class="stories">${related.map(item => articleCard(item, escape)).join('')}</div></section>` : '';
  return `<main id="conteudo" class="wrap article-wrap"><nav class="breadcrumbs" aria-label="Localização"><a href="/blog/">← Voltar ao blog</a><span aria-hidden="true">/</span><span>${escape(info?.label || 'Artigo')}</span></nav><header class="article-head"><span class="eyebrow">${preview ? 'Rascunho em revisão' : escape(info?.label || 'Blog')}</span><h1>${escape(article.title)}</h1><p class="dek">${escape(article.description)}</p><div class="author-line">${authorByline(article, escape)}<button class="share" type="button" data-share="${escape(canonical)}">Copiar link do artigo</button><span class="share-status" role="status"></span></div></header>${pending}<div class="article-layout"><article class="prose">${blocks}${renderInternalLinks(article, availableSlugs)}${references}<section class="closing" id="contato" aria-labelledby="conversar"><h2 id="conversar">Quer entender o próximo passo?</h2><p>Converse com a equipe da Dra. Karyne para saber mais sobre a avaliação.</p>${contactLink(article, preview, escape)}</section></article><aside class="toc" aria-label="Navegação do artigo">${headings.length ? `<p>NESTA LEITURA</p>${navigation}` : ''}<div class="side-contact"><p>Dúvidas sobre a consulta?</p>${contactLink(article, preview, escape, 'Falar pelo WhatsApp')}</div></aside></div>${next}</main>`;
}

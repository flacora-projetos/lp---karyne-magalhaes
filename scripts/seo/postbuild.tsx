import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrivacyPolicy } from '../../src/components/PrivacyPolicy';
import { faqItems } from '../../src/content/faqData';

const dist = path.resolve(process.cwd(), 'dist');
const homePath = path.join(dist, 'index.html');

const escapeHtml = (value: string) => value
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

function replaceRequired(source: string, search: string | RegExp, replacement: string, label: string) {
  const next = source.replace(search,replacement);
  if (next === source) throw new Error(`postbuild: marcador não encontrado: ${label}`);
  return next;
}

let home = fs.readFileSync(homePath,'utf8');
const faqJson = JSON.stringify({
  '@context':'https://schema.org',
  '@type':'FAQPage',
  mainEntity:faqItems.map((item) => ({'@type':'Question',name:item.q,acceptedAnswer:{'@type':'Answer',text:item.a}})),
}).replaceAll('<','\\u003c');
const faqStructured = `<!-- FAQ_JSONLD_START --><script type="application/ld+json">${faqJson}</script><!-- FAQ_JSONLD_END -->`;
const faqFallback = faqItems.map((item) => `<p><strong>${escapeHtml(item.q)}</strong> ${escapeHtml(item.a).replaceAll('\n','<br>')}</p>`).join('\n');
home = replaceRequired(home,'<!-- FAQ_JSONLD_BUILD -->',faqStructured,'FAQ_JSONLD_BUILD');
home = replaceRequired(home,'<!-- FAQ_FALLBACK_BUILD -->',faqFallback,'FAQ_FALLBACK_BUILD');
fs.writeFileSync(homePath,home,'utf8');

let privacy = home;
privacy = replaceRequired(privacy,/<title>[\s\S]*?<\/title>/,'<title>Política de Privacidade | Dra. Karyne Magalhães</title>','privacy title');
privacy = replaceRequired(privacy,/<meta name="description" content="[^"]*"\s*\/>/,'<meta name="description" content="Saiba como os dados pessoais e dados de navegação são coletados, usados e protegidos na página da Dra. Karyne Magalhães." />','privacy description');
privacy = replaceRequired(privacy,/<link rel="canonical" href="[^"]*"\s*\/>/,'<link rel="canonical" href="https://tratamentodomauhalito.com.br/politica-de-privacidade" />','privacy canonical');
privacy = replaceRequired(privacy,/<meta property="og:title" content="[^"]*"\s*\/>/,'<meta property="og:title" content="Política de Privacidade | Dra. Karyne Magalhães" />','privacy og title');
privacy = replaceRequired(privacy,/<meta property="og:description" content="[^"]*"\s*\/>/,'<meta property="og:description" content="Saiba como os dados pessoais e dados de navegação são coletados, usados e protegidos." />','privacy og description');
privacy = replaceRequired(privacy,/<meta property="og:url" content="[^"]*"\s*\/>/,'<meta property="og:url" content="https://tratamentodomauhalito.com.br/politica-de-privacidade" />','privacy og url');
privacy = replaceRequired(privacy,/<meta name="twitter:title" content="[^"]*"\s*\/>/,'<meta name="twitter:title" content="Política de Privacidade | Dra. Karyne Magalhães" />','privacy twitter title');
privacy = replaceRequired(privacy,/<meta name="twitter:description" content="[^"]*"\s*\/>/,'<meta name="twitter:description" content="Saiba como os dados pessoais e dados de navegação são coletados, usados e protegidos." />','privacy twitter description');
privacy = privacy.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
privacy = privacy.replace(/\s*<!-- FAQ_JSONLD_START -->[\s\S]*?<!-- FAQ_JSONLD_END -->/g,'');

const privacyMarkup = renderToStaticMarkup(<PrivacyPolicy />);
const rootStart = privacy.indexOf('<div id="root">');
const rootEnd = privacy.indexOf('</div>',rootStart);
if (rootStart < 0 || rootEnd < rootStart) throw new Error('postbuild: não foi possível localizar #root da política');
privacy = `${privacy.slice(0,rootStart)}<div id="root">${privacyMarkup}</div>${privacy.slice(rootEnd + 6)}`;

const privacyDir = path.join(dist,'politica-de-privacidade');
fs.mkdirSync(privacyDir,{recursive:true});
fs.writeFileSync(path.join(privacyDir,'index.html'),privacy,'utf8');
console.log(JSON.stringify({faqCount:faqItems.length,privacyRoute:'/politica-de-privacidade'}));

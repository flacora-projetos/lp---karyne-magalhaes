// Montador das opções de página (Designeer, 24/11/2026).
// Uso, na pasta do site:  node opcoes-designeer/montar.mjs            (todas)
//                         node opcoes-designeer/montar.mjs ficha      (só uma)
// Gera opcoes-designeer/saida/<opcao>.html: uma página única, com o código, o
// estilo e as fotos dentro do próprio arquivo, pronta para publicar como prévia privada.
// Texto aprovado vem dos componentes do site (src/components): mude lá e rode de novo.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = join(AQUI, '..');
const SAIDA = join(AQUI, 'saida');
const TITULOS = {
  atual: 'Karyne · Página atual',
  ficha: 'Karyne · Ficha',
  'filtro-a-vista': 'Karyne · Filtro à vista',
  cartao: 'Karyne · Cartão de consulta',
};
const pedidas = process.argv.slice(2);
const opcoes = pedidas.length ? pedidas : Object.keys(TITULOS);

// Fotos reais do site, embutidas (as páginas privadas não buscam arquivos fora).
const fotos = Object.fromEntries(
  readdirSync(join(SITE, 'public/images')).filter((f) => f.endsWith('.jpg'))
    .map((f) => [`/images/${f}`, `data:image/jpeg;base64,${readFileSync(join(SITE, 'public/images', f)).toString('base64')}`]),
);

mkdirSync(SAIDA, { recursive: true });
for (const opcao of opcoes) {
  if (!TITULOS[opcao]) throw new Error(`Opção desconhecida: ${opcao}`);
  const tmp = join(tmpdir(), `karyne-opcao-${opcao}-${process.pid}`);
  await build({
    configFile: false,
    root: AQUI,
    logLevel: 'warn',
    publicDir: false,
    plugins: [react(), tailwindcss()],
    define: { __OPCAO__: JSON.stringify(opcao), __SUPABASE_URL__: '""', __SUPABASE_ANON_KEY__: '""' },
    build: { outDir: tmp, emptyOutDir: true, assetsInlineLimit: 1e9, cssCodeSplit: false, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } },
  });
  const pasta = join(tmp, 'assets');
  const arquivos = readdirSync(pasta);
  const css = arquivos.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(pasta, f), 'utf8')).join('\n');
  let js = arquivos.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(pasta, f), 'utf8')).join('\n');
  let faltou = 0;
  for (const [caminho, dado] of Object.entries(fotos)) js = js.split(caminho).join(dado);
  if (/\/images\/[a-z_]+\.jpg/.test(js)) faltou++;
  // A fonte do Google vai como <link> (é o único endereço externo que a prévia aceita).
  const fontes = [...css.matchAll(/@import\s*url\(([^)]+)\);?/g)].map((m) => m[1].replace(/["']/g, ''));
  const cssLimpo = css.replace(/@import\s*url\([^)]+\);?/g, '').replace(/<\/style/gi, '<\\/style');
  const html = [
    `<title>${TITULOS[opcao]}</title>`,
    ...fontes.map((u) => `<link rel="stylesheet" href="${u}">`),
    `<style>${cssLimpo}</style>`,
    '<div id="root"></div>',
    `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
  ].join('\n');
  writeFileSync(join(SAIDA, `${opcao}.html`), html, 'utf8');
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${opcao}.html  ${(html.length / 1024).toFixed(0)} KB${faltou ? '  (atenção: foto sem embutir)' : ''}`);
}

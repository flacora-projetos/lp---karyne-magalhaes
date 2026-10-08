import express from 'express';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
const dist = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 4174);

app.disable('x-powered-by');
app.enable('strict routing');

function safePreviewHtml(relativePath = 'index.html') {
  const file = path.join(dist, relativePath);
  let html = fs.readFileSync(file, 'utf8');
  html = html
    .replace(/<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script>/g, '')
    .replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/g, '')
    .replace(/<!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->/g, '')
    .replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '')
    .replace(/<!-- Meta Pixel Noscript -->[\s\S]*?<!-- End Meta Pixel Noscript -->/g, '')
    .replace('<head>', '<head><meta name="robots" content="noindex, nofollow">');
  return html;
}

const sendSafe = (relativePath) => (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(200).type('html').send(safePreviewHtml(relativePath));
};

app.get('/politica-de-privacidade/', (_req,res) => res.redirect(308,'/politica-de-privacidade'));
app.get('/politica-de-privacidade', sendSafe(path.join('politica-de-privacidade','index.html')));
app.get('/blog', (_req,res) => res.redirect(308,'/blog/'));
app.get('/blog/:slug', (req,res) => res.redirect(308,`/blog/${req.params.slug}/`));
app.get('/blog/', (_req,res) => res.sendFile(path.join(dist,'blog','index.html')));
app.get('/blog/:slug/', (req,res) => {
  const file = path.join(dist,'blog',req.params.slug,'index.html');
  if (!fs.existsSync(file)) return res.status(404).type('html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>404</title><body><h1>Artigo não encontrado</h1><a href="/blog/">Voltar ao blog</a></body></html>');
  return res.sendFile(file);
});
app.use(express.static(dist,{index:false}));
app.all('/api/*', (_req,res) => res.status(501).json({success:false,error:'Prévia local não executa as funções Vercel /api/*.'}));
app.get('*', sendSafe('index.html'));

app.listen(port,'127.0.0.1',() => console.log(`BLOG_PREVIEW http://127.0.0.1:${port}/blog/`));

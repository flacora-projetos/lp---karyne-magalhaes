import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {buildSitemap, contentFingerprint, isProductionEligible, renderArticle, renderIndex, resetGeneratedBlogDir, validateArticle} from './core.mjs';
import {captureFirstAcquisition, deriveChannel, getAttributionExtras} from '../../src/utils/acquisition';
import {derivarCanal, derivarOrigem, mapPayloadToRow} from '../../lib/mapLead';
import {sendLeadToCrm} from '../../src/utils/crmLead';
import {getTrackingData} from '../../src/components/QualificationModal';

function approvedArticle(overrides: Record<string, unknown> = {}) {
  const article: any = {
    id:'a1', version:2, slug:'artigo-teste', title:'Título', description:'Descrição',
    status:'approved', author:'Dra. Karyne Magalhães', datePublished:'2026-10-08',
    body:[{type:'p',text:'Texto seguro'}], references:[], internalLinks:[], ...overrides,
  };
  article.approval = {version:article.version,editorial:true,clinical:true,contentHash:contentFingerprint(article)};
  return article;
}

class MemoryStorage {
  data = new Map<string,string>();
  getItem(key:string){ return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key:string,value:string){ this.data.set(key,String(value)); }
  removeItem(key:string){ this.data.delete(key); }
  clear(){ this.data.clear(); }
}

function setBrowser({search='',href='https://tratamentodomauhalito.com.br/',referrer='',local=new MemoryStorage(),session=new MemoryStorage()}={}) {
  (globalThis as any).window = {location:{search,href,hostname:'tratamentodomauhalito.com.br'}};
  (globalThis as any).document = {referrer,cookie:''};
  (globalThis as any).localStorage = local;
  (globalThis as any).sessionStorage = session;
  Object.defineProperty(globalThis,'navigator',{value:{userAgent:'blog-test'},configurable:true});
  return {local,session};
}

const blogClientSource = fs.readFileSync('public/blog-client.js','utf8');
function runBlogClient({slug='',pageType='article',search='',referrer='',preview='1',local=new MemoryStorage(),session=new MemoryStorage()}={}) {
  const listeners = new Map<string,()=>void>();
  const cta = {addEventListener:(name:string, fn:()=>void) => listeners.set(name,fn)};
  const href = `https://tratamentodomauhalito.com.br/${pageType === 'index' ? 'blog/' : `blog/${slug}/`}${search}`;
  const location = {href,search,hostname:'tratamentodomauhalito.com.br'};
  const gtagCalls:any[] = [];
  const document = {
    referrer,
    title:'Teste',
    currentScript:{dataset:{blogPage:pageType,blogArticle:slug,blogSlug:slug,blogSource:slug ? `source-${slug}` : '',blogPreview:preview}},
    querySelectorAll:() => pageType === 'article' ? [cta] : [],
  };
  const window = {location,gtag:(...args:any[]) => gtagCalls.push(args)};
  vm.runInNewContext(blogClientSource,{document,window,location,sessionStorage:session,localStorage:local,URLSearchParams,URL,Date});
  return {local,session,gtagCalls,click:()=>listeners.get('click')?.()};
}

test('produção exige revisão exata, hash do conteúdo, autoria e data', () => {
  const base = approvedArticle();
  assert.equal(isProductionEligible(base), true);
  assert.equal(isProductionEligible({...base, version:3}), false);
  assert.equal(isProductionEligible({...base, status:'draft'}), false);
  assert.equal(isProductionEligible({...base, approval:{...base.approval,clinical:false}}), false);
  assert.equal(isProductionEligible({...base, body:[{type:'p',text:'Texto alterado sem nova aprovação'}]}), false);
  assert.equal(isProductionEligible({...base, title:'Título alterado sem nova aprovação'}), false);
  assert.equal(isProductionEligible({...base, author:''}), false);
  assert.equal(isProductionEligible({...base, datePublished:''}), false);
});

test('renderização escapa HTML e prévia é noindex sem trackers reais', () => {
  const base = approvedArticle();
  const html = renderArticle({...base, body:[{type:'p',text:'<script>alert(1)</script>'}]}, {preview:true});
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('noindex, nofollow'));
  assert.ok(!html.includes('googletagmanager.com'));
  assert.ok(!html.includes('G-3783BP5DSB'));
});

test('URLs de referência aceitam somente http/https', () => {
  const base = approvedArticle();
  assert.doesNotThrow(() => validateArticle({...base,references:[{title:'ok',url:'https://example.org/a'}]}));
  assert.throws(() => validateArticle({...base,references:[{title:'x',url:'javascript:alert(1)'}]}), /URL de referência inválida/);
  assert.throws(() => validateArticle({...base,references:[{title:'x',url:'data:text/html,x'}]}), /URL de referência inválida/);
  const html = renderArticle({...base,references:[{title:'x',url:'javascript:alert(1)'}]},{preview:true});
  assert.ok(!html.includes('href="javascript:'));
});

test('artigo publicado usa gtag direto como único emissor editorial', () => {
  const html = renderArticle(approvedArticle(), {preview:false});
  assert.ok(html.includes('googletagmanager.com/gtag/js?id=G-3783BP5DSB'));
  assert.ok(html.includes('send_page_view:false'));
  assert.ok(!html.includes('GTM-P32CM7H7'));
});

test('índice carrega cliente editorial, emite page_view e fica noindex enquanto vazio', () => {
  const html = renderIndex([], {preview:false});
  assert.ok(html.includes('src="/blog-client.js"'));
  assert.ok(html.includes('data-blog-page="index"'));
  assert.ok(html.includes('noindex, follow'));
  const result = runBlogClient({pageType:'index',preview:'0'});
  const pageView = result.gtagCalls.find((args) => args[0] === 'event' && args[1] === 'page_view');
  assert.equal(pageView?.[2]?.content_type,'blog_index');
});

test('links internos só aparecem para destinos disponíveis', () => {
  const article = approvedArticle({internalLinks:[{label:'Outro',slug:'outro-artigo'},{label:'Home',url:'/'}]});
  const without = renderArticle(article,{preview:false,availableSlugs:new Set([article.slug])});
  assert.ok(!without.includes('/blog/outro-artigo/'));
  assert.ok(without.includes('href="/"'));
  const withTarget = renderArticle(article,{preview:false,availableSlugs:new Set([article.slug,'outro-artigo'])});
  assert.ok(withTarget.includes('/blog/outro-artigo/'));
});

test('links internos por URL respeitam mesma origem e destinos realmente disponíveis', () => {
  const base = approvedArticle();
  assert.throws(() => validateArticle({...base,internalLinks:[{label:'externo',url:'//example.org/'}]}), /rotas editoriais permitidas/);
  assert.throws(() => validateArticle({...base,internalLinks:[{label:'admin',url:'/admin'}]}), /rotas editoriais permitidas/);
  assert.throws(() => validateArticle({...base,internalLinks:[{label:'gads',url:'/gads'}]}), /rotas editoriais permitidas/);
  assert.throws(() => validateArticle({...base,internalLinks:[{label:'utm',url:'/?utm_source=interno'}]}), /rotas editoriais permitidas/);
  const article = {...base,internalLinks:[
    {label:'Home',url:'/'},
    {label:'Privacidade',url:'/politica-de-privacidade'},
    {label:'Publicado',url:'/blog/publicado/'},
    {label:'Não publicado',url:'/blog/nao-publicado/'},
  ]};
  assert.doesNotThrow(() => validateArticle(article));
  const html = renderArticle(article,{availableSlugs:new Set([base.slug,'publicado'])});
  assert.ok(html.includes('href="/"'));
  assert.ok(html.includes('href="/politica-de-privacidade"'));
  assert.ok(html.includes('href="/blog/publicado/"'));
  assert.ok(!html.includes('href="/blog/nao-publicado/"'));
});

test('sitemap contém apenas seção com conteúdo, lastmod real e nunca admin/gads', () => {
  const emptyXml = buildSitemap([]);
  assert.ok(!emptyXml.includes('/blog/'));
  const base = approvedArticle({datePublished:'2026-10-08'});
  const xml = buildSitemap([base]);
  assert.ok(xml.includes('/blog/'));
  assert.ok(xml.includes('/blog/artigo-teste/'));
  assert.ok(xml.includes('<lastmod>2026-10-08</lastmod>'));
  assert.ok(xml.includes('/politica-de-privacidade</loc><lastmod>2026-06-22</lastmod>'));
  assert.ok(!xml.includes('/admin'));
  assert.ok(!xml.includes('/gads'));
});

test('gerador limpa somente dist/blog e fixture é proibida fora da prévia', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'blog-output-'));
  fs.mkdirSync(path.join(root,'blog','rascunho'),{recursive:true});
  fs.writeFileSync(path.join(root,'blog','rascunho','index.html'),'stale');
  fs.writeFileSync(path.join(root,'index.html'),'preservar');
  resetGeneratedBlogDir(root);
  assert.equal(fs.existsSync(path.join(root,'blog','rascunho')),false);
  assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),'preservar');
  fs.rmSync(root,{recursive:true,force:true});
  const attempt = spawnSync(process.execPath,['scripts/blog/generate.mjs','--fixture'],{cwd:process.cwd(),encoding:'utf8'});
  assert.notEqual(attempt.status,0);
  assert.match(`${attempt.stdout}${attempt.stderr}`,/--fixture só pode ser usado junto com --preview/);
});

test('classificação harmoniza canal e não atribui Bing/TikTok a Google/Meta', () => {
  assert.equal(deriveChannel({utmSource:'google',utmMedium:'cpc'}), 'Paid Search');
  assert.equal(derivarCanal({utmSource:'google',utmMedium:'cpc'}), 'Paid Search');
  assert.equal(deriveChannel({utmSource:'bing',utmMedium:'cpc'}), 'Paid Search');
  assert.equal(derivarCanal({utmSource:'bing',utmMedium:'cpc'}), 'Paid Search');
  assert.equal(derivarOrigem({utmSource:'bing',utmMedium:'cpc'}), 'Microsoft Ads');
  assert.equal(derivarOrigem({utmSource:'tiktok',utmMedium:'paid_social'}), 'TikTok Ads');
  assert.equal(derivarOrigem({referrer:'https://tratamentodomauhalito.com.br/blog/a/'}), 'Direto');
  assert.equal(deriveChannel({referrer:'https://tratamentodomauhalito.com.br/blog/a/'}), 'Direct');
});

test('classificação cobre orgânico, social, referral, direto e fbclid isolado', () => {
  assert.equal(deriveChannel({gclid:'x'}), 'Paid Search');
  assert.equal(deriveChannel({utmSource:'instagram',utmMedium:'paid_social'}), 'Paid Social');
  assert.equal(deriveChannel({referrer:'https://www.google.com/'}), 'Organic Search');
  assert.equal(deriveChannel({referrer:'https://instagram.com/p/x'}), 'Organic Social');
  assert.equal(deriveChannel({referrer:'https://example.org/'}), 'Referral');
  assert.equal(deriveChannel({}), 'Direct');
  assert.equal(deriveChannel({fbclid:'x'}), 'Unassigned');
  assert.equal(derivarOrigem({fbclid:'abc'}), 'Não atribuído');
});

test('hosts de busca exigem domínio real, não apenas nome parecido', () => {
  for (const referrer of ['https://google.com/','https://www.google.com/search?q=x','https://google.com.br/search?q=x']) {
    assert.equal(deriveChannel({referrer}), 'Organic Search');
    assert.equal(derivarCanal({referrer}), 'Organic Search');
  }
  for (const referrer of ['https://google.example.org/','https://example.org/?destino=google.com','https://duckduckgo.example.org/','https://yahoo.example.org/','https://baidu.example.org/']) {
    assert.equal(deriveChannel({referrer}), 'Referral');
    assert.equal(derivarCanal({referrer}), 'Referral');
  }
});

test('entrada paga atual não apaga primeira aquisição orgânica', () => {
  const row = mapPayloadToRow({utmSource:'google',utmMedium:'cpc',gclid:'novo',currentChannelDerived:'Paid Search',currentProviderDerived:'Google Ads',firstUtmSource:'google',firstUtmMedium:'organic',firstEntryUrl:'https://tratamentodomauhalito.com.br/blog/x/',firstChannelDerived:'Organic Search',entryArticleSlug:'x'});
  assert.equal(row.origem, 'Google Ads');
  assert.equal(row.channel_derived, 'Paid Search');
  assert.equal(row.first_channel_derived, 'Organic Search');
  assert.equal(row.entry_article_slug, 'x');
});

test('tracking real do formulário não ressuscita campanha antiga quando a aquisição atual tem campos vazios', () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  setBrowser({
    search:'?utm_source=google&utm_medium=cpc&utm_campaign=campanha-antiga&gclid=clique-antigo',
    href:'https://tratamentodomauhalito.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=campanha-antiga&gclid=clique-antigo',
    local,session,
  });
  const paid = getTrackingData() as any;
  assert.equal(paid.utmCampaign,'campanha-antiga');
  assert.equal(paid.gclid,'clique-antigo');

  setBrowser({href:'https://tratamentodomauhalito.com.br/',referrer:'https://www.google.com/search?q=halitose',local,session});
  const organic = getTrackingData() as any;
  assert.equal(organic.currentChannelDerived,'Organic Search');
  assert.equal(organic.utmSource,'');
  assert.equal(organic.utmMedium,'');
  assert.equal(organic.utmCampaign,'');
  assert.equal(organic.gclid,'');
  assert.equal(session.getItem('gclid'),null);
  assert.equal(session.getItem('utm_campaign'),null);
  const organicRow = mapPayloadToRow({leadId:'lead-organic',...organic});
  assert.equal(organicRow.current_acquisition_available,true);
  assert.equal(organicRow.utm_campaign,null);
  assert.equal(organicRow.gclid,null);
  assert.equal(organicRow.channel_derived,'Organic Search');

  setBrowser({
    search:'?utm_source=google&utm_medium=cpc&utm_campaign=campanha-nova',
    href:'https://tratamentodomauhalito.com.br/gads?utm_source=google&utm_medium=cpc&utm_campaign=campanha-nova',
    local,session,
  });
  const newCampaign = getTrackingData() as any;
  assert.equal(newCampaign.utmCampaign,'campanha-nova');
  assert.equal(newCampaign.gclid,'');
  assert.equal(session.getItem('gclid'),null);
});

test('sem consentimento a primeira aquisição fica apenas na sessão', () => {
  const {local,session} = setBrowser({search:'?utm_source=google&utm_medium=organic',href:'https://tratamentodomauhalito.com.br/blog/x/',referrer:'https://www.google.com/'});
  captureFirstAcquisition();
  assert.ok(session.getItem('dacora_first_acquisition_v1'));
  assert.equal(local.getItem('dacora_first_acquisition_persisted_v1'), null);
});

test('com consentimento retorno direto preserva primeira e atual aquisição', () => {
  const local = new MemoryStorage();
  local.setItem('dacora_analytics_consent','granted');
  const firstSession = new MemoryStorage();
  setBrowser({search:'?utm_source=google&utm_medium=organic',href:'https://tratamentodomauhalito.com.br/blog/x/',referrer:'https://www.google.com/',local,session:firstSession});
  captureFirstAcquisition();
  assert.ok(local.getItem('dacora_first_acquisition_persisted_v1'));
  assert.ok(local.getItem('dacora_current_acquisition_persisted_v1'));
  const returnSession = new MemoryStorage();
  setBrowser({href:'https://tratamentodomauhalito.com.br/',referrer:'',local,session:returnSession});
  const extras = getAttributionExtras() as any;
  assert.equal(extras.firstUtmSource,'google');
  assert.equal(extras.firstChannelDerived,'Organic Search');
  assert.equal(extras.currentUtmSource,'google');
  assert.equal(extras.currentChannelDerived,'Organic Search');
});

test('envelope editorial é lido pelo campo context e expiração é respeitada', () => {
  const local = new MemoryStorage();
  local.setItem('dacora_analytics_consent','granted');
  local.setItem('dacora_editorial_context_persisted_v1',JSON.stringify({expiresAt:Date.now()+60_000,context:{entryArticleSlug:'primeiro'}}));
  const session = new MemoryStorage();
  setBrowser({local,session});
  let extras = getAttributionExtras() as any;
  assert.equal(extras.entryArticleSlug,'primeiro');
  local.setItem('dacora_editorial_context_persisted_v1',JSON.stringify({expiresAt:Date.now()-1,context:{entryArticleSlug:'expirado'}}));
  session.clear();
  setBrowser({local,session});
  extras = getAttributionExtras() as any;
  assert.equal(extras.entryArticleSlug,'');
  assert.equal(local.getItem('dacora_editorial_context_persisted_v1'),null);
});

test('A→B→A preserva entrada editorial e acumula assists sem duplicar artigo', () => {
  const local = new MemoryStorage();
  local.setItem('dacora_analytics_consent','granted');
  const session = new MemoryStorage();
  runBlogClient({slug:'artigo-a',search:'?utm_source=google&utm_medium=organic',referrer:'https://www.google.com/',local,session});
  runBlogClient({slug:'artigo-b',referrer:'https://tratamentodomauhalito.com.br/blog/artigo-a/',local,session});
  const third = runBlogClient({slug:'artigo-a',referrer:'https://tratamentodomauhalito.com.br/blog/artigo-b/',local,session});
  third.click();
  const context = JSON.parse(session.getItem('dacora_editorial_context_v1')!);
  assert.equal(context.entryArticleSlug,'artigo-a');
  assert.equal(context.lastArticleSlug,'artigo-a');
  assert.deepEqual(context.articleAssists.map((x:any)=>x.slug),['artigo-b','artigo-a']);
  assert.equal(context.ctaId,'avaliacao_inicial');
  assert.equal(context.ctaDestination,'home_filter');
});

test('nova sessão com consentimento preserva entrada editorial anterior', () => {
  const local = new MemoryStorage();
  local.setItem('dacora_analytics_consent','granted');
  runBlogClient({slug:'artigo-a',search:'?utm_source=google&utm_medium=organic',referrer:'https://www.google.com/',local,session:new MemoryStorage()});
  const returnSession = new MemoryStorage();
  runBlogClient({slug:'artigo-c',local,session:returnSession});
  const context = JSON.parse(returnSession.getItem('dacora_editorial_context_v1')!);
  assert.equal(context.entryArticleSlug,'artigo-a');
  assert.equal(context.lastArticleSlug,'artigo-c');
  assert.deepEqual(context.articleAssists.map((x:any)=>x.slug),['artigo-a','artigo-c']);
});

test('navegação interna não substitui primeira aquisição da sessão', () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  setBrowser({search:'?gclid=primeiro',href:'https://tratamentodomauhalito.com.br/blog/x/',referrer:'https://www.google.com/',local,session});
  captureFirstAcquisition();
  setBrowser({href:'https://tratamentodomauhalito.com.br/',referrer:'https://tratamentodomauhalito.com.br/blog/x/',local,session});
  captureFirstAcquisition();
  const saved = JSON.parse(session.getItem('dacora_first_acquisition_v1')!);
  assert.equal(saved.gclid,'primeiro');
  assert.equal(saved.entryUrl,'https://tratamentodomauhalito.com.br/blog/x/');
});

test('falha de armazenamento não derruba captura', () => {
  const failing = {getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
  (globalThis as any).window = {location:{search:'',href:'https://tratamentodomauhalito.com.br/',hostname:'tratamentodomauhalito.com.br'}};
  (globalThis as any).document = {referrer:''};
  (globalThis as any).localStorage = failing;
  (globalThis as any).sessionStorage = failing;
  assert.doesNotThrow(() => captureFirstAcquisition());
});

test('transporte CRM captura payload e não trata falha HTTP/JSON como sucesso', async () => {
  let captured:any = null;
  const payload = {leadId:'lead-123',status:'Lead gerado',utmSource:'google',entryArticleSlug:'artigo-a'};
  const ok = await sendLeadToCrm(payload, (async (_url:any, init:any) => {
    captured = JSON.parse(init.body);
    return {ok:true,status:200,json:async()=>({success:true})} as Response;
  }) as typeof fetch);
  assert.deepEqual(captured,payload);
  assert.equal(ok.success,true);
  const rejected = await sendLeadToCrm(payload, (async () => ({ok:true,status:200,json:async()=>({success:false,error:'db'})} as Response)) as typeof fetch);
  assert.equal(rejected.success,false);
  const failed = await sendLeadToCrm(payload, (async () => ({ok:false,status:500,json:async()=>({})} as Response)) as typeof fetch);
  assert.equal(failed.success,false);
});

test('migração mantém upsert por lead_id e campos de aquisição separados', () => {
  const sql = fs.readFileSync('supabase/migrations/20261008235044_blog_attribution_fields.sql','utf8');
  assert.ok(sql.includes('on conflict (lead_id) do update'));
  assert.ok(sql.includes('current_entry_url'));
  assert.ok(sql.includes('channel_derived'));
  const a = mapPayloadToRow({leadId:'lead-123',whatsapp:'1'});
  const b = mapPayloadToRow({leadId:'lead-123',whatsapp:'1'});
  assert.equal(a.lead_id,b.lead_id);
});

test('atualização parcial sem aquisição não inventa canal direto nem autoriza limpar campanha', () => {
  const row = mapPayloadToRow({leadId:'lead-123',status:'Lead gerado',whatsapp:'1'});
  assert.equal(row.current_acquisition_available,false);
  assert.equal(row.origem,null);
  assert.equal(row.channel_derived,null);
  assert.equal(row.gclid,null);
});

test('contexto atual vazio e payload legado mantêm contratos distintos', () => {
  const direct = mapPayloadToRow({leadId:'lead-123',currentAcquisitionAvailable:true,utmSource:'',gclid:''});
  assert.equal(direct.current_acquisition_available,true);
  assert.equal(direct.gclid,null);
  assert.equal(direct.channel_derived,'Direct');
  const legacy = mapPayloadToRow({leadId:'lead-123',utmSource:'google',utmMedium:'cpc',gclid:'legado'});
  assert.equal(legacy.current_acquisition_available,false);
  assert.equal(legacy.gclid,'legado');
  assert.equal(legacy.channel_derived,'Paid Search');
  assert.equal(mapPayloadToRow({leadId:'lead-123',currentAcquisitionAvailable:'true' as any}).current_acquisition_available,false);
});

test('consulta realizada preserva matching Google separado sem enviar conversões reais', async () => {
  const source = fs.readFileSync('api/leads.ts','utf8');
  const start = source.indexOf('async function dispatchConsultaRealizada');
  const end = source.indexOf('async function handlePatch',start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(source.slice(start,end), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const google:any[] = [];
  const meta:any[] = [];
  const context = vm.createContext({
    crypto:{randomUUID:()=> 'qa-evento'},
    process:{env:{GOOGLE_ADS_CONVERSION_ACTION_ID_QUALIFICADO:'qa-action'}},
    splitName:()=>({firstName:undefined,lastName:undefined}),
    sendGoogleEcEvent:async (p:any)=> {google.push(p); return {success:true};},
    sendMetaEvent:async (p:any)=> {meta.push(p); return {success:true};},
    console:{error:()=>assert.fail('dispatcher não deveria falhar')},
  });
  vm.runInContext(code,context);
  const dispatch = vm.runInContext('dispatchConsultaRealizada',context);
  await dispatch({gclid:null,google_match_gclid:'clique-preservado'});
  await dispatch({gclid:'clique-atual',google_match_gclid:'clique-anterior'});
  await dispatch({gclid:'clique-legado'});
  await dispatch({gclid:null,google_match_gclid:null});
  assert.deepEqual(google.map(p=>p.gclid), ['clique-preservado','clique-atual','clique-legado',undefined]);
  assert.equal(meta.length,4);
  assert.ok(google.every((p,i)=>p.eventId===meta[i].eventId));
});

test('eventos editoriais não carregam PII clínica ou de contato', () => {
  const source = fs.readFileSync('public/blog-client.js','utf8').toLowerCase();
  for (const forbidden of ['email','phone','whatsapp','nomecompleto','comportamentohalito','usoantibiotico']) {
    assert.equal(source.includes(forbidden), false, `PII proibida no blog-client: ${forbidden}`);
  }
});

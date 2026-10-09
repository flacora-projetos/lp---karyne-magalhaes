import test from 'node:test';
import assert from 'node:assert/strict';
import cronHandler from '../../api/blog-gsc-cron.ts';
import {buildPrompt} from '../../lib/editorialDraft.mjs';

function response(){return {code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};}

test('revisão Fase 7: falha ao recuperar a fila de publicação não derruba a rotina diária', async()=>{
  const saved={...process.env};const original=globalThis.fetch;
  Object.assign(process.env,{SUPABASE_URL:'https://supabase-preview.test',SUPABASE_SERVICE_ROLE_KEY:'fake-service-role-key-for-tests',CRON_SECRET:'segredo-de-teste',BLOG_PUBLICATION_AUTOMATION_ENABLED:'true'});
  delete process.env.BLOG_GSC_AUTOMATION_ENABLED;
  // Serviço simulado: o banco está indisponível para a fila de publicação.
  globalThis.fetch=(async()=>new Response(JSON.stringify({message:'indisponível'}),{status:400,headers:{'Content-Type':'application/json'}})) as any;
  try{
    const res=response();await cronHandler({method:'GET',headers:{authorization:'Bearer segredo-de-teste'}} as any,res as any);
    assert.equal(res.code,200);assert.equal(res.body.publication.status,'error');assert.equal(res.body.result.status,'disabled');
  }finally{globalThis.fetch=original;process.env=saved;}
});

test('revisão Fase 7: instruções de estilo contra texto com cara de IA chegam ao gerador', ()=>{
  const prompt=buildPrompt({sourceId:'1'},{objective:'x',allowedInternalLinks:[]},[]);
  assert.match(prompt,/Não use travessão/);assert.match(prompt,/marcas de texto gerado por IA/);
  assert.match(prompt,/Não invente diagnóstico/,'regras clínicas anteriores preservadas');
});

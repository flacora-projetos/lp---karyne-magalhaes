import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/editorial-draft.ts';

function response() {
  return {code:0, body:null as any, headers:{} as any, setHeader(k:string,v:string){this.headers[k]=v;}, status(code:number){this.code=code;return this;}, json(body:any){this.body=body;return this;}};
}

test('operação editorial hospedada rejeita acesso anônimo sem chamar banco ou IA', async () => {
  const res = response();
  await handler({method:'POST',headers:{},body:{}} as any,res as any);
  assert.equal(res.code,401);
  assert.equal(res.headers['Cache-Control'],'private, no-store');
});

test('operação já concluída é recuperada sem repetir chamada de IA e conflito não devolve texto', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://editorial-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const body = {sourceId:'12059',briefing:{objective:'revisar'},references:[{url:'https://example.org'}],operationKey:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'};
  const {createHash} = await import('node:crypto');
  const hash = createHash('sha256').update(JSON.stringify({sourceId:body.sourceId,briefing:body.briefing,references:body.references})).digest('hex');
  let conflict = false;
  const calls:string[] = [];
  globalThis.fetch = async (input:any) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({id:'test-user',email:'flacora@gmail.com'}),{headers:{'Content-Type':'application/json'}});
    if (url.includes('/rest/v1/editorial_drafts')) return new Response(JSON.stringify([{operation_key:body.operationKey,status:'draft',request_sha256:conflict ? 'different' : hash,payload_json:{private:'draft'}}]),{headers:{'Content-Type':'application/json'}});
    throw new Error('Chamada externa indevida');
  };
  try {
    for (const expected of [200,409]) {
      const res = response();
      await handler({method:'POST',headers:{authorization:'Bearer test-session'},body} as any,res as any);
      assert.equal(res.code,expected);
      if (conflict) assert.equal(res.body.draft,undefined);
      conflict = true;
    }
    assert.equal(calls.length,4);
    assert.equal(calls.some(url => /deepseek|openrouter/.test(url)),false);
  } finally {globalThis.fetch = originalFetch;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {completeEditorialJson} from '../../lib/editorialAi.mjs';
const env = {DEEPSEEK_API_KEY:'test-private', DEEPSEEK_MODEL:'configured-deepseek', OPENROUTER_API_KEY:'test-private-reserve', OPENROUTER_MODEL:'configured-reserve'};
const success = () => new Response(JSON.stringify({id:'fake', model:'effective', choices:[{finish_reason:'stop',message:{content:'{"sourceId":"1"}'}}],usage:{prompt_tokens:3,completion_tokens:2}}), {status:200});

test('DeepSeek principal usa contrato próprio e registra modelo/uso efetivos', async () => {
  const calls:any[] = [];
  const result = await completeEditorialJson({prompt:'corpus',schema:{},env,fetchImpl:async (url:any, request:any) => {calls.push({url,body:JSON.parse(request.body)}); return success();}});
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.model,env.DEEPSEEK_MODEL);
  assert.deepEqual(calls[0].body.thinking,{type:'enabled'});
  assert.equal(calls[0].body.response_format.type,'json_object');
  assert.equal(result.generator.provider,'deepseek');
  assert.equal(result.generator.model,'effective');
  assert.equal(result.generator.usage.prompt_tokens,3);
});

test('OpenRouter só entra após indisponibilidade explícita e sem campos proprietários', async () => {
  const calls:any[] = [];
  const result = await completeEditorialJson({prompt:'corpus',schema:{},env,fetchImpl:async (url:any, request:any) => {calls.push({url,body:JSON.parse(request.body)}); return calls.length === 1 ? new Response('',{status:503}) : success();}});
  assert.equal(calls.length,2);
  assert.equal(calls[1].body.model,env.OPENROUTER_MODEL);
  assert.equal('thinking' in calls[1].body,false);
  assert.equal('reasoning_effort' in calls[1].body,false);
  assert.equal(result.generator.provider,'openrouter');
  assert.equal(result.generator.attempts[0].status,503);
});

test('configuração, chave recusada e resultado incerto não gastam chamadas extras', async () => {
  let calls = 0;
  const rejected:any = async () => {calls++;return new Response('',{status:401});};
  await assert.rejects(completeEditorialJson({prompt:'x',schema:{},env:{...env,OPENROUTER_MODEL:''},fetchImpl:rejected}), /configuration_missing/);
  assert.equal(calls,0);
  await assert.rejects(completeEditorialJson({prompt:'x',schema:{},env,fetchImpl:rejected}), /http_401/);
  assert.equal(calls,1);
  await assert.rejects(completeEditorialJson({prompt:'x',schema:{},env,fetchImpl:async () => {calls++;throw new Error('network');}}), /transport_result_unknown/);
  assert.equal(calls,2);
});

test('resposta truncada, JSON inválido e falha dos dois fornecedores não viram rascunho', async () => {
  for (const [finish, content, code] of [['length','{}','incomplete_output'],['stop','not json','invalid_json']]) {
    let calls = 0;
    await assert.rejects(completeEditorialJson({prompt:'x',schema:{},env,fetchImpl:async () => {calls++;return new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content}}]}));}}), new RegExp(code));
    assert.equal(calls,1);
  }
  let calls = 0;
  await assert.rejects(completeEditorialJson({prompt:'x',schema:{},env,fetchImpl:async () => {calls++;return new Response('',{status:429});}}), /http_429/);
  assert.equal(calls,2);
});

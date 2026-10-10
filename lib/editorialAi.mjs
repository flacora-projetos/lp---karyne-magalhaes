export class EditorialAiError extends Error {
  constructor(code, provider, retryable = false) {
    super(`${provider}: ${code}`);
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
  }
}

// Claude entra na frente só quando configurado; DeepSeek e OpenRouter seguem obrigatórios como reserva.
export function editorialProviders(env = process.env) {
  const anthropic = env.ANTHROPIC_API_KEY?.trim() && env.ANTHROPIC_MODEL?.trim()
    ? [{name:'anthropic', url:'https://api.anthropic.com/v1/messages', key:env.ANTHROPIC_API_KEY, model:env.ANTHROPIC_MODEL}]
    : [];
  const providers = [
    {name:'deepseek', url:'https://api.deepseek.com/chat/completions', key:env.DEEPSEEK_API_KEY, model:env.DEEPSEEK_MODEL},
    {name:'openrouter', url:'https://openrouter.ai/api/v1/chat/completions', key:env.OPENROUTER_API_KEY, model:env.OPENROUTER_MODEL},
  ];
  for (const provider of providers) {
    if (!provider.key?.trim() || !provider.model?.trim()) throw new EditorialAiError('configuration_missing', provider.name);
  }
  return [...anthropic, ...providers];
}

// Structured outputs não aceita restrições de tamanho de lista; o validateDraft continua checando minItems.
function withoutArrayLimits(schema) {
  if (Array.isArray(schema)) return schema.map(withoutArrayLimits);
  if (!schema || typeof schema !== 'object') return schema;
  const {minItems: _minItems, maxItems: _maxItems, ...rest} = schema;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, withoutArrayLimits(value)]));
}

const SYSTEM_PROMPT = 'Você é um assistente editorial restrito. Escreva em pt-BR. Retorne somente JSON conforme o schema fornecido; rascunho nunca é aprovação clínica.';

async function completeWithAnthropic({provider, prompt, schema, maxTokens, timeoutMs, fetchImpl, startedAt, attempts}) {
  const body = {
    model:provider.model, max_tokens:maxTokens,
    // Haiku 5.5 recusa temperature fora do padrão; o schema garante tipos de bloco, campos e enums.
    output_config:{effort:'low', format:{type:'json_schema', schema:withoutArrayLimits(schema)}},
    system:SYSTEM_PROMPT,
    messages:[{role:'user', content:prompt}],
  };
  const headers = {'Content-Type':'application/json', 'x-api-key':provider.key, 'anthropic-version':'2023-06-01'};
  let response;
  try {
    response = await fetchImpl(provider.url, {method:'POST', headers, body:JSON.stringify(body), signal:AbortSignal.timeout(timeoutMs)});
  } catch {
    throw new EditorialAiError('transport_result_unknown', provider.name);
  }
  if (!response.ok) {
    attempts.push({provider:provider.name, model:provider.model, status:response.status, usage:null});
    return {retryable:response.status === 429 || response.status >= 500, status:response.status};
  }
  let result;
  try { result = await response.json(); }
  catch { throw new EditorialAiError('invalid_response', provider.name); }
  if (result.stop_reason === 'refusal') throw new EditorialAiError('refused_output', provider.name);
  if (result.stop_reason !== 'end_turn') throw new EditorialAiError('incomplete_output', provider.name);
  const text = (result.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
  let draft;
  try { draft = JSON.parse(text); }
  catch { throw new EditorialAiError('invalid_json', provider.name); }
  return {draft, generator:{provider:provider.name, api:'messages', model:result.model || provider.model, requestedModel:provider.model, responseId:result.id || null, startedAt, usage:result.usage || null, attempts, externalApiSuccessful:true, billableUsage:'nao_confirmado', tools:[]}};
}

export async function completeEditorialJson({prompt, schema, env = process.env, fetchImpl = fetch}) {
  const providers = editorialProviders(env);
  const maxTokens = Number(env.BLOG_AI_MAX_TOKENS || 8192);
  const timeoutMs = Number(env.BLOG_AI_TIMEOUT_MS || 90000);
  if (!Number.isInteger(maxTokens) || maxTokens < 1024 || maxTokens > 16384 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new EditorialAiError('invalid_limits', 'configuration');
  }
  const attempts = [];
  for (const provider of providers) {
    const startedAt = new Date().toISOString();
    if (provider.name === 'anthropic') {
      const outcome = await completeWithAnthropic({provider, prompt, schema, maxTokens, timeoutMs, fetchImpl, startedAt, attempts});
      if (outcome.draft) return outcome;
      if (outcome.retryable) continue;
      throw new EditorialAiError(`http_${outcome.status}`, provider.name);
    }
    const body = {
      model:provider.model, stream:false, max_tokens:maxTokens,
      response_format:{type:'json_object'},
      messages:[
        {role:'system', content:SYSTEM_PROMPT},
        {role:'user', content:`${prompt}\n\nJSON SCHEMA\n${JSON.stringify(schema)}`},
      ],
    };
    const headers = {'Content-Type':'application/json', Authorization:`Bearer ${provider.key}`};
    if (provider.name === 'deepseek') {
      body.thinking = {type:env.DEEPSEEK_THINKING_ENABLED === 'false' ? 'disabled' : 'enabled'};
      body.reasoning_effort = env.DEEPSEEK_REASONING_EFFORT || 'high';
    } else {
      headers['HTTP-Referer'] = env.OPENROUTER_APP_URL || 'https://tratamentodomauhalito.com.br';
      headers['X-Title'] = env.OPENROUTER_APP_TITLE || 'Karyne - editorial privado';
    }
    let response;
    try {
      response = await fetchImpl(provider.url, {method:'POST', headers, body:JSON.stringify(body), signal:AbortSignal.timeout(timeoutMs)});
    } catch {
      // Sem resposta, o fornecedor pode ter processado a chamada. Evitar nova cobrança automática.
      throw new EditorialAiError('transport_result_unknown', provider.name);
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      attempts.push({provider:provider.name, model:provider.model, status:response.status, usage:null});
      if (retryable && provider.name === 'deepseek') continue;
      throw new EditorialAiError(`http_${response.status}`, provider.name);
    }
    let result;
    try { result = await response.json(); }
    catch { throw new EditorialAiError('invalid_response', provider.name); }
    const choice = result.choices?.[0];
    if (choice?.finish_reason !== 'stop') throw new EditorialAiError('incomplete_output', provider.name);
    let draft;
    try { draft = JSON.parse(choice.message.content); }
    catch { throw new EditorialAiError('invalid_json', provider.name); }
    return {draft, generator:{provider:provider.name, api:'chat/completions', model:result.model || provider.model, requestedModel:provider.model, responseId:result.id || null, startedAt, usage:result.usage || null, attempts, externalApiSuccessful:true, billableUsage:'nao_confirmado', tools:[]}};
  }
  throw new EditorialAiError('providers_unavailable', 'openrouter');
}

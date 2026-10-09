import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createHash} from 'node:crypto';
import {requireAuth} from '../lib/requireAuth.js';
import {getSupabaseAdmin} from '../lib/supabaseAdmin.js';
import {completeEditorialJson, editorialProviders, EditorialAiError} from '../lib/editorialAi.mjs';
import {buildPrompt, validateDraft, validateBriefing, RESPONSE_SCHEMA, buildOriginalPrompt, validateOriginalBriefing, validateOriginalDraft, ORIGINAL_RESPONSE_SCHEMA} from '../lib/editorialDraft.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({success:false});
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getSupabaseAdmin();
  if (req.method === 'GET') {
    if (typeof req.query.id === 'string') {
      const {data, error} = await db.from('editorial_drafts').select('*').eq('operation_key', req.query.id).maybeSingle();
      return error ? res.status(500).json({success:false}) : res.status(data ? 200 : 404).json({success:Boolean(data), draft:data});
    }
    try { return res.status(200).json({success:true, providers:editorialProviders().map(p => ({provider:p.name, model:p.model})), mode:'human_review_required'}); }
    catch { return res.status(503).json({success:false, error:'Configuração editorial incompleta'}); }
  }
  const {sourceId, briefing, references, operationKey, mode} = req.body || {};
  const original = mode === 'original';
  const validKey = typeof operationKey === 'string' && /^[0-9a-f-]{36}$/i.test(operationKey);
  const validTarget = original ? sourceId === undefined : (mode === undefined || mode === 'legacy') && typeof sourceId === 'string' && /^\d+$/.test(sourceId);
  if (!validTarget || !validKey || !briefing || !Array.isArray(references) || !references.length || JSON.stringify(req.body).length > 40000) {
    return res.status(400).json({success:false, generationNotStarted:true, error:'Pauta, referências e identificador da operação são obrigatórios'});
  }
  // A pauta original não carrega fonte; o hash separa as duas modalidades sem alterar o hash histórico da adaptação.
  const requestHash = createHash('sha256').update(JSON.stringify(original ? {mode:'original', briefing, references} : {sourceId, briefing, references})).digest('hex');
  const {data:existing, error:lookupError} = await db.from('editorial_drafts').select('*').eq('operation_key', operationKey).maybeSingle();
  if (lookupError) return res.status(500).json({success:false, generationNotStarted:true, error:'Falha ao consultar operação'});
  if (existing) {
    if (existing.request_sha256 !== requestHash) return res.status(409).json({success:false, error:'Identificador já usado para outra geração'});
    if (existing.status === 'draft') return res.status(200).json({success:true, draft:existing, reused:true});
    if (existing.status === 'generating' || existing.status === 'uncertain') return res.status(202).json({success:false, draft:existing, reconciliationRequired:true});
    return res.status(409).json({success:false, draft:existing, error:'Geração anterior falhou; confirme o estado antes de iniciar outra operação'});
  }
  try { if (original) validateOriginalBriefing(briefing, references); else validateBriefing(briefing, references); }
  catch { return res.status(400).json({success:false, generationNotStarted:true, error:'Pauta ou referências verificadas incompletas'}); }
  try { editorialProviders(); }
  catch { return res.status(503).json({success:false, generationNotStarted:true, error:'Configuração editorial incompleta'}); }
  let row: any = null;
  if (!original) {
    const lookup = await db.from('editorial_sources').select('id,external_id,source_url,source_title,normalized_excerpt,normalized_body_text,published_at_source,modified_at_source').eq('source_system','wordpress_karyne').eq('external_id',sourceId).maybeSingle();
    row = lookup.data;
    if (lookup.error || !String(row?.normalized_body_text||'').trim()) return res.status(422).json({success:false, generationNotStarted:true, error:'Fonte sem conteúdo disponível'});
  }
  const claim: Record<string, unknown> = original
    ? {operation_key:operationKey, source_id:null, draft_kind:'original', request_sha256:requestHash, status:'generating', created_by:user.id}
    : {operation_key:operationKey, source_id:row.id, request_sha256:requestHash, status:'generating', created_by:user.id};
  const {error:claimError} = await db.from('editorial_drafts').insert(claim);
  if (claimError) return res.status(claimError.code === '23505' ? 409 : 500).json({success:false, ...(claimError.code==='23505'?{generationNotStarted:true}:{}), error:original?'Esta pauta já possui geração pendente ou a operação está indisponível; consulte os rascunhos antes de repetir':'Esta fonte já possui geração pendente ou a operação está indisponível; consulte os rascunhos antes de repetir'});
  try {
    let draft: any, generator: any;
    if (original) {
      ({draft, generator} = await completeEditorialJson({prompt:buildOriginalPrompt(briefing, references), schema:ORIGINAL_RESPONSE_SCHEMA}));
      validateOriginalDraft(draft, {briefing, references});
    } else {
      const source = {sourceId:row.external_id, sourceUrl:row.source_url, title:row.source_title, excerpt:row.normalized_excerpt, contentText:row.normalized_body_text, publishedAt:row.published_at_source, modifiedAt:row.modified_at_source};
      ({draft, generator} = await completeEditorialJson({prompt:buildPrompt(source, briefing, references), schema:RESPONSE_SCHEMA}));
      validateDraft(draft, {source, briefing, references});
    }
    const payload = {...draft, ...(original ? {origin:'original', topic:briefing.topic} : {}), generator, status:'draft', approval:{editorial:false, clinical:false, client:false}};
    const {data:saved,error} = await db.from('editorial_drafts').update({status:'draft', payload_json:payload, last_error_code:null, updated_at:new Date().toISOString()}).eq('operation_key',operationKey).eq('status','generating').select('operation_key').maybeSingle();
    if (error||!saved) throw new Error('storage_result_unknown');
    return res.status(201).json({success:true, operationKey, draft:payload});
  } catch (error) {
    const uncertain = (error instanceof EditorialAiError && error.code === 'transport_result_unknown') || (error instanceof Error && error.message==='storage_result_unknown');
    const status = uncertain ? 'uncertain' : 'failed';
    const code = error instanceof EditorialAiError ? error.code : 'generation_failed';
    await db.from('editorial_drafts').update({status,last_error_code:code,updated_at:new Date().toISOString()}).eq('operation_key',operationKey).eq('status','generating');
    return res.status(uncertain ? 202 : 502).json({success:false, operationKey, status, reconciliationRequired:uncertain, error:uncertain ? 'Resultado da chamada de IA ficou incerto; verifique esta operação antes de qualquer nova geração' : 'Geração não concluída; não repetir automaticamente a chamada'});
  }
}

import { supabase } from './supabaseClient';
import type { Lead, LeadCommercialUpdate } from './types';

export interface LeadFilters {
  periodoDe?: string; // YYYY-MM-DD (criado_em >=)
  periodoAte?: string; // YYYY-MM-DD (criado_em <=)
  plataforma?: string; // origem
  campanha?: string; // utm_campaign
  criativo?: string; // utm_content
  termo?: string; // utm_term
  cidade?: string;
  statusComercial?: string;
  responsavel?: string;
  busca?: string; // texto livre (nome/whatsapp/email)
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  });

  const res = await fetch(`/api/leads?${params.toString()}`, {
    headers: { ...(await authHeader()) },
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao carregar leads');
  }
  return json.leads as Lead[];
}

export async function updateLead(
  leadId: string,
  update: LeadCommercialUpdate,
): Promise<Lead> {
  const res = await fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
    body: JSON.stringify(update),
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao atualizar lead');
  }
  return json.lead as Lead;
}

async function parsePrivateResponse(res: Response, fallback: string) {
  if (res.status === 401) throw new Error('unauthorized');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || fallback);
  return json;
}

export async function fetchBlogGscReport(page = 1, pageSize = 20): Promise<any> {
  const params = new URLSearchParams({ page:String(page), pageSize:String(pageSize) });
  const res = await fetch(`/api/blog-gsc?${params}`, { headers: { ...(await authHeader()) } });
  return (await parsePrivateResponse(res, 'Falha ao carregar status Blog/GSC')).report;
}

export async function blogGscAction(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/blog-gsc', { method:'POST', headers:{'Content-Type':'application/json',...(await authHeader())}, body:JSON.stringify(payload) });
  return (await parsePrivateResponse(res, 'Operação Blog/GSC falhou')).result;
}

export async function blogAdminGet(params: Record<string,string|number|undefined>): Promise<any> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key,value]) => { if(value !== undefined && String(value) !== '') search.set(key,String(value)); });
  const res = await fetch(`/api/blog-admin?${search}`, { headers:{...(await authHeader())} });
  return parsePrivateResponse(res,'Falha ao carregar dados editoriais');
}

export async function blogAdminPost(payload: Record<string,unknown>): Promise<any> {
  const res = await fetch('/api/blog-admin', { method:'POST', headers:{'Content-Type':'application/json',...(await authHeader())}, body:JSON.stringify(payload) });
  return parsePrivateResponse(res,'Operação editorial falhou');
}

export async function fetchEditorialDraft(operationKey: string): Promise<any> {
  const res = await fetch(`/api/editorial-draft?id=${encodeURIComponent(operationKey)}`, { headers:{...(await authHeader())} });
  if (res.status === 404) return null;
  return parsePrivateResponse(res,'Falha ao consultar geração editorial');
}

export async function generateEditorialDraft(payload: Record<string,unknown>): Promise<any> {
  const res = await fetch('/api/editorial-draft', { method:'POST', headers:{'Content-Type':'application/json',...(await authHeader())}, body:JSON.stringify(payload) });
  if (res.status === 202) {
    const json = await res.json().catch(() => ({}));
    return { ...json, pending:true };
  }
  if (res.status === 401) throw new Error('unauthorized');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const error = new Error(json.error || 'Falha ao gerar rascunho editorial') as Error & { generationNotStarted?: boolean };
    if (json.generationNotStarted === true) error.generationNotStarted = true;
    throw error;
  }
  return json;
}
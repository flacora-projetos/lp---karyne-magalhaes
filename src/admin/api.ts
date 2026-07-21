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
  const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
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

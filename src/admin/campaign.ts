import type { Lead } from './types';

type CampaignLead = Pick<Lead, 'utm_campaign' | 'entry_article_slug' | 'last_article_slug' | 'editorial_cta_id' | 'editorial_cta_destination'>;

export function blogContactArticle(lead: CampaignLead): string | null {
  if (lead.editorial_cta_id !== 'contato_whatsapp' || lead.editorial_cta_destination !== 'whatsapp') return null;
  return lead.last_article_slug || lead.entry_article_slug || null;
}

export function campaignLabel(lead: CampaignLead, titles: Record<string, string>): string {
  const slug = blogContactArticle(lead);
  if (slug) return `Blog · ${titles[slug] || slug}`;
  return lead.utm_campaign || '';
}

export function matchesCampaign(lead: CampaignLead, search: string, titles: Record<string, string>): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const slug = blogContactArticle(lead);
  return [campaignLabel(lead, titles), lead.utm_campaign || '', slug || ''].some(value => normalize(value).includes(normalize(search.trim())));
}

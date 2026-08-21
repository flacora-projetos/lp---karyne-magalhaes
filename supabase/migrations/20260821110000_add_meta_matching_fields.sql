begin;

alter table public.leads
  add column if not exists meta_fbp text,
  add column if not exists meta_fbc text,
  add column if not exists client_ip text;

comment on column public.leads.meta_fbp is 'Meta browser identifier (_fbp) captured at lead creation for later CAPI matching.';
comment on column public.leads.meta_fbc is 'Meta click identifier (_fbc) captured/normalized at lead creation for later CAPI matching.';
comment on column public.leads.client_ip is 'Original visitor IP captured server-side at lead ingestion for later CAPI matching.';

commit;

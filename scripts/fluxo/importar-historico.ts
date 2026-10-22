/**
 * Importa uma vez o histórico do CRM do site para o Dácora Fluxo, pelo mesmo
 * caminho dos leads novos (lib/crmFluxo.ts): contato com a data real de
 * chegada e depois a etapa atual. Reexecutar é seguro (o Fluxo reconhece a ref).
 *
 *   SITE_ENV=<.env.local do site> FLUXO_ENV=<.env.local do Fluxo> npx tsx scripts/fluxo/importar-historico.ts          # ensaio: só conta
 *   SITE_ENV=... FLUXO_ENV=... npx tsx scripts/fluxo/importar-historico.ts --gravar                                       # importa
 *
 * Chaves vêm dos arquivos e nunca são impressas.
 */
import { readFileSync } from 'node:fs';
import { fluxoContato, fluxoEtapa } from '../../lib/crmFluxo';

function lerEnv(caminho: string | undefined): Record<string, string> {
  if (!caminho) throw new Error('informe SITE_ENV e FLUXO_ENV');
  const a: Record<string, string> = {};
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const i = linha.indexOf('=');
    if (i > 0 && !linha.trimStart().startsWith('#')) a[linha.slice(0, i).trim()] = linha.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return a;
}

const site = lerEnv(process.env.SITE_ENV);
const fluxo = lerEnv(process.env.FLUXO_ENV);
const GRAVAR = process.argv.includes('--gravar');
const BASE = `${fluxo.SUPABASE_URL}/functions/v1`;
const CHAVE = fluxo.CRM_CHAVE_RESULTADOS_KARYNE;
if (!CHAVE || !site.SUPABASE_SERVICE_ROLE_KEY) throw new Error('chave ausente em algum dos arquivos');

async function leads(): Promise<Record<string, unknown>[]> {
  const todos: Record<string, unknown>[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${site.SUPABASE_URL}/rest/v1/leads?select=*&order=criado_em&offset=${off}&limit=1000`, {
      headers: { apikey: site.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${site.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) throw new Error(`leitura do site falhou (${r.status})`);
    const pagina = await r.json();
    todos.push(...pagina);
    if (pagina.length < 1000) return todos;
  }
}

async function enviar(porta: string, corpo: object): Promise<string> {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(`${BASE}/${porta}`, {
      method: 'POST', headers: { Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j.situacao;
    if (r.status < 500 || tentativa >= 3) return `erro ${r.status}: ${j.erro ?? ''}`;
  }
}

const conta = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const todos = await leads();
const comContato = todos.map((l) => ({ lead: l, contato: fluxoContato(l) })).filter((x) => x.contato);
const comEtapa = comContato
  .filter((x) => x.lead.status_comercial && x.lead.status_comercial !== 'contato_realizado')
  .sort((a, b) => String(a.lead.atualizado_em).localeCompare(String(b.lead.atualizado_em)));
console.log(`leads no site: ${todos.length} · com WhatsApp: ${comContato.length} · com etapa além da primeira: ${comEtapa.length}`);

if (!GRAVAR) {
  console.log('ensaio: nada gravado. Rode com --gravar para importar.');
  process.exit(0);
}

const contatos = new Map<string, number>();
for (const { contato } of comContato) conta(contatos, await enviar('contato-externo', contato!));
console.log('contatos:', Object.fromEntries(contatos));

const etapas = new Map<string, number>();
for (const { lead } of comEtapa) {
  const quando = new Date(String(lead.atualizado_em));
  const corpo = fluxoEtapa(lead, String(lead.status_comercial), Number.isNaN(quando.getTime()) ? new Date() : quando);
  if (corpo) conta(etapas, await enviar('resultado-externo', corpo));
}
console.log('etapas:', Object.fromEntries(etapas));

/**
 * Entrada das prévias. Monta a página real (mesmos componentes do site) e troca
 * só os blocos da opção escolhida pelo montador (__OPCAO__).
 *
 * Trava de prévia: nada sai daqui. Envios de dados viram no-op, WhatsApp e
 * links internos do site mostram um aviso em vez de abrir.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Pagina, type Opcao } from './Pagina';
import './estilo.css';

declare const __OPCAO__: Opcao;

function aviso(texto: string) {
  let el = document.getElementById('aviso-previa');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso-previa';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add('mostra');
  window.clearTimeout((el as any)._t);
  (el as any)._t = window.setTimeout(() => el!.classList.remove('mostra'), 4200);
}

// Nenhum dado sai da prévia (cadastro, planilha, Meta, Google).
const respostaVazia = () => Promise.resolve(new Response('{"ok":true,"previa":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
window.fetch = (() => respostaVazia()) as typeof fetch;
if (navigator.sendBeacon) navigator.sendBeacon = () => true;

const abrirOriginal = window.open.bind(window);
window.open = ((url?: string | URL, ...resto: unknown[]) => {
  const u = String(url ?? '');
  if (/wa\.me|whatsapp/i.test(u)) {
    aviso('Prévia: aqui abriria o WhatsApp da clínica com as respostas. Nada foi enviado.');
    return null;
  }
  return abrirOriginal(u, ...(resto as [string?, string?]));
}) as typeof window.open;

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (/wa\.me|whatsapp/i.test(href)) {
    e.preventDefault();
    aviso('Prévia: aqui abriria o WhatsApp da clínica. Nada foi enviado.');
  } else if (href.startsWith('/')) {
    e.preventDefault();
    aviso('Prévia: este link leva a outra página do site (blog ou política de privacidade).');
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina opcao={__OPCAO__} />
  </StrictMode>,
);

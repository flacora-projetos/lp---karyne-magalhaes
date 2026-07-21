export const brl = (v: number | null | undefined): string => {
  const n = typeof v === 'number' ? v : 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const pct = (num: number, den: number): string => {
  if (!den) return '—';
  return `${((num / den) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

export const dateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const dateShort = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// date (YYYY-MM-DD) sem conversão de fuso
export const dateOnly = (v: string | null): string => {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
};

// Tempo relativo curto em pt-BR ("agora", "há 3 h", "há 5 d", "há 2 sem").
export const timeAgo = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `há ${dias} d`;
  const sem = Math.floor(dias / 7);
  if (sem < 5) return `há ${sem} sem`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  return dateShort(iso);
};

// Iniciais (1–2 letras) a partir do nome, para o avatar do card.
export const initials = (nome: string | null): string => {
  if (!nome) return '?';
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

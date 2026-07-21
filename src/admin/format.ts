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

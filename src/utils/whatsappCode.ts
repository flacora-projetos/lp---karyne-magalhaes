// Sem 0/O/1/I para não confundir quem lê.
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const novoCodigoWhatsapp = (tamanho = 5): string => {
  const bytes = new Uint8Array(tamanho);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
};

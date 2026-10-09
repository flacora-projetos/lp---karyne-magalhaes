import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runBlogGscCycle } from '../lib/blogGsc.js';

export function validCronSecret(header: string | undefined, secret: string | undefined) {
  if (!header || !secret || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' });
  if (process.env.BLOG_GSC_AUTOMATION_ENABLED !== 'true') {
    return res.status(503).json({ success: false, error: 'automation_disabled' });
  }
  if (!validCronSecret(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const result = await runBlogGscCycle();
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('[Blog GSC] rotina automática falhou:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(500).json({ success: false, error: 'blog_gsc_cycle_failed' });
  }
}
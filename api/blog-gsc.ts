import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/requireAuth.js';
import {
  confirmPublicationInProduction,
  establishGscBaseline,
  preparePublicationRelease,
  readBlogGscReport,
} from '../lib/blogGsc.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ success: false, error: 'Método não permitido' });
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, report: await readBlogGscReport() });
    }

    const action = req.body?.action;
    if (action === 'baseline') {
      const expectedSitemapSha256 = String(req.body?.expectedSitemapSha256 || '');
      const minGoogleLastSubmitted = req.body?.minGoogleLastSubmitted ? String(req.body.minGoogleLastSubmitted) : undefined;
      const result = await establishGscBaseline({ expectedSitemapSha256, minGoogleLastSubmitted });
      return res.status(200).json({ success: true, result });
    }
    if (action === 'prepare-publication') {
      const result = await preparePublicationRelease({
        articleVersionId: String(req.body?.articleVersionId || ''),
        canonicalUrl: String(req.body?.canonicalUrl || ''),
        operationKey: String(req.body?.operationKey || ''),
        contentSha256: String(req.body?.contentSha256 || ''),
        presentationSha256: String(req.body?.presentationSha256 || ''),
        releaseSha256: String(req.body?.releaseSha256 || ''),
        htmlSha256: String(req.body?.htmlSha256 || ''),
      });
      return res.status(200).json({ success: true, result });
    }
    if (action === 'confirm-publication') {
      const operationKey = String(req.body?.operationKey || '');
      const result = await confirmPublicationInProduction({ operationKey });
      return res.status(200).json({ success: true, result });
    }
    return res.status(400).json({ success: false, error: 'Ação administrativa inválida' });
  } catch (error) {
    console.error('[Blog GSC] operação administrativa falhou:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(500).json({ success: false, error: 'Operação Blog/GSC falhou' });
  }
}
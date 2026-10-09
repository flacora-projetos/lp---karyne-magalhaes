import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/requireAuth.js';
import {
  confirmPublicationInProduction,
  establishGscBaseline,
  preparePublicationRelease,
  readBlogGscReport,
  runBlogGscCycle,
} from '../lib/blogGsc.js';
import { setAutomationControl } from '../lib/blogAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ success: false, error: 'Método não permitido' });
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const page = Number.parseInt(String(req.query.page || '1'), 10) || 1;
      const pageSize = Number.parseInt(String(req.query.pageSize || '20'), 10) || 20;
      const report = await readBlogGscReport({ page, pageSize });
      return res.status(200).json({ success: true, report: { ...report, infrastructure: { enabled: process.env.BLOG_GSC_AUTOMATION_ENABLED === 'true', configured_schedule: 'Diariamente às 06:00 (America/Sao_Paulo)', schedule_expression: '0 9 * * *' } } });
    }

    const action = req.body?.action;
    if (action === 'run-now') {
      if (process.env.BLOG_GSC_AUTOMATION_ENABLED !== 'true') return res.status(503).json({ success:false, error:'automation_disabled' });
      const result = await runBlogGscCycle(new Date(), { source:'manual', actorUserId:user.id });
      return res.status(200).json({ success:true, result });
    }
    if (action === 'set-automation') {
      const result = await setAutomationControl(req.body, user.id);
      return res.status(200).json({ success:true, result });
    }
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
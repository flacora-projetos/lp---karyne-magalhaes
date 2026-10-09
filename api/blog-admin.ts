import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/requireAuth.js';
import {
  APPROVED_BLOG_ASSETS,
  exportApprovedSnapshot,
  getArticleDetail,
  getBlogOverview,
  getReviewQueue,
  getSourceDetail,
  listArticles,
  listSources,
  listDrafts,
  renderPrivatePreview,
  promoteDraft,
  recordReview,
  saveArticleVersion,
  setPublishIntent,
  queueArticlePublication,
  retryArticlePublication,
  getPublicationAutomationControl,
  setPublicationAutomationControl,
} from '../lib/blogAdmin.js';

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({success:false,error:'Método não permitido'});
  const user = await requireAuth(req,res); if(!user) return;
  try {
    if(req.method==='GET') {
      const view=one(req.query.view) || 'overview';
      if(view==='overview') return res.status(200).json({success:true,overview:await getBlogOverview()});
      if(view==='articles') return res.status(200).json({success:true,...await listArticles({q:one(req.query.q),status:one(req.query.status),publication:one(req.query.publication),page:one(req.query.page),pageSize:one(req.query.pageSize)})});
      if(view==='drafts') return res.status(200).json({success:true,...await listDrafts({q:one(req.query.q),page:one(req.query.page),pageSize:one(req.query.pageSize)})});
      if(view==='article') return res.status(200).json({success:true,detail:await getArticleDetail(String(one(req.query.id)||'')),assets:APPROVED_BLOG_ASSETS});
      if(view==='sources') return res.status(200).json({success:true,...await listSources({q:one(req.query.q),page:one(req.query.page),pageSize:one(req.query.pageSize)})});
      if(view==='source') return res.status(200).json({success:true,source:await getSourceDetail(String(one(req.query.id)||''))});
      if(view==='review-queue') return res.status(200).json({success:true,...await getReviewQueue({q:one(req.query.q),page:one(req.query.page),pageSize:one(req.query.pageSize)})});
      if(view==='assets') return res.status(200).json({success:true,assets:APPROVED_BLOG_ASSETS});
      if(view==='publication-control') return res.status(200).json({success:true,control:await getPublicationAutomationControl()});
      return res.status(400).json({success:false,error:'Consulta administrativa inválida'});
    }
    const body=req.body && typeof req.body==='object' ? req.body : {};
    if(JSON.stringify(body).length>120000) return res.status(413).json({success:false,error:'Payload editorial excede o limite'});
    if(body.action==='save-version') return res.status(200).json({success:true,result:await saveArticleVersion(body,user.id)});
    if(body.action==='promote-draft') return res.status(200).json({success:true,result:await promoteDraft(body,user.id)});
    if(body.action==='preview') return res.status(200).json({success:true,html:await renderPrivatePreview(body)});
    if(body.action==='review') return res.status(200).json({success:true,result:await recordReview(body,user.id)});
    if(body.action==='set-publish-intent') return res.status(200).json({success:true,result:await setPublishIntent(body,user.id)});
    if(body.action==='queue-publication') return res.status(200).json({success:true,result:await queueArticlePublication(body,user.id)});
    if(body.action==='retry-publication') return res.status(200).json({success:true,result:await retryArticlePublication(body,user.id)});
    if(body.action==='set-publication-control') return res.status(200).json({success:true,result:await setPublicationAutomationControl(body,user.id)});
    if(body.action==='export-snapshot') return res.status(200).json({success:true,snapshot:await exportApprovedSnapshot(String(body.articleId||''),String(body.versionId||''),user.id)});
    return res.status(400).json({success:false,error:'Ação administrativa inválida'});
  } catch(error) {
    const raw=error instanceof Error ? error.message : 'Falha administrativa';
    console.error('[Blog Admin] operação não concluída');
    const allowed=[
      'Status editorial inválido','Identificador já usado para outra operação','Slug de artigo existente deve ser preservado','Informe a correção solicitada','Identifique o responsável clínico','Evidência da revisão inválida',
      'Artigo inválido','Artigo não encontrado','Conflito de versão; recarregue antes de salvar','A publicação já entrou em etapa crítica; não é seguro editar esta versão agora','A publicação já entrou em etapa crítica; a revisão não pode ser alterada agora','A publicação já entrou em etapa crítica; a intenção não pode ser alterada agora','A versão mudou; recarregue antes de escolher a publicação','A versão mudou; recarregue antes de publicar','Intenção de publicação inválida','Publicação manual inválida','Nova tentativa de publicação inválida','Aprovações editorial e clínica atuais são obrigatórias','Limite de tentativas de publicação atingido','Só falhas confirmadas podem ser repetidas; estado incerto exige reconciliação','Informe o motivo da pausa de publicação','Controle de publicação mudou; atualize antes de tentar novamente','Conteúdo inválido','Campo de texto obrigatório','Campo de texto excede o limite','Slug inválido','Corpo editorial inválido','Bloco editorial não suportado','Lista editorial inválida','Referência externa inválida','Slug de link interno inválido','Link interno inválido','Imagem fora do acervo aprovado','Identificadores inválidos','Rascunho não encontrado','Rascunho ainda não está pronto','Escolha uma apresentação no editor antes de promover este rascunho','Este slug já existe no acervo editorial','Dados da revisão inválidos','Decisão de revisão inválida','A revisão ficou desatualizada; recarregue a fila','Versão não encontrada','Somente a versão de trabalho atual pode ser exportada','Aprovações editorial e clínica atuais são obrigatórias','Versão sem payload/hash exportável','Hashes persistidos não correspondem ao conteúdo exportado'
    ];
    const message=allowed.find(prefix=>raw.startsWith(prefix)) || 'Operação editorial não concluída';
    return res.status(/Conflito|desatualizada|já existe/i.test(message)?409:400).json({success:false,error:message});
  }
}

import type { VercelRequest,VercelResponse } from '@vercel/node';
import { claimPublicationOperation,progressPublication,reconcilePublicationOperation,validIntegrationSecret } from '../lib/blogPublisher.js';

function one(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value;}

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(!['GET','POST'].includes(req.method||''))return res.status(405).json({success:false,error:'Método não permitido'});
  if(!validIntegrationSecret(req.headers.authorization,process.env.BLOG_PUBLISH_INTEGRATION_SECRET))return res.status(401).json({success:false,error:'Integração não autenticada'});
  try{
    if(req.method==='GET'){
      const operationId=String(one(req.query.operationId)||'');
      return res.status(200).json({success:true,result:await reconcilePublicationOperation(operationId)});
    }
    const body=req.body&&typeof req.body==='object'?req.body:{};
    if(JSON.stringify(body).length>12000)return res.status(413).json({success:false,error:'Payload excede o limite'});
    if(body.action==='claim')return res.status(200).json({success:true,result:await claimPublicationOperation(String(body.operationId||''),String(body.executorRunId||''))});
    if(body.action==='progress')return res.status(200).json({success:true,result:await progressPublication(body)});
    if(body.action==='reconcile')return res.status(200).json({success:true,result:await reconcilePublicationOperation(String(body.operationId||''))});
    return res.status(400).json({success:false,error:'Ação de integração inválida'});
  }catch(error){
    console.error('[Blog Publish Integration] operação não concluída');
    const message=error instanceof Error?error.message:'Falha de integração';
    const safe=/^(Operação de publicação inválida|Parâmetros do executor inválidos|Lease de publicação inválido|Estado de publicação inválido|Hash HTML inválido|Não foi possível reservar a publicação|Falha ao registrar progresso da publicação|Operação de publicação não encontrada)$/.test(message)?message:'Integração de publicação não concluída';
    return res.status(400).json({success:false,error:safe});
  }
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readArticles} from './core.mjs';
import {buildSnapshotRelease} from './phase6-release.mjs';

const PRIVATE_KEYS=new Set(['reviews','reviewer_name','recorded_by_user_id','reviewed_at','evidence_json','set_by_user_id','lease_token','snapshot_json']);
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function safeSlug(value){return typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);}

export function assertNoPrivateFields(value,pathName='snapshot'){
  if(Array.isArray(value)){value.forEach((item,index)=>assertNoPrivateFields(item,`${pathName}[${index}]`));return true;}
  if(!value||typeof value!=='object')return true;
  for(const [key,item] of Object.entries(value)){
    if(PRIVATE_KEYS.has(key))throw new Error(`Campo privado não pode ser materializado: ${pathName}.${key}`);
    assertNoPrivateFields(item,`${pathName}.${key}`);
  }
  return true;
}

export function normalizedPublicationSnapshot(snapshot){
  if(!snapshot||snapshot.kind!=='karyne-blog-publication-snapshot'||snapshot.schemaVersion!==1)throw new Error('Snapshot da Fase 7 inválido');
  assertNoPrivateFields(snapshot);
  return {...snapshot,kind:'karyne-blog-approved-snapshot'};
}

export function materializePublicationSnapshot(snapshot,inputDir){
  const normalized=normalizedPublicationSnapshot(snapshot);
  const slug=normalized?.article?.slug;if(!safeSlug(slug))throw new Error('Slug inseguro no snapshot');
  const published=readArticles(inputDir);
  const {manifest,selected}=buildSnapshotRelease(normalized,published);
  const release=manifest.releases[0];
  if(release.operation_key!==`publish:${snapshot.articleId}:v${selected.version}:${snapshot.release_sha256}`)throw new Error('operation_key divergente do snapshot');
  const target=path.resolve(inputDir,`${slug}.json`);const root=path.resolve(inputDir)+path.sep;if(!target.startsWith(root))throw new Error('Destino de publicação fora do diretório permitido');
  const sameSlugFiles=fs.readdirSync(inputDir).filter(name=>name.endsWith('.json')).map(name=>path.resolve(inputDir,name)).filter(file=>{try{return JSON.parse(fs.readFileSync(file,'utf8')).slug===slug;}catch{return false;}});
  if(sameSlugFiles.length>1)throw new Error('Acervo já contém slug duplicado; publicação automática bloqueada');
  const legacySource=sameSlugFiles[0]&&sameSlugFiles[0]!==target?sameSlugFiles[0]:null;
  const temp=`${target}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(inputDir,{recursive:true});
  fs.writeFileSync(temp,JSON.stringify(release.payload,null,2)+'\n','utf8');
  fs.renameSync(temp,target);
  if(legacySource)fs.unlinkSync(legacySource);
  return {slug,target,legacySource,manifest,release,payloadSha256:sha256(JSON.stringify(release.payload))};
}

export function assertContentOnlyPaths(paths,slug,legacyRelative=''){
  const target=`content/blog/published/${slug}.json`.replaceAll('\\','/');
  const allowed=new Set([target]);
  if(legacyRelative){const normalized=String(legacyRelative).replaceAll('\\','/');if(!normalized.startsWith('content/blog/published/')||!normalized.endsWith('.json'))throw new Error('Caminho legado fora do diretório editorial');allowed.add(normalized);}
  const normalizedPaths=(paths||[]).map(value=>String(value).replaceAll('\\','/'));
  const invalid=normalizedPaths.filter(value=>!allowed.has(value));
  if(invalid.length)throw new Error(`PR editorial contém arquivo fora do allowlist: ${invalid.join(', ')}`);
  if(!normalizedPaths.includes(target))throw new Error('PR editorial não contém o arquivo determinístico do artigo');
  return true;
}

function parseArgs(argv=process.argv.slice(2)){
  const args={snapshot:'',input:path.resolve(process.cwd(),'content/blog/published'),output:''};
  for(const raw of argv){
    if(raw.startsWith('--snapshot='))args.snapshot=path.resolve(process.cwd(),raw.slice(11));
    else if(raw.startsWith('--input='))args.input=path.resolve(process.cwd(),raw.slice(8));
    else if(raw.startsWith('--output='))args.output=path.resolve(process.cwd(),raw.slice(9));
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  return args;
}

async function main(){
  const args=parseArgs();if(!args.snapshot)throw new Error('--snapshot é obrigatório');
  const snapshot=JSON.parse(fs.readFileSync(args.snapshot,'utf8'));
  const result=materializePublicationSnapshot(snapshot,args.input);
  const summary={mode:'phase7-materialized',slug:result.slug,version:snapshot.article.version,operation_key:result.release.operation_key,
    content_sha256:result.release.content_sha256,presentation_sha256:result.release.presentation_sha256,release_sha256:result.release.release_sha256,
    html_sha256:result.release.html_sha256,payload_sha256:result.release.payload_sha256,target:path.relative(process.cwd(),result.target).replaceAll('\\','/'),legacy_source:result.legacySource?path.relative(process.cwd(),result.legacySource).replaceAll('\\','/'):''};
  if(args.output)fs.writeFileSync(args.output,JSON.stringify(summary,null,2)+'\n','utf8');
  console.log(JSON.stringify(summary));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});

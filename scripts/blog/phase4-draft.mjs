import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import {completeEditorialJson} from '../../lib/editorialAi.mjs';
import {buildPrompt, validateDraft, validateBriefing, RESPONSE_SCHEMA} from '../../lib/editorialDraft.mjs';
export {buildPrompt, validateDraft} from '../../lib/editorialDraft.mjs';
import {readNdjson} from './phase4-import.mjs';
import {assertPrivateOutput} from './private-output.mjs';

dotenv.config({path:path.resolve(process.cwd(), '.env.local'), override:false, quiet:true});

const DEFAULT_SNAPSHOT = path.resolve(process.cwd(), '../docs/blog-organico/etapa-1/acervo/normalizado/current/articles.ndjson');


function parseArgs(argv = process.argv.slice(2)) {
  const args = {snapshot:DEFAULT_SNAPSHOT, sourceId:'', briefing:'', references:'', output:'', model:''};
  for (const raw of argv) {
    if (raw.startsWith('--snapshot=')) args.snapshot = path.resolve(process.cwd(), raw.slice(11));
    else if (raw.startsWith('--source-id=')) args.sourceId = raw.slice(12);
    else if (raw.startsWith('--briefing=')) args.briefing = path.resolve(process.cwd(), raw.slice(11));
    else if (raw.startsWith('--references=')) args.references = path.resolve(process.cwd(), raw.slice(13));
    else if (raw.startsWith('--output=')) args.output = path.resolve(process.cwd(), raw.slice(9));
    else if (raw.startsWith('--model=')) args.model = raw.slice(8);
    else throw new Error(`Argumento desconhecido: ${raw}`);
  }
  for (const key of ['sourceId','briefing','references','output']) if (!args[key]) throw new Error(`Parâmetro obrigatório ausente: --${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`);
  return args;
}

async function main() {
  const args = parseArgs();
  assertPrivateOutput(args.output);
  if (process.env.BLOG_AI_ENV_FILE) dotenv.config({path:process.env.BLOG_AI_ENV_FILE, override:false, quiet:true});
  process.env.OPENROUTER_MODEL ||= process.env.REPORT_CORRECTION_AGENT_OPENROUTER_MODEL;
  const source = readNdjson(args.snapshot).find(row => String(row.sourceId) === String(args.sourceId));
  if (!source) throw new Error(`Fonte ${args.sourceId} não encontrada no snapshot.`);
  const briefing = JSON.parse(fs.readFileSync(args.briefing, 'utf8'));
  const references = JSON.parse(fs.readFileSync(args.references, 'utf8'));
  if (!Array.isArray(references) || !references.length) throw new Error('Lista de referências verificadas vazia.');
  validateBriefing(briefing, references);

  const {draft:parsed, generator} = await completeEditorialJson({prompt:buildPrompt(source, briefing, references), schema:RESPONSE_SCHEMA, env:args.model ? {...process.env, DEEPSEEK_MODEL:args.model} : process.env});
  validateDraft(parsed, {source, briefing, references});
  const output = {
    schemaVersion:1,
    status:'draft',
    sourceId:String(source.sourceId),
    generatedAt:new Date().toISOString(),
    generator,
    approval:{editorial:false, clinical:false, client:false},
    ...parsed,
  };
  fs.mkdirSync(path.dirname(args.output), {recursive:true});
  fs.writeFileSync(args.output, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({status:'draft-generated', sourceId:output.sourceId, provider:generator.provider, model:generator.model, responseId:output.generator.responseId, usage:output.generator.usage, output:args.output}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

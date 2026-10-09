import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {isAllowedInternalUrlShape, isValidSlug} from './core.mjs';
import {readNdjson} from './phase4-import.mjs';

dotenv.config({path:path.resolve(process.cwd(), '.env.local'), override:false, quiet:true});

const DEFAULT_SNAPSHOT = path.resolve(process.cwd(), '../docs/blog-organico/etapa-1/acervo/normalizado/current/articles.ndjson');
const DEFAULT_MODEL = 'gemini-2.5-flash';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {snapshot:DEFAULT_SNAPSHOT, sourceId:'', briefing:'', references:'', output:'', model:process.env.BLOG_EDITORIAL_MODEL || DEFAULT_MODEL};
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

function assertPrivateOutput(output) {
  const repo = path.resolve(process.cwd());
  const resolved = path.resolve(output);
  if (resolved === repo || resolved.startsWith(`${repo}${path.sep}`)) {
    throw new Error('O rascunho da Fase 4 deve ser salvo fora do repositório público.');
  }
}

const RESPONSE_SCHEMA = {
  type:'object',
  additionalProperties:false,
  required:['sourceId','workingTitle','targetSlug','description','searchIntent','editorialContribution','body','internalLinks','references','clinicalReviewPending','reviewPending','presentationSuggestion'],
  properties:{
    sourceId:{type:'string'},
    workingTitle:{type:'string'},
    targetSlug:{type:'string'},
    description:{type:'string'},
    searchIntent:{type:'string'},
    editorialContribution:{type:'string'},
    body:{type:'array', minItems:6, items:{
      type:'object', additionalProperties:false, required:['type'],
      properties:{type:{type:'string', enum:['h2','h3','p','ul','ol','quote']}, text:{type:'string'}, items:{type:'array', items:{type:'string'}}},
    }},
    internalLinks:{type:'array', items:{type:'object', additionalProperties:false, required:['label','url'], properties:{label:{type:'string'},url:{type:'string'}}}},
    references:{type:'array', minItems:1, items:{type:'object', additionalProperties:false, required:['title','url','supports'], properties:{title:{type:'string'},url:{type:'string'},supports:{type:'string'}}}},
    clinicalReviewPending:{type:'boolean'},
    reviewPending:{type:'array', minItems:1, items:{type:'string'}},
    presentationSuggestion:{type:'object', additionalProperties:false, required:['subject','decision','notes'], properties:{subject:{type:'string'},decision:{type:'string',enum:['manual_review_required','no_adequate_image']},notes:{type:'string'}}},
  },
};

export function validateDraft(draft, {source, briefing, references}) {
  if (String(draft.sourceId) !== String(source.sourceId)) throw new Error('IA alterou o sourceId.');
  if (!isValidSlug(draft.targetSlug)) throw new Error(`Slug inválido: ${draft.targetSlug}`);
  if (draft.clinicalReviewPending !== true) throw new Error('Rascunho sem clinicalReviewPending=true.');
  if (!Array.isArray(draft.reviewPending) || !draft.reviewPending.some(item => /cl[ií]nic/i.test(item))) throw new Error('Rascunho não registra revisão clínica pendente.');
  const allowedRefs = new Set(references.map(item => item.url));
  for (const ref of draft.references || []) if (!allowedRefs.has(ref.url)) throw new Error(`IA introduziu referência não fornecida: ${ref.url}`);
  const allowedLinks = new Set(briefing.allowedInternalLinks || []);
  for (const link of draft.internalLinks || []) {
    if (!isAllowedInternalUrlShape(link.url) || !allowedLinks.has(link.url)) throw new Error(`IA introduziu link interno não autorizado: ${link.url}`);
  }
  for (const block of draft.body || []) {
    const hasText = typeof block.text === 'string' && block.text.trim();
    const hasItems = Array.isArray(block.items) && block.items.length && block.items.every(item => typeof item === 'string' && item.trim());
    if (!hasText && !hasItems) throw new Error(`Bloco editorial vazio: ${block.type}`);
  }
  return draft;
}

export function buildPrompt(source, briefing, references) {
  return [
    'TAREFA: preparar UM rascunho editorial para revisão humana. Não é aprovação e não é publicação.',
    'REGRAS DURAS:',
    '- Use somente fatos que possam ser sustentados pelo conteúdo legado e pelas referências verificadas abaixo.',
    '- Não invente diagnóstico, eficácia, superioridade tecnológica, prevalência, tempo de exame ou recomendação clínica.',
    '- Se um fato do legado estiver desatualizado ou sem confirmação nas referências, omita ou formule como ponto a revisar clinicamente.',
    '- Não use primeira pessoa como se fosse a Dra. Karyne.',
    '- Não crie links nem referências fora das listas fornecidas.',
    '- A saída será revisada por humano; mantenha clinicalReviewPending=true.',
    '- Imagem nunca é automática: presentationSuggestion.decision deve ser manual_review_required ou no_adequate_image.',
    '',
    `BRIEFING\n${JSON.stringify(briefing, null, 2)}`,
    '',
    `FONTE LEGADA\n${JSON.stringify({sourceId:source.sourceId, sourceUrl:source.sourceUrl, publishedAt:source.publishedAt, modifiedAt:source.modifiedAt, title:source.title, excerpt:source.excerpt, contentText:source.contentText, featuredMedia:source.featuredMedia}, null, 2)}`,
    '',
    `REFERÊNCIAS VERIFICADAS\n${JSON.stringify(references, null, 2)}`,
  ].join('\n');
}

async function main() {
  const args = parseArgs();
  assertPrivateOutput(args.output);
  const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY não configurada.');
  const source = readNdjson(args.snapshot).find(row => String(row.sourceId) === String(args.sourceId));
  if (!source) throw new Error(`Fonte ${args.sourceId} não encontrada no snapshot.`);
  const briefing = JSON.parse(fs.readFileSync(args.briefing, 'utf8'));
  const references = JSON.parse(fs.readFileSync(args.references, 'utf8'));
  if (!Array.isArray(references) || !references.length) throw new Error('Lista de referências verificadas vazia.');

  const ai = new GoogleGenAI({apiKey:key});
  const startedAt = new Date().toISOString();
  const response = await ai.models.generateContent({
    model:args.model,
    contents:buildPrompt(source, briefing, references),
    config:{
      systemInstruction:'Você é um assistente editorial restrito. Obedeça ao corpus fornecido, escreva em pt-BR claro e não trate rascunho como aprovação clínica.',
      responseMimeType:'application/json',
      responseJsonSchema:RESPONSE_SCHEMA,
      temperature:0.2,
    },
  });
  const parsed = JSON.parse(String(response.text || '').trim());
  validateDraft(parsed, {source, briefing, references});
  const output = {
    schemaVersion:1,
    status:'draft',
    sourceId:String(source.sourceId),
    generatedAt:new Date().toISOString(),
    generator:{provider:'google-gemini', api:'generateContent', model:args.model, responseId:response?.responseId || null, startedAt, usage:response?.usageMetadata || null, store:false, tools:[]},
    approval:{editorial:false, clinical:false, client:false},
    ...parsed,
  };
  fs.mkdirSync(path.dirname(args.output), {recursive:true});
  fs.writeFileSync(args.output, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({status:'draft-generated', sourceId:output.sourceId, model:args.model, responseId:output.generator.responseId, usage:output.generator.usage, output:args.output}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

import {isAllowedInternalUrlShape, isValidSlug} from '../scripts/blog/core.mjs';
export const RESPONSE_SCHEMA = {
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

function validateShape(value, schema, label = 'draft') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: objeto obrigatório`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`${label}.${key}: campo obrigatório`);
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties[key]) throw new Error(`${label}.${key}: campo não permitido`);
      validateShape(item, schema.properties[key], `${label}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0)) throw new Error(`${label}: lista incompleta`);
    value.forEach((item, index) => validateShape(item, schema.items, `${label}[${index}]`));
  } else if (typeof value !== schema.type || (schema.type === 'string' && !value.trim())) {
    throw new Error(`${label}: valor inválido`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${label}: opção inválida`);
}

// Nomes que os modelos costumam dar aos mesmos blocos; traduzidos antes da validação estrita.
const BLOCK_TYPE_ALIASES = {
  paragraph:'p', text:'p', heading:'h2', subheading:'h3', list:'ul', bullets:'ul', bullet_list:'ul',
  numbered_list:'ol', ordered_list:'ol', blockquote:'quote', citation:'quote',
};

const BLOCK_TYPES = new Set(['h2','h3','p','ul','ol','quote']);

// Defeitos de geração que não justificam descartar o rascunho inteiro: tipo de bloco desconhecido,
// texto em campo trocado, bloco ou item vazio. As travas de conteúdo e de aprovação seguem no validateDraft.
function normalizeBlocks(draft) {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.body)) return;
  const blocks = [];
  for (const block of draft.body) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    const raw = typeof block.type === 'string' ? block.type.trim().toLowerCase() : '';
    const type = BLOCK_TYPE_ALIASES[raw] ?? (BLOCK_TYPES.has(raw) ? raw : 'p');
    const text = [block.text, block.title, block.content].find(value => typeof value === 'string' && value.trim());
    const items = Array.isArray(block.items) ? block.items.filter(item => typeof item === 'string' && item.trim()) : [];
    const clean = {type};
    if (text) clean.text = text;
    if (items.length) clean.items = items;
    if (clean.text || clean.items) blocks.push(clean);
  }
  draft.body = blocks;
  if (Array.isArray(draft.reviewPending)) draft.reviewPending = draft.reviewPending.filter(item => typeof item !== 'string' || item.trim());
}

// Referência ou link fora das listas fornecidas sai do rascunho e fica anotado para a revisão humana.
function dropUnlistedLinks(draft, {references, briefing}) {
  if (!draft || typeof draft !== 'object') return;
  const notes = [];
  const allowedRefs = new Set(references.map(item => item.url));
  if (Array.isArray(draft.references)) {
    draft.references = draft.references.filter(ref => {
      if (!ref || typeof ref !== 'object' || allowedRefs.has(ref.url)) return true;
      notes.push(`Referência fora da lista removida do rascunho: ${ref.url}`);
      return false;
    });
  }
  const allowedLinks = new Set(briefing.allowedInternalLinks || []);
  if (Array.isArray(draft.internalLinks)) {
    draft.internalLinks = draft.internalLinks.filter(link => {
      if (!link || typeof link !== 'object' || (isAllowedInternalUrlShape(link.url) && allowedLinks.has(link.url))) return true;
      notes.push(`Link interno não autorizado removido do rascunho: ${link.url}`);
      return false;
    });
  }
  if (notes.length && Array.isArray(draft.reviewPending)) draft.reviewPending.push(...notes);
}

function repairDraft(draft, context) {
  normalizeBlocks(draft);
  dropUnlistedLinks(draft, context);
}

export function validateDraft(draft, {source, briefing, references}) {
  repairDraft(draft, {briefing, references});
  validateShape(draft, RESPONSE_SCHEMA);
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
    'ESTILO (texto para pacientes, em português do Brasil):',
    '- Escreva de forma direta e natural, como uma profissional explicando a um paciente. Varie o tamanho das frases.',
    '- Não use travessão (—). Use vírgula, ponto, dois-pontos ou parênteses.',
    '- Evite marcas de texto gerado por IA: "Além disso" repetido, "é importante ressaltar", "vale destacar", "fundamental", "crucial", "jornada", "desvendar", "mergulhar", "no universo de", "não é apenas X, é Y", grupos forçados de três itens, perguntas de efeito e fechamentos genéricos como "Em resumo" ou "Em suma".',
    '- Sem exclamações, emojis ou negrito decorativo. Títulos de seção em frase comum, sem Inicial Maiúscula Em Toda Palavra.',
    '',
    `BRIEFING\n${JSON.stringify(briefing, null, 2)}`,
    '',
    `FONTE LEGADA\n${JSON.stringify({sourceId:source.sourceId, sourceUrl:source.sourceUrl, publishedAt:source.publishedAt, modifiedAt:source.modifiedAt, title:source.title, excerpt:source.excerpt, contentText:source.contentText, featuredMedia:source.featuredMedia}, null, 2)}`,
    '',
    `REFERÊNCIAS VERIFICADAS\n${JSON.stringify(references, null, 2)}`,
  ].join('\n');
}

export function validateBriefing(briefing, references) {
  if (!briefing || typeof briefing.objective !== 'string' || !briefing.objective.trim() || !Array.isArray(briefing.allowedInternalLinks)) throw new Error('Briefing incompleto.');
  if (briefing.allowedInternalLinks.some(url => !isAllowedInternalUrlShape(url))) throw new Error('Link interno do briefing inválido.');
  if (!Array.isArray(references) || !references.length) throw new Error('Referências verificadas obrigatórias.');
  for (const reference of references) {
    if (!reference || !reference.title || !reference.supports || !/^\d{4}-\d{2}-\d{2}$/.test(reference.verifiedAt || '')) throw new Error('Referência sem evidência de verificação.');
    const url = new URL(reference.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL de referência inválida.');
  }
}


// Fase 8: pauta original, sem fonte legado. O contrato é o mesmo do rascunho adaptado, sem o campo sourceId.
const {sourceId:_sourceIdSchema, ...ORIGINAL_PROPERTIES} = RESPONSE_SCHEMA.properties;
export const ORIGINAL_RESPONSE_SCHEMA = {
  ...RESPONSE_SCHEMA,
  required:RESPONSE_SCHEMA.required.filter(key => key !== 'sourceId'),
  properties:ORIGINAL_PROPERTIES,
};

export function validateOriginalBriefing(briefing, references) {
  if (!briefing || typeof briefing !== 'object' || Array.isArray(briefing)) throw new Error('Pauta original incompleta.');
  for (const key of ['topic','objective','searchIntent','editorialContribution']) {
    if (typeof briefing[key] !== 'string' || briefing[key].trim().length < 3 || briefing[key].length > 1200) throw new Error(`Pauta original sem ${key}.`);
  }
  if ('sourceId' in briefing) throw new Error('Pauta original não aceita fonte legado.');
  validateBriefing(briefing, references);
  if (references.length > 20 || briefing.allowedInternalLinks.length > 20) throw new Error('Pauta original excede os limites.');
}

export function validateOriginalDraft(draft, {briefing, references}) {
  repairDraft(draft, {briefing, references});
  validateShape(draft, ORIGINAL_RESPONSE_SCHEMA);
  return validateDraft({...draft, sourceId:'original'}, {source:{sourceId:'original'}, briefing, references}) && draft;
}

export function buildOriginalPrompt(briefing, references) {
  return [
    'TAREFA: preparar UM rascunho editorial ORIGINAL para revisão humana, a partir de uma pauta nova. Não é aprovação e não é publicação.',
    'REGRAS DURAS:',
    '- Não existe texto legado para esta pauta. Use somente fatos sustentados pelas referências verificadas abaixo.',
    '- Não invente fatos clínicos, diagnóstico, eficácia, resultados, prevalência, depoimentos, casos de pacientes, números ou aprovações.',
    '- Quando a pauta pedir algo que as referências não sustentam, omita ou registre em reviewPending como ponto a revisar clinicamente.',
    '- Não use primeira pessoa como se fosse a Dra. Karyne.',
    '- Não crie links nem referências fora das listas fornecidas.',
    '- A saída será revisada por humano; mantenha clinicalReviewPending=true.',
    '- Imagem nunca é automática: presentationSuggestion.decision deve ser manual_review_required ou no_adequate_image.',
    '',
    'ESTILO (texto para pacientes, em português do Brasil):',
    '- Escreva de forma direta e natural, como uma profissional explicando a um paciente. Varie o tamanho das frases.',
    '- Não use travessão (—). Use vírgula, ponto, dois-pontos ou parênteses.',
    '- Evite marcas de texto gerado por IA: "Além disso" repetido, "é importante ressaltar", "vale destacar", "fundamental", "crucial", "jornada", "desvendar", "mergulhar", "no universo de", "não é apenas X, é Y", grupos forçados de três itens, perguntas de efeito e fechamentos genéricos como "Em resumo" ou "Em suma".',
    '- Sem exclamações, emojis ou negrito decorativo. Títulos de seção em frase comum, sem Inicial Maiúscula Em Toda Palavra.',
    '',
    `PAUTA\n${JSON.stringify(briefing, null, 2)}`,
    '',
    `REFERÊNCIAS VERIFICADAS\n${JSON.stringify(references, null, 2)}`,
  ].join('\n');
}

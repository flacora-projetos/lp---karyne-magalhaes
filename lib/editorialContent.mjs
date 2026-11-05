export function canonicalContentPayload(article) {
  // JSONB pode devolver as chaves em ordem diferente da usada na aprovação.
  return {...article,
    body:article?.body?.map(b=>['ul','ol'].includes(b.type)?{type:b.type,items:b.items}:{type:b.type,text:b.text}),
    internalLinks:article?.internalLinks?.map(l=>l.slug?{label:l.label,slug:l.slug}:{label:l.label,url:l.url}),
    references:article?.references?.map(r=>({title:r.title,url:r.url,...(r.supports?{supports:r.supports}:{}),...(r.verifiedAt?{verifiedAt:r.verifiedAt}:{})})),
  };
}

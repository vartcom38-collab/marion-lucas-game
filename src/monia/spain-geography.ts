function norm(value:unknown){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

/**
 * Geography-only Spain detection. Lodging words such as "hotel" are
 * deliberately excluded: a temporary accommodation is not a country signal.
 */
export function isSpainPlace(value:unknown){
  const p=norm(value);
  return /\b(spain|espagne|espana|madrid|sevill(?:a|e)?|andal(?:ucia|ousie)?|salamanca)\b/.test(p)
    || /\bfinca\b/.test(p)
    || /\b(?:spanish|espagnol|espagnole)\b/.test(p);
}

export function isNimesPlace(value:unknown){
  const p=norm(value);
  return /\b(nimes|nimes-home)\b/.test(p)||/appart.*nimes|nimes.*appart|chez marion/.test(p);
}

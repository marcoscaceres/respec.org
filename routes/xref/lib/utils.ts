import { createHash } from 'crypto';

/**
 * Generate intelligent variations of the term
 * Source: https://github.com/tabatkins/bikeshed/blob/682218b6/bikeshed/refs/utils.py#L52 💖
 */
/* istanbul ignore next */
export function* textVariations(term: string) {
  const len = term.length;
  const last1 = len >= 1 ? term.slice(-1) : null;
  const last2 = len >= 2 ? term.slice(-2) : null;
  const last3 = len >= 3 ? term.slice(-3) : null;

  // carrot <-> carrots
  if (last1 === 's') yield term.slice(0, -1);
  else yield `${term}s`;

  // snapped <-> snap
  if (last2 === 'ed' && len >= 4 && term.substr(-3, 1) === term.substr(-4, 1)) {
    yield term.slice(0, -3);
  } else if ('bdfgklmnprstvz'.includes(last1 as string)) {
    yield `${term + last1}ed`;
  }

  // zeroed <-> zero
  if (last2 === 'ed') yield term.slice(0, -2);
  else yield `${term}ed`;

  // generated <-> generate
  if (last1 === 'd') yield term.slice(0, -1);
  else yield `${term}d`;

  // parsing <-> parse
  if (last3 === 'ing') {
    yield term.slice(0, -3);
    yield `${term.slice(0, -3)}e`;
  } else if (last1 === 'e') {
    yield `${term.slice(0, -1)}ing`;
  } else {
    yield `${term}ing`;
  }

  // snapping <-> snap
  if (
    last3 === 'ing' &&
    len >= 5 &&
    term.substr(-4, 1) === term.substr(-5, 1)
  ) {
    yield term.slice(0, -4);
  } else if ('bdfgkmnprstvz'.includes(last1 as string)) {
    yield `${term + last1}ing`;
  }

  // zeroes <-> zero
  if (last2 === 'es') yield term.slice(0, -2);
  else yield `${term}es`;

  // berries <-> berry
  if (last3 === 'ies') yield `${term.slice(0, -3)}y`;
  if (last1 === 'y') yield `${term.slice(0, -1)}ies`;

  // stringified <-> stringify
  if (last3 === 'ied') yield `${term.slice(0, -3)}y`;
  if (last1 === 'y') yield `${term.slice(0, -1)}ied`;
}

export function pickFields<T>(item: T, fields: (keyof T)[]) {
  if (!fields.length) return item;
  const result: Partial<T> = {};
  for (const field of fields) {
    result[field] = item[field];
  }
  return result;
}

export function objectHash(obj: object): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha1')
    .update(str)
    .digest('hex');
}

export function uniq<T>(items: T[]) {
  const unique = new Set(items.map(entry => JSON.stringify(entry)));
  const result = [...unique].map(str => JSON.parse(str) as typeof items[0]);
  return result;
}

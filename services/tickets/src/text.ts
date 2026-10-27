const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas para por com sem que se meu minha meus minhas seu sua não nao esta está estou é ao aos à às eu ele ela isso este essa esse foi ser ter tem mais muito como quando qual quais ja já".split(
    " ",
  ),
);

export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** Fraction of the query tokens found in the document, ignoring very short prefixes. */
export function overlap(query: string[], document: string[]): number {
  if (query.length === 0) return 0;
  const hits = query.filter((token) =>
    document.some((word) => word === token || (token.length >= 4 && word.startsWith(token.slice(0, 4)))),
  );
  return hits.length / query.length;
}

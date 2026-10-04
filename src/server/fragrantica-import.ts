export type FragranticaPerfumeLink = { title: string; url: string; score: number };

const BRAND_WORDS = new Set([
  "afnan",
  "armaf",
  "lattafa",
  "perfumes",
  "rasasi",
  "parfum",
  "parfums",
  "perfume",
  "eau",
  "de",
  "toilette",
  "edp",
  "edt",
  "extrait",
]);

export function normalizePerfumeText(value: string): string {
  return decodeHtmlEntities(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+\s*(?:ml|oz)\b/g, " ")
    .replace(/\b(\d)\s+([a-z]{1,3})\b/g, "$1$2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTokens(value: string): Set<string> {
  return new Set(
    normalizePerfumeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 1 && !BRAND_WORDS.has(token)),
  );
}

export function getPerfumeNameMatchScore(candidateName: string, productName: string): number {
  const targetTokens = getTokens(productName);
  if (!targetTokens.size) return 0;
  const candidateTokens = getTokens(candidateName);
  const intersection = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
  return intersection / targetTokens.size;
}

export function rankPerfumeLinkMatches(
  html: string,
  productName: string,
): FragranticaPerfumeLink[] {
  if (!getTokens(productName).size) return [];

  const candidates = new Map<string, FragranticaPerfumeLink>();
  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a\s*>/gi;
  for (const anchor of html.match(anchorPattern) ?? []) {
    const href = anchor.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || !/\/perfume\//i.test(href)) continue;
    const title = stripHtml(anchor.replace(/^<a\b[^>]*>/i, "").replace(/<\/a\s*>$/i, ""));
    const url = decodeHtmlEntities(href);
    const score = getPerfumeNameMatchScore(
      `${title} ${url.split("/").pop()?.replace(/\.html.*/i, "") ?? ""}`,
      productName,
    );
    if (score < 0.6) continue;
    const key = url.toLowerCase();
    const previous = candidates.get(key);
    if (!previous || score > previous.score) candidates.set(key, { title, url, score });
  }

  return [...candidates.values()].sort((left, right) => right.score - left.score).slice(0, 5);
}

export function extractPerfumeDescription(html: string): { title: string; description: string } | null {
  const title =
    stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1] ?? "") ||
    decodeHtmlEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? "");
  const cleanHtml = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const headings = [...cleanHtml.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi)];
  const sectionLabels = [
    { pattern: /notas?\s+de\s+salida|top\s+notes/i, label: "Notas de salida" },
    { pattern: /coraz[oó]n|middle\s+notes|heart\s+notes/i, label: "Notas de corazón" },
    { pattern: /base|notas?\s+de\s+fondo|base\s+notes/i, label: "Notas de fondo" },
  ];
  const sections: string[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index];
    if (current?.index === undefined) continue;
    const headingText = stripHtml(current[1] ?? "");
    const label = sectionLabels.find((section) => section.pattern.test(headingText));
    if (!label) continue;
    const end = headings[index + 1]?.index ?? cleanHtml.length;
    const sectionHtml = cleanHtml.slice(current.index + current[0].length, end);
    const notes = [...sectionHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)]
      .map((match) => stripHtml(match[1] ?? ""))
      .filter((note, noteIndex, all) => note && all.indexOf(note) === noteIndex);
    if (notes.length) sections.push(`${label.label}: ${notes.join(", ")}`);
  }

  if (!title || !sections.length) return null;
  return { title, description: sections.join("\n") };
}

export function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    nbsp: " ",
    quot: '"',
    lt: "<",
    gt: ">",
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    ntilde: "ñ",
    Aacute: "Á",
    Eacute: "É",
    Iacute: "Í",
    Oacute: "Ó",
    Uacute: "Ú",
    Ntilde: "Ñ",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name] ?? entity);
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

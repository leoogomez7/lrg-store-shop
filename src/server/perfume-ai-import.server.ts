export type PerfumeSource = { title: string; url: string };

export type PerfumeNotesImport = {
  matched: boolean;
  title: string;
  description: string;
  reason: string;
  sources: PerfumeSource[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFragranticaUrl(value: string): boolean {
  try {
    return /(^|\.)fragrantica\.(?:com|es)$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function collectCitedSources(value: unknown): PerfumeSource[] {
  const sources = new Map<string, PerfumeSource>();

  const addSource = (candidate: unknown) => {
    if (!isRecord(candidate) || typeof candidate.url !== "string") return;
    try {
      const url = new URL(candidate.url);
      if (!(["http:", "https:"].includes(url.protocol)) || isFragranticaUrl(url.toString())) return;
      const normalizedUrl = url.toString();
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "Fuente web";
      sources.set(normalizedUrl, { title: title || "Fuente web", url: normalizedUrl });
    } catch {
      // Ignore malformed or unsafe citation URLs.
    }
  };

  const visit = (current: unknown, parentKey = "") => {
    if (Array.isArray(current)) {
      for (const item of current) {
        if (parentKey === "sources") addSource(item);
        visit(item);
      }
      return;
    }
    if (!isRecord(current)) return;
    if (current.type === "url_citation") addSource(current);
    for (const [key, child] of Object.entries(current)) visit(child, key);
  };

  visit(value);
  return [...sources.values()].slice(0, 6);
}

function getOutputText(payload: RecordValue): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return "";

  return payload.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .filter((content): content is RecordValue => isRecord(content))
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text as string)
    .join("\n")
    .trim();
}

function cleanNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((note): note is string => typeof note === "string")
    .map((note) => note.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 12);
}

export function parsePerfumeNotesResponse(payload: unknown): PerfumeNotesImport {
  if (!isRecord(payload)) throw new Error("La IA devolvió una respuesta inválida.");
  const outputText = getOutputText(payload).replace(/^```(?:json)?\s*|\s*```$/g, "");
  if (!outputText) throw new Error("La búsqueda no devolvió información para revisar.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("La IA devolvió un formato de notas inválido. Volvé a intentar.");
  }
  if (!isRecord(parsed) || !isRecord(parsed.notes) || typeof parsed.matched !== "boolean") {
    throw new Error("La IA no devolvió una pirámide olfativa válida.");
  }

  const top = cleanNotes(parsed.notes.top);
  const heart = cleanNotes(parsed.notes.heart);
  const base = cleanNotes(parsed.notes.base);
  const description = [
    top.length ? `Notas de salida: ${top.join(", ")}` : "",
    heart.length ? `Notas de corazón: ${heart.join(", ")}` : "",
    base.length ? `Notas de fondo: ${base.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const sources = collectCitedSources(payload);

  if (!sources.length) throw new Error("La búsqueda no devolvió fuentes verificables. No se importaron notas.");
  if (parsed.matched && !description) {
    throw new Error("Encontré el perfume, pero no pude confirmar sus notas.");
  }

  return {
    matched: parsed.matched,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 160) : "Perfume encontrado",
    description,
    reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 300) : "",
    sources,
  };
}
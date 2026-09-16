export function splitStreetAndNumber(value: string): { street: string; streetNumber: string } {
  const streetAndNumber = value.split(",")[0]?.trim() ?? value.trim();
  const matches = [...streetAndNumber.matchAll(/\b\d+\s*[A-Za-z]?\b/g)];
  const lastMatch = matches.at(-1);

  if (!lastMatch || lastMatch.index === undefined) {
    return { street: streetAndNumber, streetNumber: "" };
  }

  return {
    street: streetAndNumber.slice(0, lastMatch.index).trim(),
    streetNumber: lastMatch[0].trim(),
  };
}

export function extractStreetNumberFromResult(value: string, street?: string): string {
  const segments = value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const streetTokens = (street ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const candidates = segments.flatMap((segment, index) => {
    const matches = [...segment.matchAll(/\b\d{1,6}\s*[A-Za-z]?\b/g)];
    if (!matches.length) return [];

    const normalizedSegment = segment
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const score = streetTokens.length
      ? streetTokens.filter((token) => normalizedSegment.includes(token)).length
      : 1;

    return matches.map((match) => ({ number: match[0].trim(), score, index }));
  });

  if (candidates.length === 0) {
    const directMatch = value.match(/\b\d{1,6}\s*[A-Za-z]?\b/);
    return directMatch?.[0]?.trim() ?? "";
  }

  return (
    candidates.sort((first, second) => second.score - first.score || first.index - second.index)[0]
      ?.number ?? ""
  );
}

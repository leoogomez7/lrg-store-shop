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

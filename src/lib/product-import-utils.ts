export type ImportedProductLine = { name: string; price: number };

export function parseLocalizedImportPrice(value: string): number | null {
  let normalized = value.trim().replace(/[^\d.,-]/g, "");
  if (!normalized || !/\d/.test(normalized)) return null;

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.split(groupingSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (commaIndex >= 0 || dotIndex >= 0) {
    const separator = commaIndex >= 0 ? "," : ".";
    const parts = normalized.split(separator);
    const trailingDigits = parts.at(-1)?.length ?? 0;
    if (trailingDigits === 3 || parts.length > 2) {
      normalized = parts.join("");
    } else {
      normalized = `${parts.slice(0, -1).join("")}.${parts.at(-1) ?? ""}`;
    }
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

const cleanImportedName = (value: string) =>
  value
    .replace(/^(?:producto|item|articulo|artículo|precio|price|valor|total|importe)\s+/i, "")
    .replace(/^[\s|:;,.()-]+|[\s|:;,.()-]+$/g, "")
    .replace(/[^\p{L}\p{N}\s&()/%-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Parses rows formatted as product name followed by "$" and a localized price. */
export function parseDollarDelimitedProductLine(line: string): ImportedProductLine | null {
  const dollarIndex = line.lastIndexOf("$");
  if (dollarIndex < 0) return null;

  const name = cleanImportedName(line.slice(0, dollarIndex));
  const priceText = line.slice(dollarIndex + 1).match(/\d[\d.,]*/)?.[0];
  const price = priceText ? parseLocalizedImportPrice(priceText) : null;
  if (!name || name.length < 3 || name.length > 140 || price === null) return null;

  return { name, price };
}
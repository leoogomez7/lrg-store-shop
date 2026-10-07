export function normalizeProductSlugSegment(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function encodeIdentityAsDigits(identity: string) {
  let encoded = 1n;
  for (const byte of new TextEncoder().encode(identity)) {
    encoded = encoded * 256n + BigInt(byte);
  }
  return encoded.toString(10);
}

export function getProductIdentityFromPublicSlug(slug: string) {
  const token = slug.match(/-(\d+)$/)?.[1];
  if (!token || token.length > 200) return null;

  try {
    let encoded = BigInt(token);
    if (encoded <= 1n) return null;

    const bytes: number[] = [];
    while (encoded > 1n) {
      bytes.push(Number(encoded % 256n));
      encoded /= 256n;
    }
    if (encoded !== 1n) return null;

    return new TextDecoder().decode(Uint8Array.from(bytes.reverse()));
  } catch {
    return null;
  }
}

export function getProductRecordIdentityFromPublicSlug(slug: string) {
  const identity = getProductIdentityFromPublicSlug(slug);
  const separator = identity?.lastIndexOf("::") ?? -1;
  return separator > 0 ? identity!.slice(0, separator) : identity;
}

export function getProductVariantIdentityFromPublicSlug(slug: string) {
  const identity = getProductIdentityFromPublicSlug(slug);
  const separator = identity?.lastIndexOf("::") ?? -1;
  return separator > 0 ? identity!.slice(separator + 2) : null;
}

export function buildProductPublicSlug({
  name,
  variantName,
  id,
  fallbackSlug,
}: {
  name?: string;
  variantName?: string;
  id?: string;
  fallbackSlug?: string;
}) {
  const readableParts = [
    normalizeProductSlugSegment(name),
    normalizeProductSlugSegment(variantName),
  ].filter(Boolean);
  const base = readableParts.length
    ? readableParts.join("-")
    : normalizeProductSlugSegment(fallbackSlug) || "producto";
  const identity = id ?? fallbackSlug ?? `${Date.now()}`;
  const numericIdentity = encodeIdentityAsDigits(identity);
  const readableLimit = Math.max(0, 119 - numericIdentity.length);
  const readableSlug = base.slice(0, readableLimit).replace(/-+$/, "") || "producto";

  return `${readableSlug}-${numericIdentity}`;
}

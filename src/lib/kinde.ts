const PLACEHOLDER_PATTERN = /(placeholder|example|test|changeme|undefined)/i;

export function getKindeConfig() {
  const clientId = import.meta.env.VITE_KINDE_CLIENT_ID?.trim();
  const domain = import.meta.env.VITE_KINDE_DOMAIN?.trim();

  return {
    clientId: clientId || "",
    domain: domain || "",
  };
}

export function hasKindeConfig() {
  const { clientId, domain } = getKindeConfig();

  return Boolean(
    clientId &&
      domain &&
      clientId !== "undefined" &&
      domain !== "undefined" &&
      !PLACEHOLDER_PATTERN.test(clientId) &&
      !PLACEHOLDER_PATTERN.test(domain),
  );
}

export function getKindeRedirectUri(path: string) {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${path}`;
}

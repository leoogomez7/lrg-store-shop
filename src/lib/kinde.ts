const PLACEHOLDER_PATTERN = /(placeholder|example|test|changeme|undefined)/i;

export function getKindeConfig() {
  const clientId = import.meta.env["AUTH_USER"]?.trim();
  const configuredDomain = import.meta.env["DOMAIN_USER"]?.trim();
  const domain = configuredDomain
    ? /^https?:\/\//i.test(configuredDomain)
      ? configuredDomain
      : `https://${configuredDomain}`
    : "";

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

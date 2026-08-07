export const FALLBACK_KINDE_CLIENT_ID = "7f41da4eb4f0421d8260d299a4ae2dad";
export const FALLBACK_KINDE_DOMAIN = "https://lrg07.kinde.com";

export function getKindeConfig() {
  return {
    clientId: import.meta.env.VITE_KINDE_CLIENT_ID || FALLBACK_KINDE_CLIENT_ID,
    domain: import.meta.env.VITE_KINDE_DOMAIN || FALLBACK_KINDE_DOMAIN,
  };
}

export function getKindeRedirectUri(path: string) {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${path}`;
}

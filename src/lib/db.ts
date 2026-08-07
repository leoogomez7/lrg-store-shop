import { createClient } from "@libsql/client/web";

const tursoUrl = import.meta.env.VITE_TURSO_URL?.trim();
const tursoToken = import.meta.env.VITE_TURSO_TOKEN?.trim();
const hasRealTursoConfig = Boolean(
  tursoUrl &&
    tursoToken &&
    !/(placeholder|example|test|changeme|undefined)/i.test(tursoUrl) &&
    !/(placeholder|example|test|changeme|undefined)/i.test(tursoToken),
);

export const client = hasRealTursoConfig
  ? createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
  : null;

export function hasTursoConfig() {
  return hasRealTursoConfig;
}

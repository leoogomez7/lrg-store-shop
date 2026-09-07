import { createClient } from "@libsql/client/web";

function readEnv(...names: string[]) {
  for (const name of names) {
    const importMetaValue = import.meta.env[name]?.trim();
    if (importMetaValue) return importMetaValue;

    const processValue = typeof process !== "undefined" ? process.env[name]?.trim() : undefined;
    if (processValue) return processValue;
  }
  return undefined;
}

const tursoUrl = readEnv("BDD_USER", "TURSO_DATABASE_URL");
const tursoToken = readEnv("TOK_BDD_USER", "TURSO_AUTH_TOKEN");
const tursoAdminUrl = readEnv("BDD_ADMIN", "TURSO_ADMIN_DATABASE_URL", "TURSO_DATABASE_URL");
const tursoAdminToken = readEnv("TOK_BDD_ADMIN", "TURSO_ADMIN_AUTH_TOKEN", "TURSO_AUTH_TOKEN");
const hasRealTursoConfig = Boolean(
  tursoUrl &&
  tursoToken &&
  !/(placeholder|example|test|changeme|undefined)/i.test(tursoUrl) &&
  !/(placeholder|example|test|changeme|undefined)/i.test(tursoToken),
);
const hasRealTursoAdminConfig = Boolean(
  tursoAdminUrl &&
  tursoAdminToken &&
  !/(placeholder|example|test|changeme|undefined)/i.test(tursoAdminUrl) &&
  !/(placeholder|example|test|changeme|undefined)/i.test(tursoAdminToken),
);

export const client = hasRealTursoConfig
  ? createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
  : null;

export const adminClient = hasRealTursoAdminConfig
  ? createClient({
      url: tursoAdminUrl,
      authToken: tursoAdminToken,
    })
  : null;

export function hasTursoConfig() {
  return hasRealTursoConfig;
}

export function hasTursoAdminConfig() {
  return hasRealTursoAdminConfig;
}

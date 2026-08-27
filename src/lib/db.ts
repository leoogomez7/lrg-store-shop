import { createClient } from "@libsql/client/web";

const tursoUrl = import.meta.env["BDD_USER"]?.trim();
const tursoToken = import.meta.env["TOK_BDD_USER"]?.trim();
const tursoAdminUrl = import.meta.env["BDD_ADMIN"]?.trim();
const tursoAdminToken = import.meta.env["TOK_BDD_ADMIN"]?.trim();
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

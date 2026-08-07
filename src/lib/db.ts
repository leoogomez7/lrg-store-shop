import { createClient } from "@libsql/client/web";

const tursoUrl = import.meta.env.VITE_TURSO_URL;
const tursoToken = import.meta.env.VITE_TURSO_TOKEN;

export const client = tursoUrl && tursoToken
  ? createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
  : null;

export function hasTursoConfig() {
  return Boolean(tursoUrl && tursoToken);
}

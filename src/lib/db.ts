import { createClient } from "@libsql/client/web";

export const client = createClient({
  url: import.meta.env.VITE_TURSO_URL,
  authToken: import.meta.env.VITE_TURSO_TOKEN,
});

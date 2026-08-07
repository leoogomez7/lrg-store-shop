import { client } from "@/lib/db";

export type KindeProfile = {
  id: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};

export async function saveKindeUserToTurso(user: KindeProfile): Promise<void> {
  if (!user?.id) return;
  if (!client) return;

  const fullName = [user.givenName, user.familyName].filter(Boolean).join(" ").trim() || user.email || "";
  const now = new Date().toISOString();

  try {
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        givenName TEXT,
        familyName TEXT,
        fullName TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
    });

    await client.execute({
      sql: `INSERT INTO users (id, email, givenName, familyName, fullName, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              givenName = excluded.givenName,
              familyName = excluded.familyName,
              fullName = excluded.fullName,
              updatedAt = excluded.updatedAt`,
      args: [user.id, user.email ?? "", user.givenName ?? "", user.familyName ?? "", fullName, now, now],
    });
  } catch (error) {
    console.error("Error guardando usuario en Turso:", error);
  }
}

import { client } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";

export type KindeProfile = {
  id: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

export type UserProfileData = {
  id?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  fullName?: string;
  phone?: string;
  document?: string;
  city?: string;
};

export type UserAddress = {
  id?: string;
  label: string;
  value: string;
  city?: string;
};

export async function saveKindeUserToTurso(user: KindeProfile): Promise<void> {
  if (!user?.id) return;
  if (!client) return;

  const fullName =
    [user.givenName, user.familyName].filter(Boolean).join(" ").trim() || user.email || "";
  const now = new Date().toISOString();

  try {
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        givenName TEXT,
        familyName TEXT,
        fullName TEXT,
        phone TEXT,
        document TEXT,
        city TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
    });

    await client.execute({
      sql: `INSERT INTO users (id, email, givenName, familyName, fullName, phone, document, city, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              givenName = excluded.givenName,
              familyName = excluded.familyName,
              fullName = excluded.fullName,
              phone = excluded.phone,
              document = excluded.document,
              city = excluded.city,
              updatedAt = excluded.updatedAt`,
      args: [
        user.id,
        user.email ?? "",
        user.givenName ?? "",
        user.familyName ?? "",
        fullName,
        "",
        "",
        "",
        now,
        now,
      ],
    });
  } catch (error) {
    console.error("Error guardando usuario en Turso:", error);
  }
}

export const getUserProfile = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.userId) return null;

    try {
      const result = await client.execute({
        sql: "SELECT id, email, givenName, familyName, fullName, phone, document, city FROM users WHERE id = ?",
        args: [data.userId],
      });

      if (result.rows.length === 0) return null;
      return result.rows[0] as UserProfileData;
    } catch (error) {
      console.error("Error obteniendo perfil:", error);
      return null;
    }
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .validator(
    (data: { userId: string; email?: string; phone?: string; document?: string; city?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    if (!client || !data.userId) return false;

    try {
      const now = new Date().toISOString();
      const normalizedEmail = data.email?.trim() || "";

      await client.execute({
        sql: `UPDATE users 
              SET email = ?, phone = ?, document = ?, city = ?, updatedAt = ?
              WHERE id = ?`,
        args: [
          normalizedEmail,
          data.phone ?? "",
          data.document ?? "",
          data.city ?? "",
          now,
          data.userId,
        ],
      });
      return true;
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      return false;
    }
  });

export const getUserAddresses = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.userId) return [];

    try {
      await client.execute({
        sql: `CREATE TABLE IF NOT EXISTS user_addresses (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          label TEXT NOT NULL,
          value TEXT NOT NULL,
          city TEXT,
          createdAt TEXT,
          FOREIGN KEY (userId) REFERENCES users(id)
        )`,
      });

      const result = await client.execute({
        sql: "SELECT id, label, value, city FROM user_addresses WHERE userId = ? ORDER BY createdAt DESC",
        args: [data.userId],
      });

      return result.rows as UserAddress[];
    } catch (error) {
      console.error("Error obteniendo direcciones:", error);
      return [];
    }
  });

export const saveUserAddress = createServerFn({ method: "POST" })
  .validator((data: { userId: string; label: string; value: string; city?: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.userId || !data.label || !data.value) return null;

    try {
      await client.execute({
        sql: `CREATE TABLE IF NOT EXISTS user_addresses (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          label TEXT NOT NULL,
          value TEXT NOT NULL,
          city TEXT,
          createdAt TEXT,
          FOREIGN KEY (userId) REFERENCES users(id)
        )`,
      });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO user_addresses (id, userId, label, value, city, createdAt)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, data.userId, data.label, data.value, data.city ?? "", now],
      });

      return { id, label: data.label, value: data.value, city: data.city };
    } catch (error) {
      console.error("Error guardando dirección:", error);
      return null;
    }
  });

export const deleteUserAddress = createServerFn({ method: "POST" })
  .validator((data: { addressId: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.addressId) return false;

    try {
      await client.execute({
        sql: "DELETE FROM user_addresses WHERE id = ?",
        args: [data.addressId],
      });
      return true;
    } catch (error) {
      console.error("Error eliminando dirección:", error);
      return false;
    }
  });

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
  isPrimary?: boolean;
};

async function ensureUserProfileColumns() {
  if (!client) return;

  try {
    const result = await client.execute({ sql: "PRAGMA table_info(users)" });
    const existingColumns = new Set(
      (result.rows ?? []).map((row) => String((row as { name?: string }).name ?? "")),
    );

    const requiredColumns = [
      { name: "email", type: "TEXT" },
      { name: "givenName", type: "TEXT" },
      { name: "familyName", type: "TEXT" },
      { name: "fullName", type: "TEXT" },
      { name: "phone", type: "TEXT" },
      { name: "document", type: "TEXT" },
      { name: "city", type: "TEXT" },
      { name: "createdAt", type: "TEXT" },
      { name: "updatedAt", type: "TEXT" },
    ];

    for (const column of requiredColumns) {
      if (existingColumns.has(column.name)) continue;
      await client.execute({
        sql: `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`,
      });
    }
  } catch (error) {
    console.error("Error migrando columnas del perfil:", error);
  }
}

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
    await ensureUserProfileColumns();

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
    (data: {
      userId: string;
      email?: string;
      givenName?: string;
      familyName?: string;
      phone?: string;
      document?: string;
      city?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!client || !data.userId) return false;

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
      await ensureUserProfileColumns();

      const now = new Date().toISOString();
      const normalizedEmail = data.email?.trim() || "";
      const normalizedGivenName = data.givenName?.trim() || "";
      const normalizedFamilyName = data.familyName?.trim() || "";
      const fullName = [normalizedGivenName, normalizedFamilyName].filter(Boolean).join(" ");

      await client.execute({
        sql: `UPDATE users 
              SET email = ?, givenName = ?, familyName = ?, fullName = ?, phone = ?, document = ?, city = ?, updatedAt = ?
              WHERE id = ?`,
        args: [
          normalizedEmail,
          normalizedGivenName,
          normalizedFamilyName,
          fullName,
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

async function ensureUserAddressColumns() {
  if (!client) return;

  try {
    const result = await client.execute({ sql: "PRAGMA table_info(user_addresses)" });
    const existingColumns = new Set(
      (result.rows ?? []).map((row) => String((row as { name?: string }).name ?? "")),
    );

    const requiredColumns = [
      { name: "userId", type: "TEXT" },
      { name: "label", type: "TEXT" },
      { name: "value", type: "TEXT" },
      { name: "city", type: "TEXT" },
      { name: "isPrimary", type: "INTEGER" },
      { name: "createdAt", type: "TEXT" },
      { name: "updatedAt", type: "TEXT" },
    ];

    for (const column of requiredColumns) {
      if (existingColumns.has(column.name)) continue;
      await client.execute({
        sql: `ALTER TABLE user_addresses ADD COLUMN ${column.name} ${column.type}`,
      });
    }
  } catch (error) {
    console.error("Error migrando columnas de direcciones:", error);
  }
}

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
          isPrimary INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT,
          FOREIGN KEY (userId) REFERENCES users(id)
        )`,
      });
      await ensureUserAddressColumns();

      const result = await client.execute({
        sql: "SELECT id, label, value, city, isPrimary FROM user_addresses WHERE userId = ? ORDER BY isPrimary DESC, createdAt DESC",
        args: [data.userId],
      });

      return result.rows.map((row) => ({
        id: typeof row.id === "string" ? row.id : undefined,
        label: String(row.label ?? ""),
        value: String(row.value ?? ""),
        city: typeof row.city === "string" ? row.city : undefined,
        isPrimary: Boolean(row.isPrimary),
      })) as UserAddress[];
    } catch (error) {
      console.error("Error obteniendo direcciones:", error);
      return [];
    }
  });

export const saveUserAddress = createServerFn({ method: "POST" })
  .validator((data: { userId: string; label: string; value: string; city?: string; isPrimary?: boolean }) => data)
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
          isPrimary INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY (userId) REFERENCES users(id)
        )`,
      });
      await ensureUserAddressColumns();

      const existingPrimary = await client.execute({
        sql: "SELECT id FROM user_addresses WHERE userId = ? AND isPrimary = 1 LIMIT 1",
        args: [data.userId],
      });
      const shouldBePrimary = data.isPrimary === true || existingPrimary.rows.length === 0;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO user_addresses (id, userId, label, value, city, isPrimary, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, data.userId, data.label, data.value, data.city ?? "", shouldBePrimary ? 1 : 0, now, now],
      });

      return { id, label: data.label, value: data.value, city: data.city, isPrimary: shouldBePrimary };
    } catch (error) {
      console.error("Error guardando dirección:", error);
      return null;
    }
  });

export const updateUserAddress = createServerFn({ method: "POST" })
  .validator((data: { userId: string; addressId: string; label: string; value: string; city?: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.userId || !data.addressId || !data.label || !data.value) return false;

    try {
      await client.execute({
        sql: `UPDATE user_addresses
              SET label = ?, value = ?, city = ?, updatedAt = ?
              WHERE id = ? AND userId = ?`,
        args: [data.label.trim(), data.value.trim(), data.city ?? "", new Date().toISOString(), data.addressId, data.userId],
      });
      return true;
    } catch (error) {
      console.error("Error actualizando dirección:", error);
      return false;
    }
  });

export const setPrimaryUserAddress = createServerFn({ method: "POST" })
  .validator((data: { userId: string; addressId: string }) => data)
  .handler(async ({ data }) => {
    if (!client || !data.userId || !data.addressId) return false;

    try {
      await client.execute({
        sql: `UPDATE user_addresses SET isPrimary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE userId = ?`,
        args: [data.addressId, data.userId],
      });
      return true;
    } catch (error) {
      console.error("Error marcando dirección principal:", error);
      return false;
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

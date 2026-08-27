import { createServerFn } from "@tanstack/react-start";
import type { BrandSlug } from "@/config/brands";
import { adminClient, client } from "@/lib/db";
import type { Order } from "@/data/orders";
import type { Product } from "@/data/products";

export type CartItem = {
  id: string;
  slug: string;
  brand: BrandSlug;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  stock: number;
};

type UserIdentity = { id: string; email?: string };

type AdminSetting = { settingKey: string; settingValue: string };

function getDatabase() {
  return client;
}

async function ensureUserTables() {
  const database = getDatabase();
  if (!database) return null;
  await database.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        givenName TEXT,
        familyName TEXT,
        fullName TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_carts (
        userId TEXT PRIMARY KEY,
        items TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS guest_carts (
        sessionId TEXT PRIMARY KEY,
        items TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        userId TEXT NOT NULL,
        productId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (userId, productId)
      )`,
      `CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS customer_orders (
        id TEXT PRIMARY KEY,
        userId TEXT,
        guestSessionId TEXT,
        orderData TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,
    ],
    "write",
  );
  return database;
}

async function ensureAdminTables() {
  const database = adminClient;
  if (!database) return null;
  await database.batch(
    [
      `CREATE TABLE IF NOT EXISTS admins (
      userId TEXT PRIMARY KEY,
      email TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS admin_settings (
      settingKey TEXT PRIMARY KEY,
      settingValue TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        productData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        variantData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        orderData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        supplierData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS trash (
        id TEXT PRIMARY KEY,
        itemType TEXT NOT NULL,
        itemData TEXT NOT NULL,
        deletedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS site_visitors (
        visitorId TEXT PRIMARY KEY,
        visits INTEGER NOT NULL DEFAULT 0,
        firstSeenAt TEXT NOT NULL,
        lastSeenAt TEXT NOT NULL
      )`,
    ],
    "write",
  );
  return database;
}

function isConfiguredAdmin(user: UserIdentity) {
  const adminUserId = import.meta.env["ADMIN_USER_ID"]?.trim();
  const adminEmail = import.meta.env["ADMIN_EMAIL"]?.trim().toLowerCase();
  return Boolean(
    (adminUserId && user.id === adminUserId) ||
    (adminEmail && user.email?.trim().toLowerCase() === adminEmail),
  );
}

export const loadUserCart = createServerFn({ method: "POST" })
  .validator((data: UserIdentity) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT items FROM user_carts WHERE userId = ?",
      args: [data.id],
    });
    const items = result.rows[0]?.["items"];
    return typeof items === "string" ? (JSON.parse(items) as CartItem[]) : [];
  });

export const saveUserCart = createServerFn({ method: "POST" })
  .validator((data: UserIdentity & { items: CartItem[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return false;
    await database.execute({
      sql: `INSERT INTO user_carts (userId, items, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(userId) DO UPDATE SET items = excluded.items, updatedAt = excluded.updatedAt`,
      args: [data.id, JSON.stringify(data.items), new Date().toISOString()],
    });
    return true;
  });

export const loadGuestCart = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT items, expiresAt FROM guest_carts WHERE sessionId = ?",
      args: [data.sessionId],
    });
    const row = result.rows[0];
    const expiresAt = row?.["expiresAt"];
    if (typeof expiresAt !== "string" || new Date(expiresAt).getTime() <= Date.now()) return [];
    const items = row?.["items"];
    return typeof items === "string" ? (JSON.parse(items) as CartItem[]) : [];
  });

export const saveGuestCart = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; items: CartItem[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return false;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await database.execute({
      sql: `INSERT INTO guest_carts (sessionId, items, expiresAt, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(sessionId) DO UPDATE SET
              items = excluded.items,
              expiresAt = excluded.expiresAt,
              updatedAt = excluded.updatedAt`,
      args: [
        data.sessionId,
        JSON.stringify(data.items),
        expiresAt.toISOString(),
        now.toISOString(),
      ],
    });
    return true;
  });

export const loadFavorites = createServerFn({ method: "POST" })
  .validator((data: UserIdentity) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return [];
    const result = await database.execute({
      sql: "SELECT productId FROM favorites WHERE userId = ?",
      args: [data.id],
    });
    return result.rows.flatMap((row) => {
      const productId = row["productId"];
      return typeof productId === "string" ? [productId] : [];
    });
  });

export const saveFavorites = createServerFn({ method: "POST" })
  .validator((data: UserIdentity & { productIds: string[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureUserTables();
    if (!database) return false;
    await database.batch(
      [
        { sql: "DELETE FROM favorites WHERE userId = ?", args: [data.id] },
        ...data.productIds.map((productId) => ({
          sql: "INSERT INTO favorites (userId, productId, createdAt) VALUES (?, ?, ?)",
          args: [data.id, productId, new Date().toISOString()],
        })),
      ],
      "write",
    );
    return true;
  });

export const registerAdminIdentity = createServerFn({ method: "POST" })
  .validator((data: UserIdentity) => data)
  .handler(async ({ data }) => {
    if (!isConfiguredAdmin(data)) return false;
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO admins (userId, email, createdAt, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(userId) DO UPDATE SET email = excluded.email, updatedAt = excluded.updatedAt`,
      args: [data.id, data.email ?? "", now, now],
    });
    return true;
  });

export const verifyRegisteredAdmin = createServerFn({ method: "POST" })
  .validator((data: UserIdentity) => data)
  .handler(async ({ data }) => {
    if (!isConfiguredAdmin(data)) return false;
    const database = await ensureAdminTables();
    if (!database) return false;
    const result = await database.execute({
      sql: "SELECT userId FROM admins WHERE userId = ?",
      args: [data.id],
    });
    return result.rows.length > 0;
  });

export const loadAdminSettings = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute("SELECT settingKey, settingValue FROM admin_settings");
    return result.rows.flatMap((row) => {
      const settingKey = row["settingKey"];
      const settingValue = row["settingValue"];
      return typeof settingKey === "string" && typeof settingValue === "string"
        ? [{ settingKey, settingValue } satisfies AdminSetting]
        : [];
    });
  });

export const ensureAdminSettings = createServerFn({ method: "POST" })
  .validator((data: { settings: AdminSetting[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.batch(
      data.settings.map((setting) => ({
        sql: `INSERT INTO admin_settings (settingKey, settingValue, updatedAt)
              VALUES (?, ?, ?)
              ON CONFLICT(settingKey) DO NOTHING`,
        args: [setting.settingKey, setting.settingValue, now],
      })),
      "write",
    );
    return true;
  });

export const saveAdminSetting = createServerFn({ method: "POST" })
  .validator((data: AdminSetting) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({
      sql: `INSERT INTO admin_settings (settingKey, settingValue, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(settingKey) DO UPDATE SET
              settingValue = excluded.settingValue,
              updatedAt = excluded.updatedAt`,
      args: [data.settingKey, data.settingValue, new Date().toISOString()],
    });
    return true;
  });

export const listAdminProducts = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      "SELECT productData FROM products ORDER BY updatedAt DESC",
    );
    return result.rows.flatMap((row) => {
      const value = row["productData"];
      if (typeof value !== "string") return [];
      try {
        return [JSON.parse(value) as Product];
      } catch {
        return [];
      }
    });
  });

export const saveAdminProducts = createServerFn({ method: "POST" })
  .validator((data: { products: Product[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.batch(
      [
        { sql: "DELETE FROM products", args: [] },
        ...data.products.map((product) => ({
          sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
          args: [product.id, JSON.stringify(product), now],
        })),
      ],
      "write",
    );
    return true;
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({ sql: "DELETE FROM products WHERE id = ?", args: [data.id] });
    return true;
  });

export const listAdminOrders = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute("SELECT orderData FROM orders ORDER BY updatedAt DESC");
    return result.rows.flatMap((row) => {
      const value = row["orderData"];
      if (typeof value !== "string") return [];
      try {
        return [JSON.parse(value) as Order];
      } catch {
        return [];
      }
    });
  });

export const upsertAdminOrder = createServerFn({ method: "POST" })
  .validator((data: { order: Order }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({
      sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET orderData = excluded.orderData, updatedAt = excluded.updatedAt`,
      args: [data.order.id, JSON.stringify(data.order), new Date().toISOString()],
    });
    return true;
  });

export const saveAdminOrders = createServerFn({ method: "POST" })
  .validator((data: { orders: Order[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.batch(
      [
        { sql: "DELETE FROM orders", args: [] },
        ...data.orders.map((order) => ({
          sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET orderData = excluded.orderData, updatedAt = excluded.updatedAt`,
          args: [order.id, JSON.stringify(order), now],
        })),
      ],
      "write",
    );
    return true;
  });

export const deleteAdminOrder = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({ sql: "DELETE FROM orders WHERE id = ?", args: [data.id] });
    return true;
  });

export const recordSiteVisit = createServerFn({ method: "POST" })
  .validator((data: { visitorId: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database || !data.visitorId) return false;
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO site_visitors (visitorId, visits, firstSeenAt, lastSeenAt)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(visitorId) DO UPDATE SET
              visits = site_visitors.visits + 1,
              lastSeenAt = excluded.lastSeenAt`,
      args: [data.visitorId, now, now],
    });
    return true;
  });

export const loadSiteStats = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return { totalVisits: 0, uniqueVisitors: 0 };
    const result = await database.execute(
      "SELECT COUNT(*) AS uniqueVisitors, COALESCE(SUM(visits), 0) AS totalVisits FROM site_visitors",
    );
    const row = result.rows[0];
    return {
      totalVisits: Number(row?.["totalVisits"] ?? 0),
      uniqueVisitors: Number(row?.["uniqueVisitors"] ?? 0),
    };
  });

import { createServerFn } from "@tanstack/react-start";
import type { BrandSlug } from "@/config/brands";
import { adminClient, client } from "@/lib/db";
import type { Order } from "@/data/orders";
import type { Product } from "@/data/products";
import {
  getProductIdentityFromPublicSlug,
  getProductRecordIdentityFromPublicSlug,
  getProductVariantIdentityFromPublicSlug,
} from "@/lib/product-slug";
import {
  assessStockReservation,
  getInventoryKey,
  splitInventoryKey,
  STOCK_RESERVATION_TTL_MS,
  type ReservationRecord,
  type ReservationState,
} from "@/lib/stock-reservations";
import { parsePerfumeNotesResponse } from "@/server/perfume-ai-import.server";

export type CartItem = {
  id: string;
  slug: string;
  brand: BrandSlug;
  name: string;
  category?: string;
  subcategory?: string;
  variantName?: string;
  cardCommission?: boolean;
  image?: string;
  price: number;
  priceCurrency?: "ARS" | "USD";
  gastos?: number;
  gastosCurrency?: "ARS" | "USD";
  usdRate?: number;
  quantity: number;
  stock: number;
  stockUnlimited?: boolean;
};

type UserIdentity = { id: string; email?: string };

type AdminSetting = { settingKey: string; settingValue: string };

function getDatabase() {
  return client;
}

function getPublicSlugIdentityLookup(slug: string) {
  const identity = getProductIdentityFromPublicSlug(slug);
  const productId = getProductRecordIdentityFromPublicSlug(slug);
  const variantId = getProductVariantIdentityFromPublicSlug(slug);
  if (!identity || !productId) return { condition: "", args: [] as string[] };
  if (variantId) {
    return {
      condition:
        "OR (id = ? AND EXISTS (SELECT 1 FROM json_each(productData, '$.variants') AS variant WHERE json_extract(variant.value, '$.id') = ?))",
      args: [productId, variantId],
    };
  }
  return { condition: "OR id = ?", args: [productId] };
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

let adminTablesPromise: Promise<typeof adminClient> | null = null;

function ensureAdminTables() {
  if (adminTablesPromise) return adminTablesPromise;

  adminTablesPromise = (async () => {
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
        `CREATE TABLE IF NOT EXISTS admin_assets (
      assetKey TEXT PRIMARY KEY,
      dataUrl TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
        `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        productData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
        `CREATE INDEX IF NOT EXISTS products_updated_at_idx
        ON products (updatedAt DESC)`,
        `CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        variantData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS stock_reservations (
        inventoryKey TEXT NOT NULL,
        ownerId TEXT NOT NULL,
        visitId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        expiresAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (inventoryKey, ownerId)
      )`,
        `CREATE INDEX IF NOT EXISTS stock_reservations_expiration_idx
        ON stock_reservations (expiresAt)`,
        `CREATE TABLE IF NOT EXISTS stock_reservation_queue (
        inventoryKey TEXT NOT NULL,
        ownerId TEXT NOT NULL,
        visitId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        requestedAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (inventoryKey, ownerId)
      )`,
        `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        orderData TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS payment_intents (
        id TEXT PRIMARY KEY,
        intentData TEXT NOT NULL,
        status TEXT NOT NULL,
        orderId TEXT,
        createdAt TEXT NOT NULL,
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
        `CREATE TABLE IF NOT EXISTS database_backups (
        id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        snapshotData TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS database_backup_trash (
        id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        snapshotData TEXT NOT NULL,
        createdAt TEXT NOT NULL,
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
    try {
      await database.execute("ALTER TABLE payment_intents ADD COLUMN orderId TEXT");
    } catch {
      // Existing databases already have the column.
    }
    return database;
  })().catch((error) => {
    adminTablesPromise = null;
    throw error;
  });

  return adminTablesPromise;
}

export type CartReservationStatus = {
  id: string;
  inventoryKey: string;
  state: ReservationState;
  expiresAt?: string;
  availableQuantity: number;
  queuePosition?: number;
};

type CartReservationRequest = {
  ownerId: string;
  visitId: string;
  items: Array<{ id: string; quantity: number }>;
};

function validateCartReservationRequest(data: CartReservationRequest) {
  if (!data.ownerId.trim() || data.ownerId.length > 300) {
    throw new Error("No se pudo identificar tu sesión para reservar el stock.");
  }
  if (!data.visitId.trim() || data.visitId.length > 100) {
    throw new Error("La sesión de reserva no es válida. Recargá el carrito.");
  }
  if (!Array.isArray(data.items) || data.items.length > 100) {
    throw new Error("La cantidad de productos para reservar no es válida.");
  }
  for (const item of data.items) {
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 500 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 500
    ) {
      throw new Error("Hay un producto con una cantidad de reserva no válida.");
    }
  }
  return data;
}

function readReservationProduct(productData: unknown, variantId?: string) {
  if (typeof productData !== "string") return null;
  try {
    const product = JSON.parse(productData) as Product;
    const variant = variantId ? product.variants?.find((item) => item.id === variantId) : undefined;
    if (variantId && !variant) return null;
    return {
      product,
      variant,
      stock: Math.max(0, Number(variant?.stock ?? product.stock) || 0),
      stockUnlimited: variant?.stockUnlimited ?? product.stockUnlimited ?? false,
    };
  } catch {
    return null;
  }
}

function readReservationRecords(rows: Array<Record<string, unknown>>): ReservationRecord[] {
  return rows.flatMap((row) => {
    const ownerId = row["ownerId"];
    const visitId = row["visitId"];
    const quantity = Number(row["quantity"]);
    const expiresAt = row["expiresAt"];
    return typeof ownerId === "string" &&
      typeof visitId === "string" &&
      Number.isInteger(quantity) &&
      typeof expiresAt === "string"
      ? [{ ownerId, visitId, quantity, expiresAt }]
      : [];
  });
}

const PAYMENT_HOLD_TTL_MS = 20 * 60 * 1000;

export const reserveCartStock = createServerFn({ method: "POST" })
  .validator(validateCartReservationRequest)
  .handler(async ({ data }): Promise<CartReservationStatus[]> => {
    const database = await ensureAdminTables();
    if (!database) {
      return data.items.map((item) => ({
        id: item.id,
        inventoryKey: item.id,
        state: "unavailable",
        availableQuantity: 0,
      }));
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const staleQueueBefore = new Date(now - 30_000).toISOString();
    const groupedItems = new Map<string, { id: string; quantity: number }>();
    for (const item of data.items) {
      const current = groupedItems.get(item.id);
      groupedItems.set(item.id, {
        id: item.id,
        quantity: (current?.quantity ?? 0) + item.quantity,
      });
    }

    const transaction = await database.transaction("write");
    try {
      const statuses: CartReservationStatus[] = [];
      for (const item of groupedItems.values()) {
        const inventoryKey = item.id;
        const { productId, variantId } = splitInventoryKey(inventoryKey);
        const productResult = await transaction.execute({
          sql: "SELECT productData FROM products WHERE id = ?",
          args: [productId],
        });
        const productRow = productResult.rows[0];
        const inventory = readReservationProduct(productRow?.["productData"], variantId);
        if (!inventory || inventory.product.hidden || inventory.variant?.hidden) {
          statuses.push({ id: item.id, inventoryKey, state: "unavailable", availableQuantity: 0 });
          continue;
        }

        const reservationResult = await transaction.execute({
          sql: "SELECT ownerId, visitId, quantity, expiresAt FROM stock_reservations WHERE inventoryKey = ?",
          args: [inventoryKey],
        });
        const records = readReservationRecords(reservationResult.rows);
        const assessment = assessStockReservation({
          stock: inventory.stock,
          stockUnlimited: inventory.stockUnlimited,
          ownerId: data.ownerId,
          visitId: data.visitId,
          requestedQuantity: item.quantity,
          records,
          now,
        });

        await transaction.execute({
          sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND updatedAt <= ?",
          args: [inventoryKey, staleQueueBefore],
        });
        const hasOwnActiveReservation = records.some(
          (record) => record.ownerId === data.ownerId && new Date(record.expiresAt).getTime() > now,
        );

        if (assessment.state === "waiting" && !hasOwnActiveReservation) {
          await transaction.execute({
            sql: `INSERT INTO stock_reservation_queue
                    (inventoryKey, ownerId, visitId, quantity, requestedAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(inventoryKey, ownerId) DO UPDATE SET
                    visitId = excluded.visitId,
                    quantity = excluded.quantity,
                    updatedAt = excluded.updatedAt`,
            args: [inventoryKey, data.ownerId, data.visitId, item.quantity, nowIso, nowIso],
          });
        }

        if (assessment.state === "available") {
          const queueResult = await transaction.execute({
            sql: `SELECT ownerId, requestedAt FROM stock_reservation_queue
                  WHERE inventoryKey = ? AND updatedAt > ?
                  ORDER BY requestedAt ASC, ownerId ASC`,
            args: [inventoryKey, staleQueueBefore],
          });
          const queueRows = queueResult.rows.flatMap((row) =>
            typeof row["ownerId"] === "string" && typeof row["requestedAt"] === "string"
              ? [{ ownerId: row["ownerId"] as string, requestedAt: row["requestedAt"] as string }]
              : [],
          );
          if (queueRows.length && queueRows[0]?.ownerId !== data.ownerId) {
            await transaction.execute({
              sql: `INSERT INTO stock_reservation_queue
                      (inventoryKey, ownerId, visitId, quantity, requestedAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(inventoryKey, ownerId) DO UPDATE SET updatedAt = excluded.updatedAt`,
              args: [inventoryKey, data.ownerId, data.visitId, item.quantity, nowIso, nowIso],
            });
            const position = queueRows.findIndex((row) => row.ownerId === data.ownerId);
            statuses.push({
              id: item.id,
              inventoryKey,
              state: "waiting",
              availableQuantity: assessment.availableQuantity,
              queuePosition: position >= 0 ? position + 1 : queueRows.length + 1,
            });
            continue;
          }
        }

        if (assessment.state === "available") {
          const expiresAt = new Date(now + STOCK_RESERVATION_TTL_MS).toISOString();
          await transaction.execute({
            sql: `INSERT INTO stock_reservations (inventoryKey, ownerId, visitId, quantity, expiresAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(inventoryKey, ownerId) DO UPDATE SET
                    visitId = excluded.visitId,
                    quantity = excluded.quantity,
                    expiresAt = excluded.expiresAt,
                    updatedAt = excluded.updatedAt`,
            args: [inventoryKey, data.ownerId, data.visitId, item.quantity, expiresAt, nowIso],
          });
          await transaction.execute({
            sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
            args: [inventoryKey, data.ownerId],
          });
          statuses.push({
            id: item.id,
            inventoryKey,
            state: "reserved",
            expiresAt,
            availableQuantity: assessment.availableQuantity,
          });
          continue;
        }

        if (assessment.state === "reserved") {
          await transaction.execute({
            sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
            args: [inventoryKey, data.ownerId],
          });
          const ownRecord = records.find(
            (record) => record.ownerId === data.ownerId && record.expiresAt === assessment.expiresAt,
          );
          if (ownRecord && ownRecord.quantity !== item.quantity) {
            await transaction.execute({
              sql: `UPDATE stock_reservations SET quantity = ?, updatedAt = ?
                    WHERE inventoryKey = ? AND ownerId = ? AND expiresAt = ?`,
              args: [item.quantity, nowIso, inventoryKey, data.ownerId, ownRecord.expiresAt],
            });
          }
        }
        let queuePosition: number | undefined;
        if (assessment.state === "waiting" && !hasOwnActiveReservation) {
          const queueResult = await transaction.execute({
            sql: `SELECT ownerId FROM stock_reservation_queue WHERE inventoryKey = ? AND updatedAt > ?
                  ORDER BY requestedAt ASC, ownerId ASC`,
            args: [inventoryKey, staleQueueBefore],
          });
          const position = queueResult.rows.findIndex((row) => row["ownerId"] === data.ownerId);
          if (position >= 0) queuePosition = position + 1;
        }
        statuses.push({ id: item.id, inventoryKey, ...assessment, ...(queuePosition ? { queuePosition } : {}) });
      }
      await transaction.commit();
      return statuses;
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  });

export const getCartStockReservationStatus = createServerFn({ method: "POST" })
  .validator(validateCartReservationRequest)
  .handler(async ({ data }): Promise<CartReservationStatus[]> => {
    const database = await ensureAdminTables();
    if (!database) {
      return data.items.map((item) => ({
        id: item.id,
        inventoryKey: item.id,
        state: "unavailable",
        availableQuantity: 0,
      }));
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const staleQueueBefore = new Date(now - 30_000).toISOString();
    const statuses: CartReservationStatus[] = [];
    for (const item of data.items) {
      const inventoryKey = item.id;
      const { productId, variantId } = splitInventoryKey(inventoryKey);
      await database.execute({
        sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND updatedAt <= ?",
        args: [inventoryKey, staleQueueBefore],
      });
      await database.execute({
        sql: "UPDATE stock_reservation_queue SET updatedAt = ? WHERE inventoryKey = ? AND ownerId = ?",
        args: [nowIso, inventoryKey, data.ownerId],
      });
      const productResult = await database.execute({
        sql: "SELECT productData FROM products WHERE id = ?",
        args: [productId],
      });
      const productRow = productResult.rows[0];
      const inventory = readReservationProduct(productRow?.["productData"], variantId);
      if (!inventory || inventory.product.hidden || inventory.variant?.hidden) {
        statuses.push({ id: item.id, inventoryKey, state: "unavailable", availableQuantity: 0 });
        continue;
      }

      const reservationResult = await database.execute({
        sql: "SELECT ownerId, visitId, quantity, expiresAt FROM stock_reservations WHERE inventoryKey = ?",
        args: [inventoryKey],
      });
      const assessment = assessStockReservation({
        stock: inventory.stock,
        stockUnlimited: inventory.stockUnlimited,
        ownerId: data.ownerId,
        visitId: data.visitId,
        requestedQuantity: item.quantity,
        records: readReservationRecords(reservationResult.rows),
        now,
      });
      let queuePosition: number | undefined;
      let state = assessment.state;
      if (state === "available" || (state === "waiting" && !assessment.expiresAt)) {
        const queueResult = await database.execute({
          sql: `SELECT ownerId FROM stock_reservation_queue WHERE inventoryKey = ? AND updatedAt > ?
                ORDER BY requestedAt ASC, ownerId ASC`,
          args: [inventoryKey, staleQueueBefore],
        });
        const queueRows = queueResult.rows;
        const firstOwner = queueRows[0]?.["ownerId"];
        const position = queueRows.findIndex((row) => row["ownerId"] === data.ownerId);
        if (firstOwner && firstOwner !== data.ownerId) {
          state = "waiting";
          queuePosition = position >= 0 ? position + 1 : queueRows.length + 1;
        } else if (position >= 0) {
          queuePosition = position + 1;
        }
      } else if (state === "waiting") {
        const queueResult = await database.execute({
          sql: `SELECT ownerId FROM stock_reservation_queue WHERE inventoryKey = ? AND updatedAt > ?
                ORDER BY requestedAt ASC, ownerId ASC`,
          args: [inventoryKey, staleQueueBefore],
        });
        const position = queueResult.rows.findIndex((row) => row["ownerId"] === data.ownerId);
        if (position >= 0) queuePosition = position + 1;
      }
      statuses.push({ id: item.id, inventoryKey, ...assessment, state, ...(queuePosition ? { queuePosition } : {}) });
    }
    return statuses;
  });

export const releaseCartStockReservations = createServerFn({ method: "POST" })
  .validator((data: { ownerId: string; inventoryKeys?: string[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database || !data.ownerId.trim()) return false;
    if (!data.inventoryKeys?.length) {
      await database.batch(
        [
          { sql: "DELETE FROM stock_reservations WHERE ownerId = ?", args: [data.ownerId] },
          { sql: "DELETE FROM stock_reservation_queue WHERE ownerId = ?", args: [data.ownerId] },
        ],
        "write",
      );
      return true;
    }
    await database.batch(
      data.inventoryKeys.flatMap((inventoryKey) => [
        {
          sql: "DELETE FROM stock_reservations WHERE inventoryKey = ? AND ownerId = ?",
          args: [inventoryKey, data.ownerId],
        },
        {
          sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
          args: [inventoryKey, data.ownerId],
        },
      ]),
      "write",
    );
    return true;
  });

export const startReservedPaymentHold = createServerFn({ method: "POST" })
  .validator(
    (data: {
      ownerId: string;
      items: Array<{ productId?: string; variantId?: string; quantity: number }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database || !data.ownerId.trim()) {
      return { ok: false as const, reason: "reservation_lost" as const };
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let paymentExpiresAt = new Date(now + PAYMENT_HOLD_TTL_MS).toISOString();
    const transaction = await database.transaction("write");
    try {
      const itemGroups = new Map<string, number>();
      for (const item of data.items) {
        if (!item.productId) {
          await transaction.rollback();
          return { ok: false as const, reason: "reservation_lost" as const };
        }
        const key = getInventoryKey(item.productId, item.variantId);
        itemGroups.set(key, (itemGroups.get(key) ?? 0) + item.quantity);
      }

      for (const [inventoryKey, quantity] of itemGroups) {
        const { productId, variantId } = splitInventoryKey(inventoryKey);
        const productResult = await transaction.execute({
          sql: "SELECT productData FROM products WHERE id = ?",
          args: [productId],
        });
        const inventory = readReservationProduct(productResult.rows[0]?.["productData"], variantId);
        if (!inventory || inventory.stock < quantity) {
          await transaction.rollback();
          return { ok: false as const, reason: "out_of_stock" as const };
        }
        if (inventory.stockUnlimited) continue;

        const reservationResult = await transaction.execute({
          sql: `SELECT quantity, expiresAt FROM stock_reservations
                WHERE inventoryKey = ? AND ownerId = ? AND expiresAt > ?`,
          args: [inventoryKey, data.ownerId, nowIso],
        });
        if (Number(reservationResult.rows[0]?.["quantity"] ?? 0) < quantity) {
          await transaction.rollback();
          return { ok: false as const, reason: "reservation_lost" as const };
        }
        const reservationExpiresAt = reservationResult.rows[0]?.["expiresAt"];
        if (
          typeof reservationExpiresAt === "string" &&
          reservationExpiresAt < paymentExpiresAt
        ) {
          paymentExpiresAt = reservationExpiresAt;
        }
      }

      for (const [inventoryKey] of itemGroups) {
        await transaction.execute({
          sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
          args: [inventoryKey, data.ownerId],
        });
      }
      await transaction.commit();
      return { ok: true as const, expiresAt: paymentExpiresAt };
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  });

export const completeReservedStockOrder = createServerFn({ method: "POST" })
  .validator((data: { ownerId: string; order: Order }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database || !data.ownerId.trim()) {
      return { ok: false as const, reason: "reservation_lost" as const };
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const transaction = await database.transaction("write");
    try {
      const duplicateOrder = await transaction.execute({
        sql: "SELECT id FROM orders WHERE id = ?",
        args: [data.order.id],
      });
      if (duplicateOrder.rows.length) {
        await transaction.commit();
        return { ok: true as const, duplicate: true as const };
      }

      const itemGroups = new Map<string, number>();
      for (const item of data.order.items) {
        if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
          await transaction.rollback();
          return { ok: false as const, reason: "reservation_lost" as const };
        }
        const inventoryKey = getInventoryKey(item.productId, item.variantId);
        itemGroups.set(inventoryKey, (itemGroups.get(inventoryKey) ?? 0) + item.quantity);
      }

      const updatedProducts = new Map<string, Product>();
      for (const [inventoryKey, quantity] of itemGroups) {
        const { productId, variantId } = splitInventoryKey(inventoryKey);
        let product = updatedProducts.get(productId);
        if (!product) {
          const result = await transaction.execute({
            sql: "SELECT productData FROM products WHERE id = ?",
            args: [productId],
          });
          const parsed = readReservationProduct(result.rows[0]?.["productData"], variantId);
          if (!parsed) {
            await transaction.rollback();
            return { ok: false as const, reason: "out_of_stock" as const };
          }
          product = structuredClone(parsed.product);
          updatedProducts.set(productId, product);
        }

        const variant = variantId ? product.variants?.find((entry) => entry.id === variantId) : undefined;
        if (variantId && !variant) {
          await transaction.rollback();
          return { ok: false as const, reason: "out_of_stock" as const };
        }
        const stockUnlimited = variant?.stockUnlimited ?? product.stockUnlimited ?? false;
        const currentStock = variant?.stock ?? product.stock;
        if (!stockUnlimited && currentStock < quantity) {
          await transaction.rollback();
          return { ok: false as const, reason: "out_of_stock" as const };
        }
        if (stockUnlimited) continue;

        const reservationResult = await transaction.execute({
          sql: `SELECT quantity FROM stock_reservations
                WHERE inventoryKey = ? AND ownerId = ? AND expiresAt > ?`,
          args: [inventoryKey, data.ownerId, nowIso],
        });
        if (Number(reservationResult.rows[0]?.["quantity"] ?? 0) < quantity) {
          await transaction.rollback();
          return { ok: false as const, reason: "reservation_lost" as const };
        }
        if (variant) variant.stock = Math.max(0, variant.stock - quantity);
        else product.stock = Math.max(0, product.stock - quantity);
      }

      for (const [productId, product] of updatedProducts) {
        await transaction.execute({
          sql: "UPDATE products SET productData = ?, updatedAt = ? WHERE id = ?",
          args: [JSON.stringify(product), nowIso, productId],
        });
      }
      await transaction.execute({
        sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET orderData = excluded.orderData, updatedAt = excluded.updatedAt`,
        args: [data.order.id, JSON.stringify(data.order), nowIso],
      });
      for (const inventoryKey of itemGroups.keys()) {
        await transaction.execute({
          sql: "DELETE FROM stock_reservations WHERE inventoryKey = ? AND ownerId = ?",
          args: [inventoryKey, data.ownerId],
        });
        await transaction.execute({
          sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
          args: [inventoryKey, data.ownerId],
        });
      }
      await transaction.commit();
      try {
        await createDatabaseBackup(`order-purchase:${data.order.id}`);
      } catch (error) {
        console.error("No se pudo crear el backup automático del pedido:", error);
      }
      return { ok: true as const, duplicate: false as const };
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  });

async function createDatabaseBackup(reason: string) {
  const adminDatabase = await ensureAdminTables();
  if (!adminDatabase) return false;

  const adminTables = [
    "admins",
    "admin_settings",
    "admin_assets",
    "products",
    "product_variants",
    "orders",
    "payment_intents",
    "suppliers",
    "trash",
    "site_visitors",
  ];
  const userTables = [
    "users",
    "user_carts",
    "guest_carts",
    "favorites",
    "addresses",
    "customer_orders",
  ];
  const [adminResults, userDatabase] = await Promise.all([
    Promise.all(
      adminTables.map((table) =>
        table === "admin_settings"
          ? adminDatabase.execute(
              "SELECT settingKey, settingValue, updatedAt FROM admin_settings WHERE settingKey != 'lrg:trash'",
            )
          : adminDatabase.execute(`SELECT * FROM ${table}`),
      ),
    ),
    ensureUserTables(),
  ]);
  const userResults = userDatabase
    ? await Promise.all(userTables.map((table) => userDatabase.execute(`SELECT * FROM ${table}`)))
    : [];
  const now = new Date().toISOString();
  const snapshotData = JSON.stringify({
    createdAt: now,
    admin: Object.fromEntries(
      adminTables.map((table, index) => [table, adminResults[index]?.rows ?? []]),
    ),
    user: Object.fromEntries(
      userTables.map((table, index) => [table, userResults[index]?.rows ?? []]),
    ),
  });
  const backupId = `${reason}:${now}`;

  await adminDatabase.execute({
    sql: `INSERT INTO database_backups (id, reason, snapshotData, createdAt)
          VALUES (?, ?, ?, ?)`,
    args: [backupId, reason, snapshotData, now],
  });
  return true;
}

async function migrateLegacyBackupTrash(
  database: NonNullable<Awaited<ReturnType<typeof ensureAdminTables>>>,
) {
  const settings = await database.execute({
    sql: "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
    args: ["lrg:trash"],
  });
  const raw = settings.rows[0]?.["settingValue"];
  if (typeof raw !== "string" || raw.length < 2) return;

  let entries: unknown;
  try {
    entries = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(entries)) return;

  const backupEntries = entries.filter(
    (
      entry,
    ): entry is {
      type: "backup";
      id: string;
      item: { reason: string; createdAt: string; snapshotData?: string };
      deletedAt: string;
      expiresAt: string;
    } =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        (entry as { type?: unknown }).type === "backup" &&
        typeof (entry as { id?: unknown }).id === "string" &&
        typeof (entry as { deletedAt?: unknown }).deletedAt === "string" &&
        typeof (entry as { expiresAt?: unknown }).expiresAt === "string",
      ),
  );
  if (!backupEntries.length) return;

  await database.batch(
    backupEntries.map((entry) => ({
      sql: `INSERT INTO database_backup_trash (id, reason, snapshotData, createdAt, deletedAt, expiresAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`,
      args: [
        entry.id,
        entry.item.reason,
        entry.item.snapshotData ?? "{}",
        entry.item.createdAt || entry.deletedAt,
        entry.deletedAt,
        entry.expiresAt,
      ],
    })),
    "write",
  );

  const remainingEntries = entries.filter(
    (entry) => !backupEntries.includes(entry as (typeof backupEntries)[number]),
  );
  await database.execute({
    sql: "UPDATE admin_settings SET settingValue = ?, updatedAt = ? WHERE settingKey = ?",
    args: [JSON.stringify(remainingEntries), new Date().toISOString(), "lrg:trash"],
  });
}

export const initializeDatabase = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const adminDatabase = await ensureAdminTables();
    await Promise.all([
      ensureUserTables(),
      adminDatabase ? migrateLegacyBackupTrash(adminDatabase) : null,
    ]);

    return true;
  });

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

export const loadAdminSettings = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      "SELECT settingKey, settingValue FROM admin_settings WHERE settingKey != 'lrg:trash'",
    );
    return result.rows.flatMap((row) => {
      const settingKey = row["settingKey"];
      const settingValue = row["settingValue"];
      return typeof settingKey === "string" && typeof settingValue === "string"
        ? [{ settingKey, settingValue } satisfies AdminSetting]
        : [];
    });
  });

export const loadAdminSettingByKey = createServerFn({ method: "POST" })
  .validator((data: { settingKey: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
      args: [data.settingKey],
    });
    const value = result.rows[0]?.["settingValue"];
    return typeof value === "string" ? value : null;
  });

export const loadAdminAsset = createServerFn({ method: "POST" })
  .validator((data: { assetKey: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT dataUrl FROM admin_assets WHERE assetKey = ?",
      args: [data.assetKey],
    });
    const dataUrl = result.rows[0]?.["dataUrl"];
    return typeof dataUrl === "string" ? dataUrl : null;
  });

export const saveAdminAsset = createServerFn({ method: "POST" })
  .validator((data: { assetKey: string; dataUrl: string }) => {
    if (data.assetKey !== "product-import-header") {
      throw new Error("El recurso que intentás guardar no está permitido.");
    }
    if (data.dataUrl && !data.dataUrl.startsWith("data:image/")) {
      throw new Error("El archivo de cabecera no es una imagen válida.");
    }
    if (new TextEncoder().encode(data.dataUrl).byteLength > 1_600_000) {
      throw new Error("La cabecera es demasiado grande; reducí el tamaño de la imagen.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    if (!data.dataUrl) {
      await database.execute({
        sql: "DELETE FROM admin_assets WHERE assetKey = ?",
        args: [data.assetKey],
      });
      return true;
    }
    await database.execute({
      sql: `INSERT INTO admin_assets (assetKey, dataUrl, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(assetKey) DO UPDATE SET dataUrl = excluded.dataUrl, updatedAt = excluded.updatedAt`,
      args: [data.assetKey, data.dataUrl, new Date().toISOString()],
    });
    return true;
  });

export const loadAdminTrashSetting = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
      args: ["lrg:trash"],
    });
    const value = result.rows[0]?.["settingValue"];
    return typeof value === "string" ? value : null;
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
      "SELECT productData FROM products ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC",
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

export const getAdminProductById = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (!data.id.trim() || data.id.length > 500) throw new Error("El producto no es válido.");
    return data;
  })
  .handler(async ({ data }): Promise<Product | null> => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT productData FROM products WHERE id = ?",
      args: [data.id],
    });
    const productData = result.rows[0]?.["productData"];
    if (typeof productData !== "string") return null;
    try {
      return JSON.parse(productData) as Product;
    } catch {
      return null;
    }
  });

export const listAdminProductsWithoutImages = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async (): Promise<Product[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      `SELECT json_remove(productData, '$.image', '$.images') AS productData
       FROM products
       ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC`,
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

export const listAdminProductsPage = createServerFn({ method: "POST" })
  .validator((data: { offset: number; brand?: BrandSlug }) => {
    if (!Number.isInteger(data.offset) || data.offset < 0) {
      throw new Error("El desplazamiento de productos no es válido.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return { products: [] as Product[], nextOffset: data.offset, done: true };

    const result = await database.execute({
      sql: data.brand
        ? `SELECT productData FROM products
           WHERE json_extract(productData, '$.brand') = ?
           ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC
            LIMIT 256 OFFSET ?`
        : `SELECT productData FROM products
           ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC
            LIMIT 256 OFFSET ?`,
      args: data.brand ? [data.brand, data.offset] : [data.offset],
    });

    const products: Product[] = [];
    let responseBytes = 0;
    let consumedRows = 0;
    const maxResponseBytes = 16_000_000;
    const encoder = new TextEncoder();
    for (const row of result.rows) {
      const value = row["productData"];
      if (typeof value !== "string") {
        consumedRows += 1;
        continue;
      }
      try {
        const product = JSON.parse(value) as Product;
        const productBytes = encoder.encode(value).byteLength;
        if (products.length > 0 && responseBytes + productBytes > maxResponseBytes) break;
        products.push(product);
        responseBytes += productBytes;
      } catch {
        // Omitimos filas dañadas sin detener la carga paginada del catálogo.
      }
      consumedRows += 1;
    }

    return {
      products,
      nextOffset: data.offset + consumedRows,
      done: consumedRows >= result.rows.length && result.rows.length < 256,
    };
  });

export const listCatalogProductSummaries = createServerFn({ method: "POST" })
  .validator((data: { brand?: BrandSlug }) => data)
  .handler(async ({ data }): Promise<Product[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];

    const summarySql = `SELECT json_object(
        'id', json_extract(p.productData, '$.id'),
        'slug', json_extract(p.productData, '$.slug'),
        'brand', json_extract(p.productData, '$.brand'),
        'hidden', json_extract(p.productData, '$.hidden'),
        'name', json_extract(p.productData, '$.name'),
        'code', json_extract(p.productData, '$.code'),
        'category', json_extract(p.productData, '$.category'),
        'subcategory', json_extract(p.productData, '$.subcategory'),
        'subcategoryPath', json(json_extract(p.productData, '$.subcategoryPath')),
        'price', json_extract(p.productData, '$.price'),
        'priceCurrency', json_extract(p.productData, '$.priceCurrency'),
        'cardCommission', json_extract(p.productData, '$.cardCommission'),
        'compareAtPrice', json_extract(p.productData, '$.compareAtPrice'),
        'discount', json_extract(p.productData, '$.discount'),
        'stock', json_extract(p.productData, '$.stock'),
        'stockUnlimited', json_extract(p.productData, '$.stockUnlimited'),
        'supplier', json(json_extract(p.productData, '$.supplier')),
        'gastos', json_extract(p.productData, '$.gastos'),
        'gastosCurrency', json_extract(p.productData, '$.gastosCurrency'),
        'usdRate', json_extract(p.productData, '$.usdRate'),
        'rating', json_extract(p.productData, '$.rating'),
        'reviews', json_extract(p.productData, '$.reviews'),
        'badge', json_extract(p.productData, '$.badge'),
        'short', json_extract(p.productData, '$.short'),
        'description', json_extract(p.productData, '$.description'),
        'features', json(json_extract(p.productData, '$.features')),
        'includes', json(json_extract(p.productData, '$.includes')),
        'deliveryUnit', json_extract(p.productData, '$.deliveryUnit'),
        'deliveryAmount', json_extract(p.productData, '$.deliveryAmount'),
        'createdAt', json_extract(p.productData, '$.createdAt'),
        'variants', COALESCE((
          SELECT json_group_array(json_object(
            'id', json_extract(v.value, '$.id'),
            'name', json_extract(v.value, '$.name'),
            'code', json_extract(v.value, '$.code'),
            'hidden', json_extract(v.value, '$.hidden'),
            'price', json_extract(v.value, '$.price'),
            'priceCurrency', json_extract(v.value, '$.priceCurrency'),
            'gastos', json_extract(v.value, '$.gastos'),
            'gastosCurrency', json_extract(v.value, '$.gastosCurrency'),
            'cardCommission', json_extract(v.value, '$.cardCommission'),
            'description', json_extract(v.value, '$.description'),
            'features', json(json_extract(v.value, '$.features')),
            'includes', json(json_extract(v.value, '$.includes')),
            'stock', json_extract(v.value, '$.stock'),
            'stockUnlimited', json_extract(v.value, '$.stockUnlimited'),
            'discount', json_extract(v.value, '$.discount'),
            'deliveryUnit', json_extract(v.value, '$.deliveryUnit'),
            'deliveryAmount', json_extract(v.value, '$.deliveryAmount')
          ))
          FROM json_each(p.productData, '$.variants') AS v
        ), json('[]'))
      ) AS summary
      FROM products AS p
      ${data.brand ? "WHERE json_extract(p.productData, '$.brand') = ?" : ""}
      ORDER BY COALESCE(json_extract(p.productData, '$.createdAt'), p.updatedAt) DESC, p.rowid DESC`;
    const result = await database.execute({
      sql: summarySql,
      args: data.brand ? [data.brand] : [],
    });

    return result.rows.flatMap((row) => {
      const summary = row["summary"];
      if (typeof summary !== "string") return [];
      try {
        return [JSON.parse(summary) as Product];
      } catch {
        return [];
      }
    });
  });

export const getCatalogProductBySlug = createServerFn({ method: "POST" })
  .validator((data: { brand: BrandSlug; slug: string }) => data)
  .handler(async ({ data }): Promise<Product | null> => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const identityLookup = getPublicSlugIdentityLookup(data.slug);
    const result = await database.execute({
      sql: `SELECT id FROM products
            WHERE json_extract(productData, '$.brand') = ?
              AND (
                json_extract(productData, '$.slug') = ?
                ${identityLookup.condition}
              )
            LIMIT 1`,
      args: [data.brand, data.slug, ...identityLookup.args],
    });
    const productId = result.rows[0]?.["id"];
    if (typeof productId !== "string") return null;
    const productResult = await database.execute({
      sql: "SELECT json_remove(productData, '$.image', '$.images') AS productData FROM products WHERE id = ?",
      args: [productId],
    });
    const productData = productResult.rows[0]?.["productData"];
    if (typeof productData !== "string") return null;
    try {
      return JSON.parse(productData) as Product;
    } catch {
      return null;
    }
  });

export const getCatalogProductImages = createServerFn({ method: "POST" })
  .validator((data: { brand: BrandSlug; slug: string }) => data)
  .handler(async ({ data }): Promise<string[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const identityLookup = getPublicSlugIdentityLookup(data.slug);
    const result = await database.execute({
      sql: `SELECT CASE
              WHEN json_array_length(productData, '$.images') > 0
                THEN json_extract(productData, '$.images')
              ELSE json_array(json_extract(productData, '$.image'))
            END AS images
            FROM products WHERE id = (
              SELECT id FROM products
              WHERE json_extract(productData, '$.brand') = ?
                AND (
                  json_extract(productData, '$.slug') = ?
                  ${identityLookup.condition}
                )
              LIMIT 1
            )
            LIMIT 1`,
      args: [data.brand, data.slug, ...identityLookup.args],
    });
    const value = result.rows[0]?.["images"];
    if (typeof value !== "string") return [];
    try {
      const images = JSON.parse(value) as unknown;
      return Array.isArray(images)
        ? images.filter((image): image is string => typeof image === "string" && Boolean(image))
        : [];
    } catch {
      return [];
    }
  });

export const getRelatedCatalogProducts = createServerFn({ method: "POST" })
  .validator((data: { brand: BrandSlug; slug: string }) => data)
  .handler(async ({ data }): Promise<Product[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const identityLookup = getPublicSlugIdentityLookup(data.slug);
    const targetResult = await database.execute({
      sql: `SELECT id, json_extract(productData, '$.category') AS category FROM products
            WHERE json_extract(productData, '$.brand') = ?
              AND (
                json_extract(productData, '$.slug') = ?
                ${identityLookup.condition}
              )
            LIMIT 1`,
      args: [data.brand, data.slug, ...identityLookup.args],
    });
    const target = targetResult.rows[0];
    const productId = target?.["id"];
    const category = target?.["category"];
    if (typeof productId !== "string" || typeof category !== "string") return [];

    const relatedResult = await database.execute({
      sql: `SELECT json_remove(productData, '$.image', '$.images') AS productData
            FROM products
            WHERE json_extract(productData, '$.brand') = ?
              AND id <> ?
              AND json_extract(productData, '$.category') = ?
              AND COALESCE(json_extract(productData, '$.hidden'), 0) = 0
            ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC
            LIMIT 12`,
      args: [data.brand, productId, category],
    });
    return relatedResult.rows.flatMap((row) => {
      const value = row["productData"];
      if (typeof value !== "string") return [];
      try {
        return [JSON.parse(value) as Product];
      } catch {
        return [];
      }
    });
  });

export const getCatalogProductCardImages = createServerFn({ method: "POST" })
  .validator((data: { productIds: string[] }) => {
    if (!Array.isArray(data.productIds) || data.productIds.length > 40) {
      throw new Error("La cantidad de imágenes solicitadas no es válida.");
    }
    if (data.productIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 500)) {
      throw new Error("Hay un producto con identificador de imagen no válido.");
    }
    return { productIds: Array.from(new Set(data.productIds)) };
  })
  .handler(async ({ data }): Promise<Array<{ id: string; image: string }>> => {
    if (!data.productIds.length) return [];
    const database = await ensureAdminTables();
    if (!database) return [];
    const placeholders = data.productIds.map(() => "?").join(", ");
    const result = await database.execute({
      sql: `SELECT id, COALESCE(
              json_extract(productData, '$.imageThumbnail'),
              json_extract(productData, '$.imagesThumbnails[0]'),
              json_extract(productData, '$.image'),
              json_extract(productData, '$.images[0]')
            ) AS image
            FROM products
            WHERE id IN (${placeholders})`,
      args: data.productIds,
    });
    return result.rows.flatMap((row) => {
      const id = row["id"];
      const image = row["image"];
      return typeof id === "string" && typeof image === "string" && image
        ? [{ id, image }]
        : [];
    });
  });

export const getAdminProductThumbnailMigrationPage = createServerFn({ method: "POST" })
  .validator((data: { offset: number; limit?: number }) => {
    const limit = data.limit ?? 3;
    if (!Number.isInteger(data.offset) || data.offset < 0) {
      throw new Error("El desplazamiento de productos no es válido.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 6) {
      throw new Error("La cantidad de productos para optimizar no es válida.");
    }
    return { offset: data.offset, limit };
  })
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return { products: [], nextOffset: data.offset, done: true, total: 0 };
    const [pageResult, countResult] = await Promise.all([
      database.execute({
        sql: `SELECT id,
                json_extract(productData, '$.image') AS image,
                json_extract(productData, '$.images') AS images,
                json_extract(productData, '$.imageThumbnail') AS imageThumbnail,
                json_extract(productData, '$.imagesThumbnails') AS imagesThumbnails
              FROM products ORDER BY rowid LIMIT ? OFFSET ?`,
        args: [data.limit, data.offset],
      }),
      database.execute("SELECT COUNT(*) AS total FROM products"),
    ]);

    const products = pageResult.rows.flatMap((row) => {
      const id = row["id"];
      if (typeof id !== "string") return [];
      let images: string[] = [];
      if (typeof row["images"] === "string") {
        try {
          const parsed = JSON.parse(row["images"]) as unknown;
          if (Array.isArray(parsed)) {
            images = parsed.filter((image): image is string => typeof image === "string");
          }
        } catch {
          images = [];
        }
      }
      if (!images.length && typeof row["image"] === "string") images = [row["image"]];
      if (!images.length) return [];

      let thumbnails: Array<string | null> = [];
      if (typeof row["imagesThumbnails"] === "string") {
        try {
          const parsed = JSON.parse(row["imagesThumbnails"]) as unknown;
          if (Array.isArray(parsed)) {
            thumbnails = parsed.map((thumbnail) =>
              typeof thumbnail === "string" ? thumbnail : null,
            );
          }
        } catch {
          thumbnails = [];
        }
      }
      const imageThumbnail =
        typeof row["imageThumbnail"] === "string" ? row["imageThumbnail"] : null;
      const missingThumbnail = images.some(
        (image, index) =>
          image.startsWith("data:image/") &&
          !(index === 0 ? imageThumbnail : thumbnails[index]),
      );
      return missingThumbnail ? [{ id, images, imageThumbnail, imagesThumbnails: thumbnails }] : [];
    });

    const total = Number(countResult.rows[0]?.["total"] ?? 0);
    const nextOffset = data.offset + pageResult.rows.length;
    return { products, nextOffset, done: nextOffset >= total, total };
  });

export const saveAdminProductThumbnails = createServerFn({ method: "POST" })
  .validator(
    (data: {
      products: Array<{
        id: string;
        imageThumbnail?: string | null;
        imagesThumbnails: Array<string | null>;
      }>;
    }) => {
      if (!Array.isArray(data.products) || data.products.length > 6) {
        throw new Error("La cantidad de miniaturas para guardar no es válida.");
      }
      for (const product of data.products) {
        if (
          !product.id.trim() ||
          product.id.length > 500 ||
          product.imagesThumbnails.length > 20 ||
          [...product.imagesThumbnails, product.imageThumbnail ?? null].some(
            (thumbnail) =>
              thumbnail !== null &&
              (typeof thumbnail !== "string" || thumbnail.length > 500_000),
          )
        ) {
          throw new Error("Hay miniaturas que superan el tamaño permitido.");
        }
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.batch(
      data.products.map((product) => ({
        sql: product.imageThumbnail
          ? `UPDATE products SET productData = json_set(
                productData,
                '$.imageThumbnail', ?,
                '$.imagesThumbnails', json(?)
              ) WHERE id = ?`
          : `UPDATE products SET productData = json_set(
                productData,
                '$.imagesThumbnails', json(?)
              ) WHERE id = ?`,
        args: product.imageThumbnail
          ? [product.imageThumbnail, JSON.stringify(product.imagesThumbnails), product.id]
          : [JSON.stringify(product.imagesThumbnails), product.id],
      })),
      "write",
    );
    return true;
  });

export const listAdminProductsByBrand = createServerFn({ method: "POST" })
  .validator((data: { brand: BrandSlug }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return [];

    try {
      const result = await database.execute({
        sql: "SELECT productData FROM products WHERE json_extract(productData, '$.brand') = ? ORDER BY COALESCE(json_extract(productData, '$.createdAt'), updatedAt) DESC, rowid DESC",
        args: [data.brand],
      });
      return result.rows.flatMap((row) => {
        const value = row["productData"];
        if (typeof value !== "string") return [];
        try {
          return [JSON.parse(value) as Product];
        } catch {
          return [];
        }
      });
    } catch {
      const productsData = await listAdminProducts({ data: {} });
      return productsData.filter((product) => product.brand === data.brand);
    }
  });

export const getAdminProductRevision = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return "unavailable";
    const result = await database.execute(
      "SELECT COUNT(*) AS productCount, COALESCE(MAX(updatedAt), '') AS latestUpdatedAt FROM products",
    );
    const row = result.rows[0];
    return [
      String(row?.["productCount"] ?? 0),
      String(row?.["latestUpdatedAt"] ?? ""),
    ].join(":");
  });

function restoreOmittedProductImages(
  product: Product,
  stored: {
    image?: unknown;
    images?: unknown;
    imageThumbnail?: unknown;
    imagesThumbnails?: unknown;
  },
): Product {
  const restored: Product = { ...product };
  const stringArray = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : undefined;
    } catch {
      return undefined;
    }
  };
  const nullableStringArray = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((item) => (typeof item === "string" ? item : null))
        : undefined;
    } catch {
      return undefined;
    }
  };

  if (!Object.hasOwn(product, "image") && typeof stored.image === "string") {
    restored.image = stored.image;
  }
  if (!Object.hasOwn(product, "images")) {
    const images = stringArray(stored.images);
    if (images) restored.images = images;
  }
  if (!Object.hasOwn(product, "imageThumbnail") && typeof stored.imageThumbnail === "string") {
    restored.imageThumbnail = stored.imageThumbnail;
  }
  if (!Object.hasOwn(product, "imagesThumbnails")) {
    const thumbnails = nullableStringArray(stored.imagesThumbnails);
    if (thumbnails) restored.imagesThumbnails = thumbnails;
  }
  return restored;
}

export const saveAdminProducts = createServerFn({ method: "POST" })
  .validator((data: { products: Product[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    const currentImagesResult = await database.execute(
      `SELECT id,
        json_extract(productData, '$.image') AS image,
        json_extract(productData, '$.images') AS images,
        json_extract(productData, '$.imageThumbnail') AS imageThumbnail,
        json_extract(productData, '$.imagesThumbnails') AS imagesThumbnails
       FROM products`,
    );
    const imagesByProductId = new Map(
      currentImagesResult.rows.flatMap((row) =>
        typeof row["id"] === "string"
          ? [
              [
                row["id"] as string,
                {
                  image: row["image"],
                  images: row["images"],
                  imageThumbnail: row["imageThumbnail"],
                  imagesThumbnails: row["imagesThumbnails"],
                },
              ] as const,
            ]
          : [],
      ),
    );
    const productsWithImages = data.products.map((product) => {
      const current = imagesByProductId.get(product.id);
      return current ? restoreOmittedProductImages(product, current) : product;
    });
    await database.batch(
      [
        { sql: "DELETE FROM products", args: [] },
        ...productsWithImages.map((product) => ({
          sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
          args: [product.id, JSON.stringify(product), now],
        })),
      ],
      "write",
    );
    return true;
  });

export const saveAdminProduct = createServerFn({ method: "POST" })
  .validator((data: { product: Product }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const currentResult = await database.execute({
      sql: `SELECT
        json_extract(productData, '$.image') AS image,
        json_extract(productData, '$.images') AS images,
        json_extract(productData, '$.imageThumbnail') AS imageThumbnail,
        json_extract(productData, '$.imagesThumbnails') AS imagesThumbnails
        FROM products WHERE id = ?`,
      args: [data.product.id],
    });
    const current = currentResult.rows[0];
    const product = current
      ? restoreOmittedProductImages(data.product, current)
      : data.product;
    await database.execute({
      sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
      args: [product.id, JSON.stringify(product), new Date().toISOString()],
    });
    return true;
  });

export const saveAdminProductBatch = createServerFn({ method: "POST" })
  .validator((data: { products: Product[] }) => data)
  .handler(async ({ data }) => {
    if (data.products.length === 0) return true;
    if (data.products.length > 5000) {
      throw new Error("No se pueden guardar más de 5000 productos en una sola importación.");
    }

    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    const productIds = Array.from(new Set(data.products.map((product) => product.id)));
    const placeholders = productIds.map(() => "?").join(", ");
    const currentImagesResult = productIds.length
      ? await database.execute({
            sql: `SELECT id,
              json_extract(productData, '$.image') AS image,
              json_extract(productData, '$.images') AS images,
              json_extract(productData, '$.imageThumbnail') AS imageThumbnail,
              json_extract(productData, '$.imagesThumbnails') AS imagesThumbnails
                FROM products WHERE id IN (${placeholders})`,
          args: productIds,
        })
      : { rows: [] };
    const imagesByProductId = new Map(
      currentImagesResult.rows.flatMap((row) =>
        typeof row["id"] === "string"
          ? [[row["id"] as string, {
              image: row["image"],
              images: row["images"],
              imageThumbnail: row["imageThumbnail"],
              imagesThumbnails: row["imagesThumbnails"],
            }] as const]
          : [],
      ),
    );
    await database.batch(
      data.products.map((candidate) => {
        const current = imagesByProductId.get(candidate.id);
        const product = current
          ? restoreOmittedProductImages(candidate, current)
          : candidate;
        return {
        sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
        args: [product.id, JSON.stringify(product), now],
        };
      }),
      "write",
    );
    return true;
  });

type PlayStationStoreProduct = {
  id: string;
  name: string;
  platforms: string[];
  basePrice?: string;
  discountedPrice?: string;
  discountText?: string;
  image?: string;
};

function parseStorePrice(value: string | undefined): number | null {
  if (!value) return null;
  const number = value.replace(/[^\d.,-]/g, "");
  if (!number) return null;

  const lastDot = number.lastIndexOf(".");
  const lastComma = number.lastIndexOf(",");
  let normalized = number;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandSeparator = decimalSeparator === "." ? "," : ".";
    normalized = number.split(thousandSeparator).join("").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const decimals = number.length - lastComma - 1;
    normalized =
      decimals > 0 && decimals <= 2 ? number.replace(",", ".") : number.replace(/,/g, "");
  } else if (lastDot >= 0 && number.length - lastDot - 1 === 3) {
    normalized = number.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export const importPerfumeNotesWithAI = createServerFn({ method: "POST" })
  .validator((data: { productName: string }) => data)
  .handler(async ({ data }) => {
    if (typeof data.productName !== "string") {
      throw new Error("Ingresá un nombre de producto válido para buscar.");
    }
    const productName = data.productName.trim();
    if (!productName || productName.length > 160) {
      throw new Error("Ingresá un nombre de producto válido para buscar.");
    }

      const geminiApiKey = typeof process !== "undefined" ? process.env["GEMINI_API_KEY"]?.trim() : "";
    const ollamaBaseUrl = typeof process !== "undefined"
      ? (process.env["OLLAMA_BASE_URL"]?.trim() || "http://localhost:11434")
      : "http://localhost:11434";
    const ollamaModel = typeof process !== "undefined"
      ? (process.env["OLLAMA_MODEL"]?.trim() || "llama3.1")
      : "llama3.1";

    if (!geminiApiKey) {
      try {
        const ollamaTagsUrl = `${ollamaBaseUrl.replace(/\/$/, "")}/api/tags`;
        const ollamaTagsResponse = await fetch(ollamaTagsUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        });

        if (ollamaTagsResponse.ok) {
          const tagsPayload: unknown = await ollamaTagsResponse.json();
          const installedModels =
            typeof tagsPayload === "object" && tagsPayload !== null && "models" in tagsPayload && Array.isArray((tagsPayload as { models?: unknown[] }).models)
              ? (tagsPayload as { models: Array<{ name?: string }> }).models
                  .map((model) => model.name)
                  .filter((name): name is string => typeof name === "string")
              : [];

          if (installedModels.length > 0 && !installedModels.some((name) => name === ollamaModel || name.startsWith(`${ollamaModel}:`))) {
            throw new Error(
              `El modelo local "${ollamaModel}" no está instalado. Ejecutá "ollama pull ${ollamaModel}" en tu PC y volvé a intentar.`,
            );
          }
        }

        const ollamaUrl = `${ollamaBaseUrl.replace(/\/$/, "")}/api/generate`;
        const ollamaResponse = await fetch(ollamaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `Respondé solo JSON válido con las propiedades matched (boolean), title (string), reason (string), notes (objeto con top, heart y base como listas de strings), y opcionalmente sources (lista de { title, url }). No uses Fragrantica como fuente. Busca información verificable sobre el perfume: ${productName}`,
            stream: false,
            options: {
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!ollamaResponse.ok) {
          let message = "";
          try {
            const errorPayload: unknown = await ollamaResponse.json();
            if (
              typeof errorPayload === "object" &&
              errorPayload !== null &&
              "error" in errorPayload &&
              typeof (errorPayload as { error?: unknown }).error === "string"
            ) {
              message = (errorPayload as { error: string }).error;
            }
          } catch {
            // Ignore malformed JSON from Ollama errors.
          }

          if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("model")) {
            throw new Error(
              `El modelo local "${ollamaModel}" no está instalado. Ejecutá "ollama pull ${ollamaModel}" y probá de nuevo.`,
            );
          }

          throw new Error(
            `Ollama no está corriendo en tu PC o no está configurado. Iniciá "ollama serve" y asegurate de tener el modelo descargado antes de volver a buscar.`,
          );
        }

        const ollamaPayload: unknown = await ollamaResponse.json();
        const text =
          typeof ollamaPayload === "object" && ollamaPayload !== null && "response" in ollamaPayload &&
          typeof (ollamaPayload as { response?: unknown }).response === "string"
            ? (ollamaPayload as { response: string }).response
            : "";
        if (text) {
          return parsePerfumeNotesResponse({ response: text, model: ollamaModel });
        }

        throw new Error(
          "Ollama devolvió una respuesta vacía. Revisá que el modelo local esté instalado y funcionando.",
        );
      } catch (error) {
        if (error instanceof Error) {
          const lowerMessage = error.message.toLowerCase();
          if (
            lowerMessage.includes("fetch failed") ||
            lowerMessage.includes("network") ||
            lowerMessage.includes("failed to fetch") ||
            lowerMessage.includes("connect") ||
            lowerMessage.includes("timed out")
          ) {
            throw new Error(
              `Ollama no está corriendo en tu PC o no está configurado. Iniciá "ollama serve" y ejecutá "ollama pull llama3.1" antes de buscar notas.`,
            );
          }
          throw new Error(error.message);
        }
        throw new Error(
          `Ollama no está corriendo en tu PC o no está configurado. Iniciá "ollama serve" y ejecutá "ollama pull llama3.1" antes de buscar notas.`,
        );
      }
    }

    const model = process.env["GEMINI_PERFUME_MODEL"]?.trim() || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Buscá información web verificable sobre perfumes. No uses Fragrantica como fuente. Priorizá páginas oficiales de la marca y sitios especializados confiables. No inventes notas: si no podés confirmar exactamente el perfume, devolvé matched=false. Respondé únicamente JSON válido con las propiedades matched (boolean), title (string), reason (string) y notes (objeto con top, heart y base como listas de strings). Usá español cuando sea posible.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `Encontrá la pirámide olfativa del perfume: ${productName}` }],
          },
        ],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(45_000),
      },
    );

    const payload: unknown = await response.json();
    if (!response.ok) {
      const errorMessage =
        typeof payload === "object" && payload !== null && "error" in payload &&
        typeof payload.error === "object" && payload.error !== null && "message" in payload.error
          ? String(payload.error.message)
          : `Gemini respondió con el estado ${response.status}.`;
      if (response.status === 401 || response.status === 403) {
        throw new Error("La clave GEMINI_API_KEY no es válida o no tiene acceso a Gemini API.");
      }
      if (response.status === 429) {
        throw new Error("Gemini alcanzó el límite gratuito. Esperá a que se renueve la cuota y probá de nuevo.");
      }
      throw new Error(errorMessage);
    }

    return parsePerfumeNotesResponse(payload);
  });

export const importPlayStationStoreCategory = createServerFn({ method: "POST" })
  .validator((data: {
    url: string;
    pageSelection:
      | { mode: "all" }
      | { mode: "single"; page: number }
      | { mode: "range"; from: number; to: number };
  }) => {
    const { pageSelection } = data;
    const validPage = (page: number) => Number.isInteger(page) && page >= 1 && page <= 1250;
    if (pageSelection.mode === "single" && !validPage(pageSelection.page)) {
      throw new Error("El número de página debe estar entre 1 y 1250.");
    }
    if (
      pageSelection.mode === "range" &&
      (!validPage(pageSelection.from) ||
        !validPage(pageSelection.to) ||
        pageSelection.to < pageSelection.from)
    ) {
      throw new Error("El rango de páginas no es válido.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(data.url);
    } catch {
      throw new Error("Ingresá un link válido de PlayStation Store.");
    }
    if (
      sourceUrl.protocol !== "https:" ||
      sourceUrl.hostname !== "store.playstation.com" ||
      !/^\/[a-z]{2}-[a-z]{2}\/category\/[^/]+(?:\/\d+)?\/?$/i.test(sourceUrl.pathname)
    ) {
      throw new Error("El link debe ser una página de categoría de store.playstation.com.");
    }

    const pathParts = sourceUrl.pathname.split("/").filter(Boolean);
    const locale = pathParts[0] ?? "es-ar";
    const categoryId = pathParts[2];
    if (!categoryId) throw new Error("No pude detectar la categoría del link.");

    const filterBy: string[] = [];
    for (const [key, facet] of sourceUrl.searchParams) {
      if (
        [
          "storeDisplayClassification",
          "targetPlatforms",
          "subscriptionService",
          "gameContentType",
        ].includes(facet)
      ) {
        filterBy.push(`${facet}:${key}`);
      }
    }

    const sortName = sourceUrl.searchParams.get("sortBy");
    const sortOrder = sourceUrl.searchParams.get("sortOrder");
    const sortBy = sortName ? { name: sortName, isAscending: sortOrder !== "desc" } : null;
    const requestedStartPage =
      data.pageSelection.mode === "range"
        ? data.pageSelection.from
        : data.pageSelection.mode === "single"
          ? data.pageSelection.page
          : 1;
    const requestedEndPage =
      data.pageSelection.mode === "range"
        ? data.pageSelection.to
        : data.pageSelection.mode === "single"
          ? data.pageSelection.page
          : undefined;
    const pageSize = data.pageSelection.mode === "all" ? 1000 : 24;
    const startOffset = data.pageSelection.mode === "all" ? 0 : (requestedStartPage - 1) * pageSize;
    const maxProducts = 30_000;
    const products: PlayStationStoreProduct[] = [];
    let totalCount = 0;
    let isLast = false;
    const requestedPageCount =
      requestedEndPage !== undefined ? requestedEndPage - requestedStartPage + 1 : undefined;

    for (
      let offset = startOffset, pageIndex = 0;
      requestedPageCount !== undefined ? pageIndex < requestedPageCount : !isLast;
      offset += pageSize, pageIndex += 1
    ) {
      if (pageIndex >= (requestedPageCount ?? 31) || offset >= maxProducts) {
        throw new Error("La categoría supera el límite seguro de 30 000 productos.");
      }

      const variables = {
        id: categoryId,
        pageArgs: { size: pageSize, offset },
        sortBy,
        filterBy,
        facetOptions: [],
      };
      const extensions = {
        persistedQuery: {
          version: 1,
          sha256Hash: "88c0b9a1273c6d320c51cd73e390924e21ae28bf09f01cde8b84b1034b16cd03",
        },
      };
      const apiUrl = new URL("https://web.np.playstation.com/api/graphql/v1//op");
      apiUrl.searchParams.set("operationName", "categoryGridRetrieve");
      apiUrl.searchParams.set("variables", JSON.stringify(variables));
      apiUrl.searchParams.set("extensions", JSON.stringify(extensions));

      const response = await fetch(apiUrl, {
        headers: {
          accept: "application/json",
          "accept-language": `${locale},${locale.slice(0, 2)};q=0.9`,
          "apollo-require-preflight": "true",
          "x-apollo-operation-name": "categoryGridRetrieve",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`PlayStation Store respondió con el estado ${response.status}.`);
      }

      const payload = (await response.json()) as {
        errors?: Array<{ message?: string }>;
        data?: {
          categoryGridRetrieve?: {
            pageInfo?: { isLast?: boolean; totalCount?: number };
            products?: Array<{
              id?: string;
              name?: string;
              platforms?: string[];
              price?: { basePrice?: string; discountedPrice?: string; discountText?: string };
              media?: Array<{ role?: string; url?: string }>;
            }>;
          };
        };
      };
      if (payload.errors?.length) {
        throw new Error(
          payload.errors[0]?.message ?? "No se pudo consultar la categoría de Store.",
        );
      }

      const grid = payload.data?.categoryGridRetrieve;
      const pageProducts = grid?.products ?? [];
      if (
        !grid ||
        (pageProducts.length === 0 &&
          (offset === 0 || data.pageSelection.mode !== "all"))
      ) {
        throw new Error(
          data.pageSelection.mode !== "all"
            ? `No se encontraron productos en la página ${Math.floor(offset / pageSize) + 1}.`
            : "El link no contiene productos importables o la categoría no existe.",
        );
      }
      totalCount = grid.pageInfo?.totalCount ?? totalCount;
      for (const product of pageProducts) {
        if (!product.id || !product.name) continue;
        products.push({
          id: product.id,
          name: product.name,
          platforms: product.platforms ?? [],
          ...(product.price?.basePrice ? { basePrice: product.price.basePrice } : {}),
          ...(product.price?.discountedPrice
            ? { discountedPrice: product.price.discountedPrice }
            : {}),
          ...(product.price?.discountText ? { discountText: product.price.discountText } : {}),
          ...(product.media?.find((media) => media.role === "MASTER")?.url
            ? { image: product.media.find((media) => media.role === "MASTER")?.url }
            : {}),
        });
      }
      isLast = grid.pageInfo?.isLast ?? pageProducts.length < pageSize;
      if (totalCount > maxProducts) {
        throw new Error("La categoría supera el límite seguro de 30 000 productos.");
      }
      if (data.pageSelection.mode === "single") break;
    }

    const resolvedTotalCount = totalCount || products.length;
    return {
      totalCount: resolvedTotalCount,
      totalPages: Math.max(1, Math.ceil(resolvedTotalCount / 24)),
      products: products.map((product) => {
        const regularPrice = parseStorePrice(product.basePrice);
        const offerPrice = parseStorePrice(product.discountedPrice);
        const validPrices = [regularPrice, offerPrice].filter(
          (price): price is number => price !== null,
        );
        return {
          ...product,
          lowestPrice: validPrices.length ? Math.min(...validPrices) : 0,
        };
      }),
    };
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

export const listAdminOrdersWithoutDocuments = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async (): Promise<Order[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      `SELECT json_remove(orderData, '$.attachments', '$.paymentReceipts') AS orderData
       FROM orders ORDER BY updatedAt DESC`,
    );
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

export const getAdminOrderById = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (!data.id.trim() || data.id.length > 500) throw new Error("El pedido no es válido.");
    return data;
  })
  .handler(async ({ data }): Promise<Order | null> => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT orderData FROM orders WHERE id = ?",
      args: [data.id],
    });
    const value = result.rows[0]?.["orderData"];
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value) as Order;
    } catch {
      return null;
    }
  });

export const listAdminOrderSummaries = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute({
      sql: `SELECT json_object(
              'id', json_extract(orderData, '$.id'),
              'customer', json_extract(orderData, '$.customer'),
              'email', json_extract(orderData, '$.email'),
              'phone', json_extract(orderData, '$.phone'),
              'date', json_extract(orderData, '$.date'),
              'total', json_extract(orderData, '$.total'),
              'brand', json_extract(orderData, '$.brand'),
              'status', json_extract(orderData, '$.status'),
              'expenses', json_extract(orderData, '$.expenses'),
              'profit', json_extract(orderData, '$.profit'),
              'items', COALESCE((
                SELECT json_group_array(json_object('brand', json_extract(item.value, '$.brand')))
                FROM json_each(orders.orderData, '$.items') AS item
              ), json('[]'))
            ) AS orderSummary
            FROM orders ORDER BY updatedAt DESC`,
    });
    return result.rows.flatMap((row) => {
      const summary = row["orderSummary"];
      if (typeof summary !== "string") return [];
      try {
        return [JSON.parse(summary) as {
          id: string;
          customer: string;
          email: string;
          phone: string;
          date: string;
          total: number;
          brand: BrandSlug;
          status: Order["status"];
          expenses: number;
          profit: number;
          items: Array<{ brand?: BrandSlug }>;
        }];
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
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET orderData = json_patch(orders.orderData, excluded.orderData), updatedAt = excluded.updatedAt`,
      args: [data.order.id, JSON.stringify(data.order), now],
    });

    try {
      await createDatabaseBackup(`order-purchase:${data.order.id}`);
    } catch (error) {
      console.error("No se pudo crear el backup automático del pedido:", error);
    }
    return true;
  });

export const createAdminBackup = createServerFn({ method: "POST" })
  .validator((data: { reason?: string }) => data)
  .handler(async ({ data }) => {
    try {
      return await createDatabaseBackup(data.reason ?? "manual");
    } catch (error) {
      console.error("No se pudo crear la copia de seguridad:", error);
      return false;
    }
  });

export type AdminBackupSummary = {
  id: string;
  reason: string;
  createdAt: string;
  sizeBytes: number;
};

type AdminBackupTrashItem = AdminBackupSummary & { snapshotData?: string };

export const listAdminBackups = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async (): Promise<AdminBackupSummary[]> => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      "SELECT id, reason, length(snapshotData) AS sizeBytes, createdAt FROM database_backups ORDER BY createdAt DESC",
    );
    return result.rows.flatMap((row) => {
      const id = row["id"];
      const reason = row["reason"];
      const sizeBytes = row["sizeBytes"];
      const createdAt = row["createdAt"];
      if (
        typeof id !== "string" ||
        typeof reason !== "string" ||
        typeof sizeBytes !== "number" ||
        typeof createdAt !== "string"
      ) {
        return [];
      }
      return [{ id, reason, createdAt, sizeBytes }];
    });
  });

export const loadAdminBackup = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminBackupTrashItem | null> => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT id, reason, snapshotData, createdAt FROM database_backups WHERE id = ?",
      args: [data.id],
    });
    const row = result.rows[0];
    const id = row?.["id"];
    const reason = row?.["reason"];
    const snapshotData = row?.["snapshotData"];
    const createdAt = row?.["createdAt"];
    if (
      typeof id !== "string" ||
      typeof reason !== "string" ||
      typeof snapshotData !== "string" ||
      typeof createdAt !== "string"
    ) {
      return null;
    }
    return {
      id,
      reason,
      createdAt,
      snapshotData,
      sizeBytes: new TextEncoder().encode(snapshotData).length,
    };
  });

export const deleteAdminBackup = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const metadata = await database.execute({
      sql: "SELECT id, reason, createdAt, length(snapshotData) AS sizeBytes FROM database_backups WHERE id = ?",
      args: [data.id],
    });
    if (metadata.rows.length === 0) return false;
    const deletedAt = new Date();
    const deletedAtValue = deletedAt.toISOString();
    const expiresAtValue = new Date(deletedAt.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const moved = await database.execute({
      sql: `INSERT INTO database_backup_trash (id, reason, snapshotData, createdAt, deletedAt, expiresAt)
            SELECT id, reason, snapshotData, createdAt, ?, ?
            FROM database_backups WHERE id = ?`,
      args: [deletedAtValue, expiresAtValue, data.id],
    });
    if (moved.rowsAffected === 0) return false;
    await database.execute({ sql: "DELETE FROM database_backups WHERE id = ?", args: [data.id] });

    return true;
  });

export const listAdminBackupTrash = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const database = await ensureAdminTables();
    if (!database) return [];
    const result = await database.execute(
      "SELECT id, reason, createdAt, sizeBytes, deletedAt, expiresAt FROM (SELECT id, reason, createdAt, length(snapshotData) AS sizeBytes, deletedAt, expiresAt FROM database_backup_trash) WHERE expiresAt > ? ORDER BY deletedAt DESC",
      [new Date().toISOString()],
    );
    return result.rows.flatMap((row) => {
      const id = row["id"];
      const reason = row["reason"];
      const createdAt = row["createdAt"];
      const sizeBytes = row["sizeBytes"];
      const deletedAt = row["deletedAt"];
      const expiresAt = row["expiresAt"];
      return typeof id === "string" &&
        typeof reason === "string" &&
        typeof createdAt === "string" &&
        typeof sizeBytes === "number" &&
        typeof deletedAt === "string" &&
        typeof expiresAt === "string"
        ? [
            {
              type: "backup" as const,
              id,
              item: { id, reason, createdAt, sizeBytes },
              deletedAt,
              expiresAt,
            },
          ]
        : [];
    });
  });

export const restoreAdminBackup = createServerFn({ method: "POST" })
  .validator((data: { backup: AdminBackupTrashItem }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    if (!data.backup.snapshotData) {
      const restored = await database.execute({
        sql: `INSERT INTO database_backups (id, reason, snapshotData, createdAt)
              SELECT id, reason, snapshotData, createdAt FROM database_backup_trash WHERE id = ?`,
        args: [data.backup.id],
      });
      if (restored.rowsAffected === 0) return false;
      await database.execute({
        sql: "DELETE FROM database_backup_trash WHERE id = ?",
        args: [data.backup.id],
      });
      return true;
    }
    await database.execute({
      sql: `INSERT INTO database_backups (id, reason, snapshotData, createdAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`,
      args: [data.backup.id, data.backup.reason, data.backup.snapshotData, data.backup.createdAt],
    });
    return true;
  });

export const deleteAdminBackupTrash = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({
      sql: "DELETE FROM database_backup_trash WHERE id = ?",
      args: [data.id],
    });
    return true;
  });

export const saveAdminOrders = createServerFn({ method: "POST" })
  .validator((data: { orders: Order[] }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    const existingResult = await database.execute("SELECT id FROM orders");
    const incomingIds = new Set(data.orders.map((order) => order.id));
    const staleIds = existingResult.rows.flatMap((row) =>
      typeof row["id"] === "string" && !incomingIds.has(row["id"])
        ? [row["id"] as string]
        : [],
    );
    await database.batch(
      [
        ...staleIds.map((id) => ({ sql: "DELETE FROM orders WHERE id = ?", args: [id] })),
        ...data.orders.map((order) => ({
          sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET orderData = json_patch(orders.orderData, excluded.orderData), updatedAt = excluded.updatedAt`,
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

export const loadPlayStationProductImageDataUrl = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    let imageUrl: URL;
    try {
      imageUrl = new URL(data.url);
    } catch {
      throw new Error("El link de imagen no es válido.");
    }
    const isPlayStationHost =
      imageUrl.protocol === "https:" &&
      (imageUrl.hostname === "playstation.com" ||
        imageUrl.hostname.endsWith(".playstation.com") ||
        imageUrl.hostname === "playstation.net" ||
        imageUrl.hostname.endsWith(".playstation.net"));
    if (!isPlayStationHost) throw new Error("Solo se pueden cargar imágenes de PlayStation Store.");
    return { url: imageUrl.toString() };
  })
  .handler(async ({ data }) => {
    const response = await fetch(data.url, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("PlayStation Store no pudo devolver la imagen.");
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!contentType.startsWith("image/")) throw new Error("El recurso remoto no es una imagen.");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 5_000_000) throw new Error("La imagen remota supera el tamaño permitido.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 5_000_000) throw new Error("La imagen remota supera el tamaño permitido.");
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  });

export const createPaymentIntent = createServerFn({ method: "POST" })
  .validator((data: { id: string; data: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO payment_intents (id, intentData, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?)`,
      args: [data.id, data.data, "pending", now, now],
    });
    return true;
  });

export const loadPaymentIntent = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return null;
    const result = await database.execute({
      sql: "SELECT intentData, status, orderId FROM payment_intents WHERE id = ?",
      args: [data.id],
    });
    const row = result.rows[0];
    return typeof row?.["intentData"] === "string" && typeof row["status"] === "string"
      ? {
          data: row["intentData"],
          status: row["status"],
          orderId: typeof row["orderId"] === "string" ? row["orderId"] : null,
        }
      : null;
  });

export const completePaymentIntent = createServerFn({ method: "POST" })
  .validator((data: { id: string; orderId: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({
      sql: "UPDATE payment_intents SET status = ?, orderId = ?, updatedAt = ? WHERE id = ?",
      args: ["approved", data.orderId, new Date().toISOString(), data.id],
    });
    return true;
  });

export const cancelPaymentReservation = createServerFn({ method: "POST" })
  .validator((data: { intentId: string }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const intentResult = await database.execute({
      sql: "SELECT intentData, status FROM payment_intents WHERE id = ?",
      args: [data.intentId],
    });
    const row = intentResult.rows[0];
    if (row?.["status"] === "approved" || typeof row?.["intentData"] !== "string") return false;

    let intentData: { reservationOwnerId?: string; items?: Order["items"] };
    try {
      intentData = JSON.parse(row["intentData"]);
    } catch {
      return false;
    }
    const ownerId = intentData.reservationOwnerId;
    if (!ownerId) return false;

    const inventoryKeys = Array.from(
      new Set(
        (intentData.items ?? [])
          .filter((item) => Boolean(item.productId))
          .map((item) => getInventoryKey(item.productId!, item.variantId)),
      ),
    );
    const statements = inventoryKeys.flatMap((inventoryKey) => [
      {
        sql: "DELETE FROM stock_reservations WHERE inventoryKey = ? AND ownerId = ?",
        args: [inventoryKey, ownerId],
      },
      {
        sql: "DELETE FROM stock_reservation_queue WHERE inventoryKey = ? AND ownerId = ?",
        args: [inventoryKey, ownerId],
      },
    ]);
    statements.push({
      sql: "UPDATE payment_intents SET status = ?, updatedAt = ? WHERE id = ? AND status != ?",
      args: ["cancelled", new Date().toISOString(), data.intentId, "approved"],
    });
    await database.batch(statements, "write");
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

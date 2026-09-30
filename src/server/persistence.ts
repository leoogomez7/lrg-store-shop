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

async function createDatabaseBackup(reason: string) {
  const adminDatabase = await ensureAdminTables();
  if (!adminDatabase) return false;

  const adminTables = [
    "admins",
    "admin_settings",
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

export const listAdminProductsByBrand = createServerFn({ method: "POST" })
  .validator((data: { brand: BrandSlug }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return [];

    try {
      const result = await database.execute({
        sql: "SELECT productData FROM products WHERE json_extract(productData, '$.brand') = ? ORDER BY updatedAt DESC",
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

export const saveAdminProduct = createServerFn({ method: "POST" })
  .validator((data: { product: Product }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    await database.execute({
      sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
      args: [data.product.id, JSON.stringify(data.product), new Date().toISOString()],
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
    await database.batch(
      data.products.map((product) => ({
        sql: `INSERT INTO products (id, productData, updatedAt) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET productData = excluded.productData, updatedAt = excluded.updatedAt`,
        args: [product.id, JSON.stringify(product), now],
      })),
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

export const importPlayStationStoreCategory = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
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
    const pageSize = 1000;
    const maxProducts = 30_000;
    const products: PlayStationStoreProduct[] = [];
    let totalCount = 0;
    let isLast = false;

    for (let offset = 0, page = 0; !isLast; offset += pageSize, page += 1) {
      if (page >= 31 || offset >= maxProducts) {
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
      if (!grid || (pageProducts.length === 0 && offset === 0)) {
        throw new Error("El link no contiene productos importables o la categoría no existe.");
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
    }

    return {
      totalCount: totalCount || products.length,
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

export const upsertAdminOrder = createServerFn({ method: "POST" })
  .validator((data: { order: Order }) => data)
  .handler(async ({ data }) => {
    const database = await ensureAdminTables();
    if (!database) return false;
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO orders (id, orderData, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET orderData = excluded.orderData, updatedAt = excluded.updatedAt`,
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

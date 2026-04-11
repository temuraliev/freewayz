import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Brand,
  Category,
  Style,
  Product,
  ProductImage,
  ProductVideo,
  User,
  CartItemEntity,
  UserPreference,
  ProductViewEntity,
  WishlistItemEntity,
  OrderEntity,
  Expense,
  PromoCode,
  PromoUsage,
  Supplier,
} from "./entities";
import { InitialSchema1713400000000 } from "./migrations/1713400000000-InitialSchema";

const entities = [
  Brand,
  Category,
  Style,
  Product,
  ProductImage,
  ProductVideo,
  User,
  CartItemEntity,
  UserPreference,
  ProductViewEntity,
  WishlistItemEntity,
  OrderEntity,
  Expense,
  PromoCode,
  PromoUsage,
  Supplier,
];

const migrations = [InitialSchema1713400000000];

function createDataSource() {
  return new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "freewayz",
    entities,
    migrations,
    synchronize: false,
    migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === "true",
    logging: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    charset: "utf8mb4_unicode_ci",
  });
}

// Singleton pattern for Next.js hot-reload
const globalForDB = globalThis as unknown as {
  dataSource: DataSource | undefined;
};

export async function getDataSource(): Promise<DataSource> {
  if (globalForDB.dataSource?.isInitialized) {
    return globalForDB.dataSource;
  }

  const ds = createDataSource();
  await ds.initialize();

  if (process.env.NODE_ENV !== "production") {
    globalForDB.dataSource = ds;
  }

  return ds;
}

export { DataSource };

/**
 * Run TypeORM migrations manually.
 *
 * Usage:
 *   npx tsx backend/run-migrations.ts
 *   -- or via npm script --
 *   npm run db:migrate
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Brand, Category, Style, Product, ProductImage, ProductVideo,
  User, CartItemEntity, UserPreference, ProductViewEntity,
  WishlistItemEntity, OrderEntity, Expense, PromoCode, PromoUsage, Supplier,
} from "./entities";
import { InitialSchema1713400000000 } from "./migrations/1713400000000-InitialSchema";

async function main() {
  const ds = new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "freewayz",
    entities: [
      Brand, Category, Style, Product, ProductImage, ProductVideo,
      User, CartItemEntity, UserPreference, ProductViewEntity,
      WishlistItemEntity, OrderEntity, Expense, PromoCode, PromoUsage, Supplier,
    ],
    migrations: [InitialSchema1713400000000],
    logging: true,
  });

  await ds.initialize();
  console.log("DataSource initialized. Running migrations...\n");

  const applied = await ds.runMigrations();
  if (applied.length === 0) {
    console.log("No pending migrations.");
  } else {
    console.log(`\nApplied ${applied.length} migration(s):`);
    for (const m of applied) {
      console.log(`  ✓ ${m.name}`);
    }
  }

  await ds.destroy();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

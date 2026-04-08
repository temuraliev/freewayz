#!/usr/bin/env node
/**
 * One-time migration: move legacy JSON cart/preferences to normalized models.
 *
 * Reads:
 *   User.cartItems (string JSON)
 *   User.preferredBrandIds (string[])
 *   User.preferredStyleIds (string[])
 *
 * Writes:
 *   CartItem rows
 *   UserPreference rows
 *
 * Run after `prisma migrate deploy` has created the new tables:
 *   node scripts/maintenance/migrate-cart-and-preferences.mjs
 *
 * Safe to re-run: skips users whose normalized data already exists.
 */
import { loadEnvLocal } from "../lib/env.mjs";
import { getPrisma } from "../lib/prisma.mjs";

loadEnvLocal();
const prisma = getPrisma();

async function migrateCarts() {
  console.log("=== Migrating carts ===");
  const users = await prisma.user.findMany({
    where: { cartItems: { not: null } },
    select: { id: true, cartItems: true },
  });
  console.log(`Found ${users.length} users with legacy cart data`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    // Skip if normalized data already exists
    const existing = await prisma.cartItem.count({ where: { userId: user.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    let items;
    try {
      items = JSON.parse(user.cartItems);
    } catch {
      errors++;
      continue;
    }

    if (!Array.isArray(items) || items.length === 0) {
      skipped++;
      continue;
    }

    const rows = items
      .map((it) => ({
        userId: user.id,
        productId: String(it.productId || it._id || ""),
        title: it.title || null,
        brand: typeof it.brand === "string" ? it.brand : it.brand?.title || null,
        size: String(it.size || "One Size"),
        color: it.color || null,
        price: Number(it.price) || 0,
        quantity: Math.max(1, parseInt(String(it.quantity || 1), 10) || 1),
        imageUrl: Array.isArray(it.images) ? it.images[0] || null : it.imageUrl || null,
      }))
      .filter((r) => r.productId && r.price >= 0);

    if (rows.length === 0) {
      skipped++;
      continue;
    }

    try {
      await prisma.cartItem.createMany({ data: rows, skipDuplicates: true });
      migrated++;
    } catch (e) {
      console.error(`Failed user ${user.id}:`, e.message);
      errors++;
    }
  }

  console.log(`Carts: migrated=${migrated}, skipped=${skipped}, errors=${errors}\n`);
}

async function migratePreferences() {
  console.log("=== Migrating preferences ===");
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { preferredBrandIds: { isEmpty: false } },
        { preferredStyleIds: { isEmpty: false } },
      ],
    },
    select: { id: true, preferredBrandIds: true, preferredStyleIds: true },
  });
  console.log(`Found ${users.length} users with legacy preferences`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await prisma.userPreference.count({ where: { userId: user.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    const rows = [
      ...(user.preferredBrandIds || []).map((id) => ({
        userId: user.id,
        preferenceType: "brand",
        externalId: id,
      })),
      ...(user.preferredStyleIds || []).map((id) => ({
        userId: user.id,
        preferenceType: "style",
        externalId: id,
      })),
    ];

    if (rows.length === 0) {
      skipped++;
      continue;
    }

    await prisma.userPreference.createMany({ data: rows, skipDuplicates: true });
    migrated++;
  }

  console.log(`Preferences: migrated=${migrated}, skipped=${skipped}\n`);
}

async function main() {
  await migrateCarts();
  await migratePreferences();
  console.log("Done. Legacy User.cartItems/preferredBrandIds/preferredStyleIds remain intact.");
  console.log("Remove them in a future migration once the new code is verified.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

#!/usr/bin/env node
/**
 * One-time migration script: Sanity -> PostgreSQL (Prisma)
 *
 * Migrates: users, orders, expenses, promoCodes, yupooSuppliers
 * Run AFTER setting DATABASE_URL in .env.local and running:
 *   npx prisma migrate dev --name init
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-sanity-to-postgres.mjs
 *   node --env-file=.env.local scripts/migrate-sanity-to-postgres.mjs --dry-run
 */

import { createClient } from '@sanity/client';
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

const dryRun = process.argv.includes('--dry-run');

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in .env.local first.');
  process.exit(1);
}

const sanity = createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: false, token });
const prisma = new PrismaClient();

function parseStatus(s) {
  const map = { ROOKIE: 'ROOKIE', PRO: 'PRO', LEGEND: 'LEGEND' };
  return map[s] || 'ROOKIE';
}

function parseOrderStatus(s) {
  const valid = ['new', 'paid', 'ordered', 'shipped', 'delivered', 'cancelled'];
  return valid.includes(s) ? s : 'new';
}

function parseCurrency(c) {
  const valid = ['UZS', 'CNY', 'USD'];
  return valid.includes(c) ? c : 'UZS';
}

function parseExpenseCategory(c) {
  const valid = ['shipping', 'purchase', 'packaging', 'other'];
  return valid.includes(c) ? c : 'other';
}

function parsePromoType(t) {
  const valid = ['discount_percent', 'discount_fixed', 'balance_topup'];
  return valid.includes(t) ? t : 'discount_fixed';
}

async function main() {
  console.log(dryRun ? '[DRY RUN] ' : '' + 'Starting Sanity -> PostgreSQL migration...\n');

  // ── 1. Migrate Users ─────────────────────────────────────────────────────
  console.log('Fetching users from Sanity...');
  const sanityUsers = await sanity.fetch(`
    *[_type == "user"]{
      _id, telegramId, username, firstName, lastName, photoUrl, phone,
      address, adminNotes, totalSpent, status, cashbackBalance, onboardingDone,
      referredBy, cartItems, cartUpdatedAt, abandonedCartNotified,
      "preferredBrandIds": preferredBrands[]->_id,
      "preferredStyleIds": preferredStyles[]->_id,
      _createdAt, _updatedAt
    }
  `);
  console.log(`  Found ${sanityUsers.length} users`);

  const userSanityIdToDbId = new Map(); // sanity _id -> postgres id

  for (const u of sanityUsers) {
    if (!u.telegramId) {
      console.warn(`  Skipping user without telegramId: ${u._id}`);
      continue;
    }
    if (dryRun) {
      console.log(`  [DRY] Would upsert user: ${u.telegramId} (${u.username || ''})`);
      userSanityIdToDbId.set(u._id, u.telegramId);
      continue;
    }
    try {
      const created = await prisma.user.upsert({
        where: { telegramId: String(u.telegramId) },
        update: {
          username: u.username || null,
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          photoUrl: u.photoUrl || null,
          phone: u.phone || null,
          address: u.address || null,
          adminNotes: u.adminNotes || null,
          totalSpent: Number(u.totalSpent) || 0,
          status: parseStatus(u.status),
          cashbackBalance: Number(u.cashbackBalance) || 0,
          onboardingDone: !!u.onboardingDone,
          referredBy: u.referredBy || null,
          preferredBrandIds: Array.isArray(u.preferredBrandIds) ? u.preferredBrandIds.filter(Boolean) : [],
          preferredStyleIds: Array.isArray(u.preferredStyleIds) ? u.preferredStyleIds.filter(Boolean) : [],
          cartItems: u.cartItems || null,
          cartUpdatedAt: u.cartUpdatedAt ? new Date(u.cartUpdatedAt) : null,
          abandonedCartNotified: !!u.abandonedCartNotified,
        },
        create: {
          telegramId: String(u.telegramId),
          username: u.username || null,
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          photoUrl: u.photoUrl || null,
          phone: u.phone || null,
          address: u.address || null,
          adminNotes: u.adminNotes || null,
          totalSpent: Number(u.totalSpent) || 0,
          status: parseStatus(u.status),
          cashbackBalance: Number(u.cashbackBalance) || 0,
          onboardingDone: !!u.onboardingDone,
          referredBy: u.referredBy || null,
          preferredBrandIds: Array.isArray(u.preferredBrandIds) ? u.preferredBrandIds.filter(Boolean) : [],
          preferredStyleIds: Array.isArray(u.preferredStyleIds) ? u.preferredStyleIds.filter(Boolean) : [],
          cartItems: u.cartItems || null,
          cartUpdatedAt: u.cartUpdatedAt ? new Date(u.cartUpdatedAt) : null,
          abandonedCartNotified: !!u.abandonedCartNotified,
        },
      });
      userSanityIdToDbId.set(u._id, created.id);
    } catch (e) {
      console.error(`  Error migrating user ${u.telegramId}:`, e.message);
    }
  }
  console.log(`  Users migrated: ${userSanityIdToDbId.size}/${sanityUsers.length}\n`);

  // ── 2. Migrate Orders ─────────────────────────────────────────────────────
  console.log('Fetching orders from Sanity...');
  const sanityOrders = await sanity.fetch(`
    *[_type == "order"]{
      _id, orderId, total, cost, status, trackNumber, trackUrl, carrier,
      track17Registered, trackingStatus, trackingEvents, shippingMethod,
      promoCode, discount, notes, createdAt, updatedAt,
      "userSanityId": user._ref,
      "userTelegramId": user->telegramId,
      items
    }
  `);
  console.log(`  Found ${sanityOrders.length} orders`);

  const orderSanityIdToDbId = new Map();

  for (const o of sanityOrders) {
    if (!o.orderId) {
      console.warn(`  Skipping order without orderId: ${o._id}`);
      continue;
    }
    // Resolve user
    let userId = null;
    if (o.userSanityId && userSanityIdToDbId.has(o.userSanityId)) {
      userId = userSanityIdToDbId.get(o.userSanityId);
    } else if (o.userTelegramId) {
      const found = !dryRun ? await prisma.user.findUnique({ where: { telegramId: String(o.userTelegramId) } }) : null;
      userId = found?.id ?? null;
    }

    if (!userId && !dryRun) {
      // Create a placeholder user if not found
      try {
        const tgId = o.userTelegramId || `sanity-${o._id}`;
        const created = await prisma.user.upsert({
          where: { telegramId: String(tgId) },
          update: {},
          create: { telegramId: String(tgId), status: 'ROOKIE' },
        });
        userId = created.id;
      } catch (e) {
        console.warn(`  Could not find/create user for order ${o.orderId}`);
        continue;
      }
    }

    if (dryRun) {
      console.log(`  [DRY] Would upsert order: ${o.orderId}`);
      orderSanityIdToDbId.set(o._id, o.orderId);
      continue;
    }

    try {
      const items = Array.isArray(o.items) ? o.items.map((it) => ({
        productId: it.productId || '',
        title: it.title || '',
        brand: it.brand || '',
        size: it.size || 'One Size',
        color: it.color || '',
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      })) : [];

      const trackingEvents = Array.isArray(o.trackingEvents) ? o.trackingEvents.map((ev) => ({
        date: ev.date || null,
        status: ev.status || '',
        description: ev.description || '',
        location: ev.location || '',
      })) : null;

      const created = await prisma.order.upsert({
        where: { orderId: o.orderId },
        update: {
          userId,
          items,
          total: Number(o.total) || 0,
          cost: o.cost != null ? Number(o.cost) : null,
          status: parseOrderStatus(o.status),
          trackNumber: o.trackNumber || null,
          trackUrl: o.trackUrl || null,
          carrier: o.carrier || null,
          track17Registered: !!o.track17Registered,
          trackingStatus: o.trackingStatus || null,
          trackingEvents,
          shippingMethod: o.shippingMethod || null,
          promoCode: o.promoCode || null,
          discount: o.discount != null ? Number(o.discount) : null,
          notes: o.notes || null,
          createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
        },
        create: {
          orderId: o.orderId,
          userId,
          items,
          total: Number(o.total) || 0,
          cost: o.cost != null ? Number(o.cost) : null,
          status: parseOrderStatus(o.status),
          trackNumber: o.trackNumber || null,
          trackUrl: o.trackUrl || null,
          carrier: o.carrier || null,
          track17Registered: !!o.track17Registered,
          trackingStatus: o.trackingStatus || null,
          trackingEvents,
          shippingMethod: o.shippingMethod || null,
          promoCode: o.promoCode || null,
          discount: o.discount != null ? Number(o.discount) : null,
          notes: o.notes || null,
          createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
        },
      });
      orderSanityIdToDbId.set(o._id, created.id);
    } catch (e) {
      console.error(`  Error migrating order ${o.orderId}:`, e.message);
    }
  }
  console.log(`  Orders migrated: ${orderSanityIdToDbId.size}/${sanityOrders.length}\n`);

  // ── 3. Migrate Expenses ───────────────────────────────────────────────────
  console.log('Fetching expenses from Sanity...');
  const sanityExpenses = await sanity.fetch(`
    *[_type == "expense"]{
      _id, date, amount, currency, category, description,
      "relatedOrderSanityId": relatedOrder._ref
    }
  `);
  console.log(`  Found ${sanityExpenses.length} expenses`);
  let expensesOk = 0;

  for (const e of sanityExpenses) {
    if (dryRun) {
      console.log(`  [DRY] Would create expense: ${e.amount} ${e.currency}`);
      expensesOk++;
      continue;
    }
    let relatedOrderId = null;
    if (e.relatedOrderSanityId && orderSanityIdToDbId.has(e.relatedOrderSanityId)) {
      relatedOrderId = orderSanityIdToDbId.get(e.relatedOrderSanityId);
    }
    try {
      await prisma.expense.create({
        data: {
          date: e.date ? new Date(e.date) : new Date(),
          amount: Number(e.amount) || 0,
          currency: parseCurrency(e.currency),
          category: parseExpenseCategory(e.category),
          description: e.description || null,
          orderId: relatedOrderId,
        },
      });
      expensesOk++;
    } catch (err) {
      console.error(`  Error migrating expense:`, err.message);
    }
  }
  console.log(`  Expenses migrated: ${expensesOk}/${sanityExpenses.length}\n`);

  // ── 4. Migrate PromoCodes ─────────────────────────────────────────────────
  console.log('Fetching promo codes from Sanity...');
  const sanityPromos = await sanity.fetch(`
    *[_type == "promoCode"]{
      _id, code, type, value, minOrderTotal, maxUses, usedCount,
      maxUsesPerUser, isActive, expiresAt,
      usedBy[]{ telegramId, usedAt }
    }
  `);
  console.log(`  Found ${sanityPromos.length} promo codes`);
  let promosOk = 0;

  for (const p of sanityPromos) {
    if (!p.code) continue;
    if (dryRun) {
      console.log(`  [DRY] Would upsert promo: ${p.code}`);
      promosOk++;
      continue;
    }
    try {
      const promo = await prisma.promoCode.upsert({
        where: { code: p.code.trim().toUpperCase() },
        update: {
          type: parsePromoType(p.type),
          value: Number(p.value) || 0,
          minOrderTotal: p.minOrderTotal != null ? Number(p.minOrderTotal) : null,
          maxUses: p.maxUses != null ? Number(p.maxUses) : null,
          usedCount: Number(p.usedCount) || 0,
          maxUsesPerUser: Number(p.maxUsesPerUser) || 1,
          isActive: p.isActive !== false,
          expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
        },
        create: {
          code: p.code.trim().toUpperCase(),
          type: parsePromoType(p.type),
          value: Number(p.value) || 0,
          minOrderTotal: p.minOrderTotal != null ? Number(p.minOrderTotal) : null,
          maxUses: p.maxUses != null ? Number(p.maxUses) : null,
          usedCount: Number(p.usedCount) || 0,
          maxUsesPerUser: Number(p.maxUsesPerUser) || 1,
          isActive: p.isActive !== false,
          expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
        },
      });

      // Migrate usedBy records
      if (Array.isArray(p.usedBy) && p.usedBy.length > 0 && !dryRun) {
        for (const usage of p.usedBy) {
          if (!usage.telegramId) continue;
          const user = await prisma.user.findUnique({ where: { telegramId: String(usage.telegramId) } });
          if (!user) continue;
          const exists = await prisma.promoUsage.findFirst({
            where: { promoCodeId: promo.id, userId: user.id },
          });
          if (!exists) {
            await prisma.promoUsage.create({
              data: {
                promoCodeId: promo.id,
                userId: user.id,
                usedAt: usage.usedAt ? new Date(usage.usedAt) : new Date(),
              },
            });
          }
        }
      }
      promosOk++;
    } catch (err) {
      console.error(`  Error migrating promo ${p.code}:`, err.message);
    }
  }
  console.log(`  Promo codes migrated: ${promosOk}/${sanityPromos.length}\n`);

  // ── 5. Migrate Suppliers ──────────────────────────────────────────────────
  console.log('Fetching suppliers from Sanity...');
  const sanitySuppliers = await sanity.fetch(`
    *[_type == "yupooSupplier"]{
      _id, name, url, lastCheckedAt, lastAlbumCount, knownAlbumIds, isActive
    }
  `);
  console.log(`  Found ${sanitySuppliers.length} suppliers`);
  let suppliersOk = 0;

  for (const s of sanitySuppliers) {
    if (!s.url) continue;
    if (dryRun) {
      console.log(`  [DRY] Would upsert supplier: ${s.name} (${s.url})`);
      suppliersOk++;
      continue;
    }
    try {
      await prisma.supplier.upsert({
        where: { id: suppliersOk + 1 }, // fallback — upsert by URL not supported directly
        update: {},
        create: {
          name: s.name || s.url,
          url: s.url,
          lastCheckedAt: s.lastCheckedAt ? new Date(s.lastCheckedAt) : null,
          lastAlbumCount: s.lastAlbumCount != null ? Number(s.lastAlbumCount) : null,
          knownAlbumIds: Array.isArray(s.knownAlbumIds) ? s.knownAlbumIds.filter(Boolean) : [],
          isActive: s.isActive !== false,
        },
      }).catch(async () => {
        // If upsert fails, just create
        return prisma.supplier.create({
          data: {
            name: s.name || s.url,
            url: s.url,
            lastCheckedAt: s.lastCheckedAt ? new Date(s.lastCheckedAt) : null,
            lastAlbumCount: s.lastAlbumCount != null ? Number(s.lastAlbumCount) : null,
            knownAlbumIds: Array.isArray(s.knownAlbumIds) ? s.knownAlbumIds.filter(Boolean) : [],
            isActive: s.isActive !== false,
          },
        });
      });
      suppliersOk++;
    } catch (err) {
      console.error(`  Error migrating supplier ${s.name}:`, err.message);
    }
  }
  console.log(`  Suppliers migrated: ${suppliersOk}/${sanitySuppliers.length}\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('=== Migration Summary ===');
  console.log(`Users:      ${userSanityIdToDbId.size}/${sanityUsers.length}`);
  console.log(`Orders:     ${orderSanityIdToDbId.size}/${sanityOrders.length}`);
  console.log(`Expenses:   ${expensesOk}/${sanityExpenses.length}`);
  console.log(`Promos:     ${promosOk}/${sanityPromos.length}`);
  console.log(`Suppliers:  ${suppliersOk}/${sanitySuppliers.length}`);
  if (dryRun) console.log('\n[DRY RUN] No data was written to PostgreSQL.');
  else console.log('\nDone! Verify counts in your Neon/Postgres dashboard.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

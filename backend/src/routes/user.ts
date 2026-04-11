import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { validateUserInitData } from "../lib/validate-user.js";
import { syncCart } from "../lib/cart-service.js";
import { setPreferences } from "../lib/preferences-service.js";
import { sanityClient } from "../lib/sanity.js";
import groq from "groq";
import { UnauthorizedError, ValidationError, ApiError } from "../index.js";

const app = new Hono();

// ── GET /me ────────────────────────────────────────────────
app.get("/me", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, c.req.header("host"));
  if (!user) throw new UnauthorizedError();

  const telegramId = String(user.id);
  let userDoc = await prisma.user.findUnique({
    where: { telegramId },
    include: { userPreferences: { select: { preferenceType: true, externalId: true } } },
  });

  if (!userDoc) {
    userDoc = await prisma.user.create({
      data: { telegramId, firstName: user.first_name, username: user.username || null },
      include: { userPreferences: { select: { preferenceType: true, externalId: true } } },
    });
  }

  const normalizedBrandIds = userDoc.userPreferences.filter((p) => p.preferenceType === "brand").map((p) => p.externalId);
  const normalizedStyleIds = userDoc.userPreferences.filter((p) => p.preferenceType === "style").map((p) => p.externalId);
  const brandIds = normalizedBrandIds.length > 0 ? normalizedBrandIds : (userDoc.preferredBrandIds ?? []);
  const styleIds = normalizedStyleIds.length > 0 ? normalizedStyleIds : (userDoc.preferredStyleIds ?? []);

  interface Ref { _id: string; title: string; slug: { current: string } }
  const [preferredBrands, preferredStyles] = await Promise.all([
    brandIds.length
      ? sanityClient().fetch<Ref[]>(`*[_type == "brand" && _id in $ids] { _id, title, slug }`, { ids: brandIds }).catch(() => [] as Ref[])
      : Promise.resolve([] as Ref[]),
    styleIds.length
      ? sanityClient().fetch<Ref[]>(`*[_type == "style" && _id in $ids] { _id, title, slug }`, { ids: styleIds }).catch(() => [] as Ref[])
      : Promise.resolve([] as Ref[]),
  ]);

  return c.json({
    _id: String(userDoc.id),
    telegramId: userDoc.telegramId,
    username: userDoc.username,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    photoUrl: userDoc.photoUrl,
    totalSpent: userDoc.totalSpent,
    status: userDoc.status,
    cashbackBalance: userDoc.cashbackBalance,
    onboardingDone: userDoc.onboardingDone,
    preferredBrands,
    preferredStyles,
  });
});

// ── POST /preferences ──────────────────────────────────────
const prefsSchema = z.object({
  initData: z.string().min(1),
  brandIds: z.array(z.string().min(1)).max(50).default([]),
  styleIds: z.array(z.string().min(1)).max(50).default([]),
});

app.post("/preferences", async (c) => {
  const body = await c.req.json();
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid preferences payload");

  const user = validateUserInitData(parsed.data.initData, c.req.header("host"));
  if (!user) throw new UnauthorizedError();

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) throw new ApiError("User not found", 404, "NOT_FOUND");

  const brandIds = Array.from(new Set(parsed.data.brandIds));
  const styleIds = Array.from(new Set(parsed.data.styleIds));

  await prisma.user.update({
    where: { id: userDoc.id },
    data: { preferredBrandIds: brandIds, preferredStyleIds: styleIds, onboardingDone: true },
  });

  try { await setPreferences(userDoc.id, brandIds, styleIds); } catch (err) {
    console.error("UserPreference sync failed:", err);
  }

  return c.json({ ok: true });
});

// ── POST /sync-cart ────────────────────────────────────────
const cartItemSchema = z.object({
  productId: z.string().min(1),
  size: z.string().optional(),
  color: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(100),
  price: z.number().nonnegative().optional(),
  title: z.string().optional(),
});

const syncCartSchema = z.object({
  initData: z.string().min(1),
  cartItems: z.array(cartItemSchema).max(100),
});

app.post("/sync-cart", async (c) => {
  const body = await c.req.json();
  const parsed = syncCartSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid cart payload");

  const userData = validateUserInitData(parsed.data.initData, c.req.header("host"));
  if (!userData) throw new UnauthorizedError("Invalid initData");

  const user = await prisma.user.findUnique({ where: { telegramId: String(userData.id) }, select: { id: true } });
  if (!user) return c.json({ success: true, message: "User not found, skipping sync" });

  const hasItems = parsed.data.cartItems.length > 0;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      cartItems: hasItems ? JSON.stringify(parsed.data.cartItems) : null,
      cartUpdatedAt: hasItems ? new Date() : null,
      abandonedCartNotified: false,
    },
  });

  try {
    await syncCart(user.id, parsed.data.cartItems.map((it) => ({
      productId: it.productId, title: it.title, size: it.size || "One Size",
      color: it.color, price: it.price ?? 0, quantity: it.quantity,
    })));
  } catch (err) { console.error("CartItem sync failed:", err); }

  return c.json({ success: true });
});

// ── GET/POST/DELETE /wishlist ──────────────────────────────
app.get("/wishlist", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, c.req.header("host"));
  if (!user) return c.json({ items: [] });

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) return c.json({ items: [] });

  const items = await prisma.wishlistItem.findMany({ where: { userId: userDoc.id }, orderBy: { addedAt: "desc" } });
  return c.json({ items });
});

const addWishlistSchema = z.object({
  initData: z.string().min(1),
  productId: z.string().min(1),
  title: z.string().optional(),
  brand: z.string().optional(),
  price: z.number().nonnegative().optional(),
  imageUrl: z.string().optional(),
});

app.post("/wishlist", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = addWishlistSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid wishlist payload");

  const user = validateUserInitData(parsed.data.initData, c.req.header("host"));
  if (!user) throw new UnauthorizedError();

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) throw new UnauthorizedError("User not found");

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: userDoc.id, productId: parsed.data.productId } },
    update: { title: parsed.data.title ?? null, brand: parsed.data.brand ?? null, price: parsed.data.price ?? null, imageUrl: parsed.data.imageUrl ?? null },
    create: { userId: userDoc.id, productId: parsed.data.productId, title: parsed.data.title ?? null, brand: parsed.data.brand ?? null, price: parsed.data.price ?? null, imageUrl: parsed.data.imageUrl ?? null },
  });

  return c.json({ ok: true });
});

app.delete("/wishlist", async (c) => {
  const productId = c.req.query("productId");
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  if (!productId) throw new ValidationError("productId is required");

  const user = validateUserInitData(initData, c.req.header("host"));
  if (!user) throw new UnauthorizedError();

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) throw new UnauthorizedError("User not found");

  await prisma.wishlistItem.deleteMany({ where: { userId: userDoc.id, productId } });
  return c.json({ ok: true });
});

// ── GET /recently-viewed ──────────────────────────────────
const RECENTLY_VIEWED_PROJECTION = `{
  _id, title, slug, price, originalPrice,
  "images": images[0...2].asset->url,
  "brand": brand->{ _id, title, slug },
  "style": style->{ _id, title, slug },
  subtype, isHotDrop, isOnSale, isNewArrival
}`;

app.get("/recently-viewed", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, c.req.header("host"));
  if (!user) return c.json({ products: [] });

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) return c.json({ products: [] });

  const views = await prisma.productView.findMany({
    where: { userId: userDoc.id }, orderBy: { viewedAt: "desc" },
    select: { productId: true }, take: 36, distinct: ["productId"],
  });

  const ids = views.map((v) => v.productId).slice(0, 12);
  if (ids.length === 0) return c.json({ products: [] });

  const products = await sanityClient().fetch(
    groq`*[_type == "product" && _id in $ids] ${RECENTLY_VIEWED_PROJECTION}`,
    { ids }
  );

  const productMap = new Map<string, unknown>();
  for (const p of (products as { _id: string }[]) ?? []) productMap.set(p._id, p);
  const ordered = ids.map((id) => productMap.get(id)).filter(Boolean);

  return c.json({ products: ordered });
});

// ── POST /link-referral ───────────────────────────────────
const referralSchema = z.object({
  initData: z.string().min(1),
  referrerId: z.union([z.string(), z.number()]),
});

app.post("/link-referral", async (c) => {
  const body = await c.req.json();
  const parsed = referralSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid referral payload");

  const userData = validateUserInitData(parsed.data.initData, c.req.header("host"));
  if (!userData) throw new UnauthorizedError("Invalid auth");

  const telegramId = String(userData.id);
  const referrerId = String(parsed.data.referrerId);
  if (telegramId === referrerId) throw new ApiError("Self-referral not allowed", 400, "SELF_REFERRAL");

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (user) {
    const hasOrders = await prisma.order.count({ where: { userId: user.id } });
    if (hasOrders > 0 || user.referredBy) return c.json({ success: true, message: "User already established or referred" });
    await prisma.user.update({ where: { id: user.id }, data: { referredBy: referrerId } });
  } else {
    await prisma.user.create({ data: { telegramId, firstName: userData.first_name, username: userData.username || null, referredBy: referrerId } });
  }

  return c.json({ success: true });
});

export { app as userRoutes };

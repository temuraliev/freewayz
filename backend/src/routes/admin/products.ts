import { Hono } from "hono";
import { z } from "zod";
import imageUrlBuilder from "@sanity/image-url";
import { isAdminRequest } from "../../lib/admin-gate.js";
import { getSanityClient } from "../../lib/sanity.js";
import { normalizeSubtype } from "../../lib/normalize-subtype.js";
import { compressImageToMaxBytes } from "../../lib/compress-image.js";

const app = new Hono();

function getWriteClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) return null;
  return getSanityClient({ useCdn: false, withToken: true });
}

// ── GET /:id ──────────────────────────────────────────────
app.get("/:id", async (c) => {
  const docId = decodeURIComponent(c.req.param("id"));
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = isAdminRequest(c, initData);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const client = getWriteClient();
  if (!client) return c.json({ error: "Server misconfiguration" }, 500);

  const doc = await client.getDocument(docId);
  if (!doc) return c.json({ error: "Product not found" }, 404);

  const builder = imageUrlBuilder(client);
  const images = Array.isArray(doc.images)
    ? (doc.images as { asset?: { _ref?: string }; _key?: string }[]).map((img) => {
        const ref = img.asset?._ref;
        return { _ref: ref ?? "", url: ref ? builder.image(ref).width(400).url() : "" };
      })
    : [];

  return c.json({ _id: doc._id, title: doc.title, slug: doc.slug, description: doc.description, price: doc.price, originalPrice: doc.originalPrice, images });
});

// ── PATCH /:id ────────────────────────────────────────────
const patchSchema = z.object({
  initData: z.string().optional().default(""),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().min(0).nullable().optional(),
  subtype: z.string().nullable().optional(),
  isHotDrop: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  brandId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  styleId: z.string().nullable().optional(),
  imageRefs: z.array(z.string()).optional(),
});

app.patch("/:id", async (c) => {
  const docId = decodeURIComponent(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  const auth = isAdminRequest(c, parsed.data.initData ?? "");
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const client = getWriteClient();
  if (!client) return c.json({ error: "Server misconfiguration" }, 500);

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;
  if (parsed.data.originalPrice !== undefined) patch.originalPrice = parsed.data.originalPrice;
  if (parsed.data.subtype !== undefined) patch.subtype = normalizeSubtype(parsed.data.subtype) ?? null;
  if (parsed.data.isHotDrop !== undefined) patch.isHotDrop = parsed.data.isHotDrop;
  if (parsed.data.isOnSale !== undefined) patch.isOnSale = parsed.data.isOnSale;
  if (parsed.data.isNewArrival !== undefined) patch.isNewArrival = parsed.data.isNewArrival;
  if (parsed.data.sizes !== undefined) patch.sizes = parsed.data.sizes;
  if (parsed.data.colors !== undefined) patch.colors = parsed.data.colors;
  if (parsed.data.brandId !== undefined) patch.brand = parsed.data.brandId ? { _type: "reference", _ref: parsed.data.brandId } : null;
  if (parsed.data.categoryId !== undefined) patch.category = parsed.data.categoryId ? { _type: "reference", _ref: parsed.data.categoryId } : null;
  if (parsed.data.styleId !== undefined) patch.style = parsed.data.styleId ? { _type: "reference", _ref: parsed.data.styleId } : null;

  if (parsed.data.imageRefs !== undefined) {
    const doc = await client.getDocument(docId);
    if (!doc) return c.json({ error: "Product not found" }, 404);
    const currentImages = (Array.isArray(doc.images) ? doc.images : []) as { _key?: string; asset?: { _ref?: string } }[];
    const refToKey = new Map<string, string>();
    for (const img of currentImages) { const ref = img.asset?._ref; if (ref && img._key) refToKey.set(ref, img._key); }
    patch.images = parsed.data.imageRefs.filter(Boolean).map((ref) => ({
      _key: refToKey.get(ref) ?? `img-${Date.now()}-${ref.slice(-6)}`,
      _type: "image" as const,
      asset: { _type: "reference" as const, _ref: ref },
    }));
  }

  if (Object.keys(patch).length === 0) return c.json({ ok: true, message: "Nothing to update" });

  await client.patch(docId).set(patch).commit();
  return c.json({ ok: true });
});

// ── POST /:id/publish ─────────────────────────────────────
app.post("/:id/publish", async (c) => {
  const docId = decodeURIComponent(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const initData = (body as { initData?: string })?.initData ?? "";

  const auth = isAdminRequest(c, initData);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const client = getWriteClient();
  if (!client) return c.json({ error: "Server misconfiguration" }, 500);

  const publishedId = docId.startsWith("drafts.") ? docId.replace(/^drafts\./, "") : docId;
  const draft = await client.getDocument(docId);
  if (!draft) return c.json({ error: "Document not found" }, 404);

  const { _id, _rev, ...content } = draft;
  await client.createOrReplace({ ...content, _id: publishedId });
  await client.delete(docId);
  return c.json({ ok: true });
});

// ── POST /:id/upload-image ────────────────────────────────
app.post("/:id/upload-image", async (c) => {
  const docId = decodeURIComponent(c.req.param("id"));

  const formData = await c.req.formData();
  const initData = (formData.get("initData") as string | null) ?? "";
  const auth = isAdminRequest(c, initData);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const file = formData.get("image") as File | null;
  if (!file || !(file instanceof Blob)) return c.json({ error: "image file required" }, 400);

  const client = getWriteClient();
  if (!client) return c.json({ error: "Server misconfiguration" }, 500);

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = await compressImageToMaxBytes(rawBuffer, 500 * 1024);
  const asset = await client.assets.upload("image", buffer, { filename: file.name || "admin-upload.jpg", contentType: "image/jpeg" });

  const doc = await client.getDocument(docId);
  if (!doc) return c.json({ error: "Product not found" }, 404);

  const images = Array.isArray(doc.images) ? [...doc.images] : [];
  images.push({ _key: `img-${Date.now()}-${asset._id.slice(-6)}`, _type: "image", asset: { _type: "reference", _ref: asset._id } });
  await client.patch(docId).set({ images }).commit();

  const builder = imageUrlBuilder(client);
  const url = builder.image(asset._id).width(800).url();
  return c.json({ ok: true, assetId: asset._id, url });
});

export { app as adminProductsRoutes };

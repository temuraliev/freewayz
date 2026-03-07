import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

function getSanityClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) return null;
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });
}

/** GET: fetch product with image refs + URLs for admin overlay (reorder/add photos). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = decodeURIComponent(id);
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (!initData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = validateAdminInitData(initData);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const client = getSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  try {
    const doc = await client.getDocument(docId);
    if (!doc) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const builder = imageUrlBuilder(client);
    const images = Array.isArray(doc.images)
      ? (doc.images as { asset?: { _ref?: string }; _key?: string }[]).map((img) => {
          const ref = img.asset?._ref;
          const url = ref ? builder.image(ref).width(400).url() : "";
          return { _ref: ref ?? "", url };
        })
      : [];
    return NextResponse.json({
      _id: doc._id,
      title: doc.title,
      slug: doc.slug,
      description: doc.description,
      price: doc.price,
      originalPrice: doc.originalPrice,
      images,
    });
  } catch (e) {
    console.error("GET product error:", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

const bodySchema = z.object({
  initData: z.string().min(1),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = decodeURIComponent(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const auth = validateAdminInitData(parsed.data.initData);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;
  if (parsed.data.originalPrice !== undefined) patch.originalPrice = parsed.data.originalPrice;
  if (parsed.data.subtype !== undefined) patch.subtype = parsed.data.subtype;
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
    if (!doc) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const currentImages = (Array.isArray(doc.images) ? doc.images : []) as { _key?: string; asset?: { _ref?: string } }[];
    const refToKey = new Map<string, string>();
    for (const img of currentImages) {
      const ref = img.asset?._ref;
      if (ref && img._key) refToKey.set(ref, img._key);
    }
    const newImages = parsed.data.imageRefs
      .filter(Boolean)
      .map((ref) => ({
        _key: refToKey.get(ref) ?? `img-${Date.now()}-${ref.slice(-6)}`,
        _type: "image" as const,
        asset: { _type: "reference" as const, _ref: ref },
      }));
    patch.images = newImages;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, message: "Nothing to update" });
  }

  try {
    await client.patch(docId).set(patch).commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Sanity patch error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@backend/auth/admin-gate";
import { getDataSource } from "@backend/data-source";
import { Product } from "@backend/entities/Product";
import { z } from "zod";

/** GET: fetch product with images for admin overlay. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = isAdminRequest(request, initData);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ds = await getDataSource();
    const product = await ds.getRepository(Product).findOne({
      where: { id: productId },
      relations: ["brand", "category", "style", "images"],
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const images = (product.images || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ id: img.id, url: img.url, r2Key: img.r2Key }));

    return NextResponse.json({
      _id: String(product.id),
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: Number(product.price),
      originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
      images,
    });
  } catch (e) {
    console.error("GET product error:", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

const bodySchema = z.object({
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
  brandId: z.union([z.string(), z.number()]).nullable().optional(),
  categoryId: z.union([z.string(), z.number()]).nullable().optional(),
  styleId: z.union([z.string(), z.number()]).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);

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

  const auth = isAdminRequest(request, parsed.data.initData ?? "");
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(Product);
  const product = await repo.findOne({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const update: Partial<Product> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.price !== undefined) update.price = parsed.data.price;
  if (parsed.data.originalPrice !== undefined) update.originalPrice = parsed.data.originalPrice;
  if (parsed.data.subtype !== undefined) update.subtype = parsed.data.subtype;
  if (parsed.data.isHotDrop !== undefined) update.isHotDrop = parsed.data.isHotDrop;
  if (parsed.data.isOnSale !== undefined) update.isOnSale = parsed.data.isOnSale;
  if (parsed.data.isNewArrival !== undefined) update.isNewArrival = parsed.data.isNewArrival;
  if (parsed.data.sizes !== undefined) update.sizes = parsed.data.sizes;
  if (parsed.data.colors !== undefined) update.colors = parsed.data.colors;
  if (parsed.data.brandId !== undefined) update.brandId = parsed.data.brandId ? Number(parsed.data.brandId) : null;
  if (parsed.data.categoryId !== undefined) update.categoryId = parsed.data.categoryId ? Number(parsed.data.categoryId) : null;
  if (parsed.data.styleId !== undefined) update.styleId = Number(parsed.data.styleId);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, message: "Nothing to update" });
  }

  try {
    await repo.update(productId, update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Product update error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

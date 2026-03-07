import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

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

  const user = validateAdminInitData(parsed.data.initData);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });

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

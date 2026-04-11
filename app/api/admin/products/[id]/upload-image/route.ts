import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@backend/auth/admin-gate";
import { compressImageToMaxBytes } from "@backend/integrations/compress-image";
import { uploadImage } from "@backend/integrations/r2-storage";
import { getDataSource } from "@backend/data-source";
import { Product } from "@backend/entities/Product";
import { ProductImage } from "@backend/entities/ProductImage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);

  const formData = await request.formData();
  const initData = (formData.get("initData") as string | null) ?? "";
  const auth = isAdminRequest(request, initData);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = formData.get("image") as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
  }

  const ds = await getDataSource();

  // Verify product exists
  const product = await ds.getRepository(Product).findOne({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const buffer = await compressImageToMaxBytes(rawBuffer, 500 * 1024);

    // Upload to R2
    const { url, r2Key } = await uploadImage(buffer, productId);

    // Get current max sort order
    const maxSort = await ds.getRepository(ProductImage)
      .createQueryBuilder("img")
      .select("MAX(img.sortOrder)", "max")
      .where("img.productId = :productId", { productId })
      .getRawOne();
    const sortOrder = (maxSort?.max ?? -1) + 1;

    // Create ProductImage record
    const img = ds.getRepository(ProductImage).create({
      productId,
      url,
      r2Key,
      sortOrder,
    });
    await ds.getRepository(ProductImage).save(img);

    return NextResponse.json({ ok: true, id: img.id, url });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

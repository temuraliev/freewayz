import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import { validateAdminInitData } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = decodeURIComponent(id);

  const formData = await request.formData();
  const initData = formData.get("initData");
  const file = formData.get("image") as File | null;

  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ error: "initData required" }, { status: 400 });
  }

  const auth = validateAdminInitData(initData);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await client.assets.upload("image", buffer, {
      filename: file.name || "admin-upload.jpg",
      contentType: file.type || "image/jpeg",
    });
    const doc = await client.getDocument(docId);
    if (!doc) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const images = Array.isArray(doc.images) ? [...doc.images] : [];
    images.push({
      _key: `img-${Date.now()}-${asset._id.slice(-6)}`,
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    });
    await client.patch(docId).set({ images }).commit();
    const builder = imageUrlBuilder(client);
    const url = builder.image(asset._id).width(800).url();
    return NextResponse.json({ ok: true, assetId: asset._id, url });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

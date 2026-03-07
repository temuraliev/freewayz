import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (!initData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = validateAdminInitData(initData);
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

  try {
    const list = await client.fetch(
      `*[_type == "yupooSupplier"] | order(name asc) { _id, name, url, lastCheckedAt, lastAlbumCount, isActive }`
    );
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error("Suppliers fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

const bodySchema = { name: "string", url: "string" };

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const initData = (body as Record<string, unknown>)?.initData;
  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ error: "initData required" }, { status: 400 });
  }
  const user = validateAdminInitData(initData);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = (body as Record<string, unknown>)?.name as string | undefined;
  const url = (body as Record<string, unknown>)?.url as string | undefined;
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 });
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
    const doc = await client.create({
      _type: "yupooSupplier",
      name: name.trim(),
      url: url.trim(),
      isActive: true,
    });
    return NextResponse.json({ ok: true, id: doc._id });
  } catch (e) {
    console.error("Supplier create error:", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

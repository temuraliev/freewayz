import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

const bodySchema = z.object({ initData: z.string() });

export async function POST(
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
    return NextResponse.json({ error: "initData required" }, { status: 400 });
  }

  const auth = validateAdminInitData(parsed.data.initData ?? "", request.headers.get("host"));
  if (!auth.ok) {
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

  const publishedId = docId.startsWith("drafts.") ? docId.replace(/^drafts\./, "") : docId;

  try {
    const draft = await client.getDocument(docId);
    if (!draft) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const { _id, _rev, ...content } = draft;
    await client.createOrReplace({ ...content, _id: publishedId });
    await client.delete(docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Publish error:", e);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}

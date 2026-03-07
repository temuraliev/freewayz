import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";

const orderFields = `
  _id,
  orderId,
  total,
  status,
  trackNumber,
  trackUrl,
  notes,
  createdAt,
  "user": user->{ telegramId, username }
`;

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
    const orders = await client.fetch(
      `*[_type == "order"] | order(createdAt desc) [0...100] { ${orderFields} }`
    );
    return NextResponse.json(orders ?? []);
  } catch (e) {
    console.error("Orders fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

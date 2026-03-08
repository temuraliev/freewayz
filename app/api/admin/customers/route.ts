import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";

function makeSanityClient() {
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

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = makeSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const search = request.nextUrl.searchParams.get("q") || "";

  try {
    let filter = `_type == "user"`;
    const params: Record<string, string> = {};

    if (search) {
      filter += ` && (username match $q || firstName match $q || telegramId == $exact)`;
      params.q = `*${search}*`;
      params.exact = search;
    }

    const users = await client.fetch(
      `*[${filter}] | order(totalSpent desc) [0...200] {
        _id,
        telegramId,
        username,
        firstName,
        lastName,
        phone,
        address,
        adminNotes,
        totalSpent,
        status,
        cashbackBalance,
        "orderCount": count(*[_type == "order" && user._ref == ^._id]),
        "lastOrderDate": *[_type == "order" && user._ref == ^._id] | order(createdAt desc) [0].createdAt
      }`,
      params
    );

    return NextResponse.json(users ?? []);
  } catch (e) {
    console.error("Customers fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

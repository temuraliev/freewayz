import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

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

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";

  try {
    const params: Record<string, string> = {};
    let expenseFilter = `_type == "expense"`;
    if (from) {
      params.from = from;
      expenseFilter += ` && date >= $from`;
    }
    if (to) {
      params.to = to;
      expenseFilter += ` && date <= $to`;
    }
    const expenses = await client.fetch(
      `*[${expenseFilter}] | order(date desc) { _id, date, amount, currency, category, description }`,
      params
    );
    const orders = await client.fetch(
      `*[_type == "order" && status != "cancelled"] { total, createdAt }`
    );
    const revenue = Array.isArray(orders)
      ? (orders as { total?: number }[]).reduce((s, o) => s + (Number(o.total) || 0), 0)
      : 0;
    const totalExpense = Array.isArray(expenses)
      ? (expenses as { amount?: number; currency?: string }[]).reduce((s, e) => {
          const amt = Number(e.amount) || 0;
          return s + (e.currency === "UZS" ? amt : amt * 1600);
        }, 0)
      : 0;
    return NextResponse.json({
      expenses: expenses ?? [],
      revenue,
      totalExpense,
      profit: revenue - totalExpense,
    });
  } catch (e) {
    console.error("Finance fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

const bodySchema = z.object({
  initData: z.string().min(1),
  date: z.string(),
  amount: z.number(),
  currency: z.enum(["UZS", "CNY", "USD"]),
  category: z.enum(["shipping", "purchase", "packaging", "other"]),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
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

  try {
    await client.create({
      _type: "expense",
      date: parsed.data.date,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      category: parsed.data.category,
      description: parsed.data.description ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Expense create error:", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

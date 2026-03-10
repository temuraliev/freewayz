import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
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

    let orderFilter = `_type == "order" && status != "cancelled"`;
    const orderParams = { ...params };
    if (from) orderFilter += ` && createdAt >= $from`;
    if (to) {
      orderFilter += ` && createdAt <= $toEnd`;
      orderParams.toEnd = `${to}T23:59:59.999Z`;
    }
    const orders = await client.fetch<{ total?: number; cost?: number }[]>(
      `*[${orderFilter}] { total, cost, createdAt }`,
      orderParams
    );

    const revenue = Array.isArray(orders)
      ? orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
      : 0;
    const costOfGoods = Array.isArray(orders)
      ? orders.reduce((s, o) => s + (Number(o.cost) || 0), 0)
      : 0;
    const totalExpense = Array.isArray(expenses)
      ? (expenses as { amount?: number; currency?: string }[]).reduce((s, e) => {
          const amt = Number(e.amount) || 0;
          return s + (e.currency === "UZS" ? amt : amt * 1600);
        }, 0)
      : 0;
    const profit = revenue - costOfGoods - totalExpense;

    return NextResponse.json({
      expenses: expenses ?? [],
      revenue,
      costOfGoods,
      totalExpense,
      profit,
    });
  } catch (e) {
    console.error("Finance fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

const bodySchema = z.object({
  initData: z.string(),
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

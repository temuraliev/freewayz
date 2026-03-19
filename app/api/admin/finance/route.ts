import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";

  try {
    const expenseWhere: Prisma.ExpenseWhereInput = {};
    if (from) expenseWhere.date = { ...(expenseWhere.date as object), gte: new Date(from) };
    if (to) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      expenseWhere.date = { ...(expenseWhere.date as object), lte: toEnd };
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: "desc" },
      select: { id: true, date: true, amount: true, currency: true, category: true, description: true },
    });

    const orderWhere: Prisma.OrderWhereInput = { status: { not: "cancelled" } };
    if (from) orderWhere.createdAt = { ...(orderWhere.createdAt as object), gte: new Date(from) };
    if (to) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      orderWhere.createdAt = { ...(orderWhere.createdAt as object), lte: toEnd };
    }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: { total: true, cost: true },
    });

    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const costOfGoods = orders.reduce((s, o) => s + (o.cost || 0), 0);
    const totalExpense = expenses.reduce((s, e) => {
      const amt = Number(e.amount) || 0;
      return s + (e.currency === "UZS" ? amt : amt * 1600);
    }, 0);
    const profit = revenue - costOfGoods - totalExpense;

    return NextResponse.json({
      expenses,
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

  try {
    await prisma.expense.create({
      data: {
        date: new Date(parsed.data.date),
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        category: parsed.data.category,
        description: parsed.data.description ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Expense create error:", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

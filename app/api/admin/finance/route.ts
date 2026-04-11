import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

const dateString = z
  .string()
  .refine((s) => !s || !isNaN(Date.parse(s)), "Invalid date")
  .optional();

const querySchema = z.object({
  from: dateString,
  to: dateString,
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const parsed = querySchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) throw new ValidationError("Invalid date range");

  const { from, to } = parsed.data;

  const expenseWhere: { date?: { gte?: Date; lte?: Date } } = {};
  if (from) expenseWhere.date = { ...(expenseWhere.date ?? {}), gte: new Date(from) };
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    expenseWhere.date = { ...(expenseWhere.date ?? {}), lte: toEnd };
  }

  const orderWhere: {
    status: { not: "cancelled" };
    createdAt?: { gte?: Date; lte?: Date };
  } = { status: { not: "cancelled" } };
  if (from) orderWhere.createdAt = { ...(orderWhere.createdAt ?? {}), gte: new Date(from) };
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    orderWhere.createdAt = { ...(orderWhere.createdAt ?? {}), lte: toEnd };
  }

  const [expenses, orders] = await Promise.all([
    prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        amount: true,
        currency: true,
        category: true,
        description: true,
      },
    }),
    prisma.order.findMany({
      where: orderWhere,
      select: { total: true, cost: true },
    }),
  ]);

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
});

const expenseBodySchema = z.object({
  initData: z.string(),
  date: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  amount: z.number().positive(),
  currency: z.enum(["UZS", "CNY", "USD"]),
  category: z.enum(["shipping", "purchase", "packaging", "other"]),
  description: z.string().max(500).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = expenseBodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid expense payload");

  const auth = validateAdminInitData(parsed.data.initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

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
});

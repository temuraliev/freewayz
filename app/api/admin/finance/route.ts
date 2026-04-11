import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@backend/data-source";
import { Expense } from "@backend/entities/Expense";
import { OrderEntity, OrderStatus } from "@backend/entities/Order";
import { FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
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

  const ds = await getDataSource();
  const expenseRepo = ds.getRepository(Expense);
  const orderRepo = ds.getRepository(OrderEntity);

  const expenseWhere: FindOptionsWhere<Expense> = {};
  if (from) {
    expenseWhere.date = MoreThanOrEqual(new Date(from));
  }
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    expenseWhere.date = LessThanOrEqual(toEnd);
  }

  // For expenses with both from and to, use query builder for range
  let expensesPromise: Promise<Expense[]>;
  if (from && to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    expensesPromise = expenseRepo
      .createQueryBuilder("e")
      .where("e.date >= :from", { from: new Date(from) })
      .andWhere("e.date <= :to", { to: toEnd })
      .orderBy("e.date", "DESC")
      .getMany();
  } else {
    expensesPromise = expenseRepo.find({
      where: expenseWhere,
      order: { date: "DESC" },
    });
  }

  // Build order where for revenue calculation
  const orderQb = orderRepo
    .createQueryBuilder("o")
    .select(["o.total", "o.cost"])
    .where("o.status != :cancelled", { cancelled: OrderStatus.CANCELLED });

  if (from) {
    orderQb.andWhere("o.createdAt >= :from", { from: new Date(from) });
  }
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    orderQb.andWhere("o.createdAt <= :to", { to: toEnd });
  }

  const [expenses, orders] = await Promise.all([
    expensesPromise,
    orderQb.getMany(),
  ]);

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const costOfGoods = orders.reduce((s, o) => s + (o.cost || 0), 0);
  const totalExpense = expenses.reduce((s, e) => {
    const amt = Number(e.amount) || 0;
    return s + (e.currency === "UZS" ? amt : amt * 1600);
  }, 0);
  const profit = revenue - costOfGoods - totalExpense;

  const expensesFormatted = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    description: e.description,
  }));

  return NextResponse.json({
    expenses: expensesFormatted,
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

  const ds = await getDataSource();
  const expenseRepo = ds.getRepository(Expense);

  const expense = expenseRepo.create({
    date: new Date(parsed.data.date),
    amount: parsed.data.amount,
    currency: parsed.data.currency as Expense["currency"],
    category: parsed.data.category as Expense["category"],
    description: parsed.data.description ?? null,
  });

  await expenseRepo.save(expense);

  return NextResponse.json({ ok: true });
});

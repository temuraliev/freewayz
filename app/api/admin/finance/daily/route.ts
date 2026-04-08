import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@/lib/api/with-error-handler";

/**
 * GET /api/admin/finance/daily?days=30
 * Returns daily revenue + order count for the last N days (default 30).
 */

interface DailyRow {
  day: Date;
  revenue: number;
  order_count: bigint;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const daysParam = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT
      DATE_TRUNC('day', "createdAt") AS day,
      COALESCE(SUM(total), 0)::float AS revenue,
      COUNT(*) AS order_count
    FROM "Order"
    WHERE "createdAt" >= ${since}
      AND status != 'cancelled'
    GROUP BY day
    ORDER BY day ASC
  `;

  // Fill in missing days with zeros
  const dayMap = new Map<string, { revenue: number; orderCount: number }>();
  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    dayMap.set(key, {
      revenue: row.revenue,
      orderCount: Number(row.order_count),
    });
  }

  const result: { date: string; revenue: number; orderCount: number }[] = [];
  const cursor = new Date(since);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = dayMap.get(key) ?? { revenue: 0, orderCount: 0 };
    result.push({ date: key, revenue: entry.revenue, orderCount: entry.orderCount });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Sanity: silence unused import warning
  void Prisma;

  return NextResponse.json({ days, data: result });
});

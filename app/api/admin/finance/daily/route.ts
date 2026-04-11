import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { OrderStatus } from "@backend/entities/Order";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

/**
 * GET /api/admin/finance/daily?days=30
 * Returns daily revenue + order count for the last N days (default 30).
 */

interface DailyRow {
  day: string;
  revenue: number;
  order_count: string;
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

  const ds = await getDataSource();

  // MySQL uses DATE() instead of DATE_TRUNC, and doesn't need ::float cast
  const rows: DailyRow[] = await ds.query(
    `SELECT
      DATE(createdAt) AS day,
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*) AS order_count
    FROM orders
    WHERE createdAt >= ?
      AND status != ?
    GROUP BY DATE(createdAt)
    ORDER BY day ASC`,
    [since, OrderStatus.CANCELLED]
  );

  // Fill in missing days with zeros
  const dayMap = new Map<string, { revenue: number; orderCount: number }>();
  for (const row of rows) {
    // MySQL DATE() returns a string like "2024-01-15"
    const key = typeof row.day === "string"
      ? row.day.slice(0, 10)
      : new Date(row.day).toISOString().slice(0, 10);
    dayMap.set(key, {
      revenue: Number(row.revenue),
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

  return NextResponse.json({ days, data: result });
});

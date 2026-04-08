import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminInitData } from "@/lib/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@/lib/api/with-error-handler";
import { Prisma } from "@prisma/client";

// Single-query version: uses raw SQL to avoid N+1 (one query per user for last order)
interface CustomerRow {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  adminNotes: string | null;
  totalSpent: number;
  status: string;
  cashbackBalance: number;
  orderCount: bigint;
  lastOrderDate: Date | null;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    throw new UnauthorizedError();
  }

  const search = (request.nextUrl.searchParams.get("q") || "").trim();
  const searchPattern = `%${search}%`;

  // Single query: join with aggregated order stats. No N+1.
  const rows = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      u.id,
      u."telegramId",
      u.username,
      u."firstName",
      u."lastName",
      u.phone,
      u.address,
      u."adminNotes",
      u."totalSpent",
      u.status::text AS status,
      u."cashbackBalance",
      COALESCE(o.order_count, 0) AS "orderCount",
      o.last_order_date AS "lastOrderDate"
    FROM "User" u
    LEFT JOIN (
      SELECT
        "userId",
        COUNT(*) AS order_count,
        MAX("createdAt") AS last_order_date
      FROM "Order"
      GROUP BY "userId"
    ) o ON o."userId" = u.id
    ${search
      ? Prisma.sql`WHERE u.username ILIKE ${searchPattern}
                   OR u."firstName" ILIKE ${searchPattern}
                   OR u."telegramId" = ${search}`
      : Prisma.empty}
    ORDER BY u."totalSpent" DESC
    LIMIT 200
  `;

  const formatted = rows.map((u) => ({
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    address: u.address,
    adminNotes: u.adminNotes,
    totalSpent: u.totalSpent,
    status: u.status,
    cashbackBalance: u.cashbackBalance,
    orderCount: Number(u.orderCount),
    lastOrderDate: u.lastOrderDate,
  }));

  return NextResponse.json(formatted);
});

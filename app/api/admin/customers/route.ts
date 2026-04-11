import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

// Single-query version: uses QueryBuilder to avoid N+1 (one query per user for last order)
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
  orderCount: number;
  lastOrderDate: Date | null;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    throw new UnauthorizedError();
  }

  const search = (request.nextUrl.searchParams.get("q") || "").trim();

  const ds = await getDataSource();

  // Single query: join with aggregated order stats. No N+1.
  // MySQL uses LIKE which is case-insensitive by default with utf8mb4 collation.
  const qb = ds
    .getRepository(User)
    .createQueryBuilder("u")
    .select([
      "u.id AS id",
      "u.telegramId AS telegramId",
      "u.username AS username",
      "u.firstName AS firstName",
      "u.lastName AS lastName",
      "u.phone AS phone",
      "u.address AS address",
      "u.adminNotes AS adminNotes",
      "u.totalSpent AS totalSpent",
      "u.status AS status",
      "u.cashbackBalance AS cashbackBalance",
      "COALESCE(o.order_count, 0) AS orderCount",
      "o.last_order_date AS lastOrderDate",
    ])
    .leftJoin(
      (subQuery) =>
        subQuery
          .select("ord.userId", "userId")
          .addSelect("COUNT(*)", "order_count")
          .addSelect("MAX(ord.createdAt)", "last_order_date")
          .from("orders", "ord")
          .groupBy("ord.userId"),
      "o",
      "o.userId = u.id"
    );

  if (search) {
    qb.where(
      "(u.username LIKE :pattern OR u.firstName LIKE :pattern OR u.telegramId = :exact)",
      { pattern: `%${search}%`, exact: search }
    );
  }

  qb.orderBy("u.totalSpent", "DESC").limit(200);

  const rows: CustomerRow[] = await qb.getRawMany();

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

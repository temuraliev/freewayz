import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { OrderEntity } from "@backend/entities/Order";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

type OrderStatusFilter = "new" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const status = request.nextUrl.searchParams.get("status") || "";
  const search = request.nextUrl.searchParams.get("q") || "";

  const ds = await getDataSource();
  const orderRepo = ds.getRepository(OrderEntity);

  // Build query for orders
  const qb = orderRepo
    .createQueryBuilder("o")
    .leftJoinAndSelect("o.user", "u")
    .orderBy("o.createdAt", "DESC")
    .take(200);

  if (status && status !== "all") {
    qb.andWhere("o.status = :status", { status: status as OrderStatusFilter });
  }

  if (search) {
    qb.andWhere("(o.orderId LIKE :search OR u.username LIKE :search)", {
      search: `%${search}%`,
    });
  }

  const [orders, total] = await Promise.all([
    qb.getMany(),
    orderRepo.count(),
  ]);

  // Status counts
  const countRows = await orderRepo
    .createQueryBuilder("o")
    .select("o.status", "status")
    .addSelect("COUNT(*)", "cnt")
    .groupBy("o.status")
    .getRawMany<{ status: string; cnt: string }>();

  const statusCounts: Record<string, number> = {
    all: total,
    new: 0,
    paid: 0,
    ordered: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const c of countRows) {
    statusCounts[c.status] = Number(c.cnt);
  }

  const formatted = orders.map((o) => ({
    id: o.id,
    orderId: o.orderId,
    total: o.total,
    status: o.status,
    trackNumber: o.trackNumber,
    trackUrl: o.trackUrl,
    trackingStatus: o.trackingStatus,
    notes: o.notes,
    createdAt: o.createdAt,
    user: o.user
      ? {
          id: o.user.id,
          telegramId: o.user.telegramId,
          username: o.user.username,
          firstName: o.user.firstName,
        }
      : null,
  }));

  return NextResponse.json({ orders: formatted, counts: statusCounts });
});

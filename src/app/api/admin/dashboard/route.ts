import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { OrderEntity, OrderStatus } from "@backend/entities/Order";
import { Not, LessThan } from "typeorm";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const ds = await getDataSource();
  const orderRepo = ds.getRepository(OrderEntity);
  const userRepo = ds.getRepository(User);

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    newOrdersCount,
    ordersWithoutTrack,
    abandonedCartsCount,
    totalOrders,
    totalRevenueResult,
    ordersInTransit,
    totalCustomers,
  ] = await Promise.all([
    // New orders waiting for confirmation
    orderRepo.count({ where: { status: OrderStatus.NEW } }),
    // Confirmed orders without tracking number
    orderRepo
      .createQueryBuilder("o")
      .where("o.status = :status", { status: OrderStatus.ORDERED })
      .andWhere("o.trackNumber IS NULL")
      .getCount(),
    // Abandoned carts in last 24h
    userRepo.count({
      where: {
        cartItems: Not(""),
        cartUpdatedAt: LessThan(twentyFourHoursAgo),
        abandonedCartNotified: false,
      },
    }),
    // Total orders
    orderRepo.count(),
    // Total revenue (non-cancelled)
    orderRepo
      .createQueryBuilder("o")
      .select("COALESCE(SUM(o.total), 0)", "sum")
      .where("o.status != :status", { status: OrderStatus.CANCELLED })
      .getRawOne<{ sum: number }>(),
    // Orders in transit
    orderRepo.count({ where: { status: OrderStatus.SHIPPED } }),
    // Total customers
    userRepo.count(),
  ]);

  return NextResponse.json({
    alerts: [
      ...(newOrdersCount > 0
        ? [{ type: "warning", text: `${newOrdersCount} новых заказов ждут подтверждения`, link: "/admin/orders?status=new" }]
        : []),
      ...(ordersWithoutTrack > 0
        ? [{ type: "info", text: `${ordersWithoutTrack} заказов без трек-номера`, link: "/admin/orders?status=ordered" }]
        : []),
      ...(abandonedCartsCount > 0
        ? [{ type: "info", text: `${abandonedCartsCount} брошенных корзин за 24ч`, link: null }]
        : []),
    ],
    stats: {
      totalOrders,
      totalRevenue: totalRevenueResult?.sum ?? 0,
      ordersInTransit,
      totalCustomers,
      newOrdersCount,
    },
  });
});

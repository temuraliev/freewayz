import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    newOrdersCount,
    ordersWithoutTrack,
    abandonedCartsCount,
    totalOrders,
    totalRevenue,
    ordersInTransit,
    totalCustomers,
  ] = await Promise.all([
    // New orders waiting for confirmation
    prisma.order.count({ where: { status: "new" } }),
    // Confirmed orders without tracking number
    prisma.order.count({
      where: { status: "ordered", trackNumber: null },
    }),
    // Abandoned carts in last 24h
    prisma.user.count({
      where: {
        cartItems: { not: null },
        cartUpdatedAt: { lt: twentyFourHoursAgo },
        abandonedCartNotified: false,
      },
    }),
    // Total orders
    prisma.order.count(),
    // Total revenue (non-cancelled)
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "cancelled" } },
    }),
    // Orders in transit
    prisma.order.count({ where: { status: "shipped" } }),
    // Total customers
    prisma.user.count(),
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
      totalRevenue: totalRevenue._sum.total ?? 0,
      ordersInTransit,
      totalCustomers,
      newOrdersCount,
    },
  });
});

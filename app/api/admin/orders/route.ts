import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

type OrderStatus = "new" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const status = request.nextUrl.searchParams.get("status") || "";
  const search = request.nextUrl.searchParams.get("q") || "";

  const where: {
    status?: OrderStatus;
    OR?: Array<
      | { orderId: { contains: string; mode: "insensitive" } }
      | { user: { username: { contains: string; mode: "insensitive" } } }
    >;
  } = {};

  if (status && status !== "all") {
    where.status = status as OrderStatus;
  }

  if (search) {
    where.OR = [
      { orderId: { contains: search, mode: "insensitive" } },
      { user: { username: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, counts, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { id: true, telegramId: true, username: true, firstName: true },
        },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.order.count(),
  ]);

  const statusCounts: Record<string, number> = {
    all: total,
    new: 0,
    paid: 0,
    ordered: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const c of counts) {
    statusCounts[c.status] = c._count.status;
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

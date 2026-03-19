import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAdminInitData } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") || "";
  const search = request.nextUrl.searchParams.get("q") || "";

  try {
    const where: Prisma.OrderWhereInput = {};

    if (status && status !== "all") {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: "insensitive" } },
        { user: { username: { contains: search, mode: "insensitive" } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { id: true, telegramId: true, username: true, firstName: true },
        },
      },
    });

    const counts = await prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const statusCounts: Record<string, number> = {
      all: await prisma.order.count(),
      new: 0, paid: 0, ordered: 0, shipped: 0, delivered: 0, cancelled: 0,
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
      user: o.user ? {
        id: o.user.id,
        telegramId: o.user.telegramId,
        username: o.user.username,
        firstName: o.user.firstName,
      } : null,
    }));

    return NextResponse.json({ orders: formatted, counts: statusCounts });
  } catch (e) {
    console.error("Orders fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

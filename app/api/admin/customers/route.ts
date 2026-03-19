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

  const search = request.nextUrl.searchParams.get("q") || "";

  try {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { telegramId: search },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { totalSpent: "desc" },
      take: 200,
      include: {
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const formatted = users.map((u) => ({
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
      orderCount: u._count.orders,
      lastOrderDate: u.orders[0]?.createdAt ?? null,
    }));

    return NextResponse.json(formatted);
  } catch (e) {
    console.error("Customers fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import { withErrorHandler } from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    return NextResponse.json({ orders: [] });
  }

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { userId: userDoc.id },
    orderBy: { createdAt: "desc" },
    select: {
      orderId: true,
      status: true,
      total: true,
      trackNumber: true,
      trackUrl: true,
      createdAt: true,
    },
    take: 50,
  });

  return NextResponse.json({ orders });
});

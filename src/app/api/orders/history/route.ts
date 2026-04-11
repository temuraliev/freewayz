import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { OrderEntity } from "@backend/entities/Order";
import { validateUserInitData } from "@backend/auth/validate-user";
import { withErrorHandler } from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    return NextResponse.json({ orders: [] });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const orderRepo = ds.getRepository(OrderEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await orderRepo.find({
    where: { userId: userDoc.id },
    order: { createdAt: "DESC" },
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

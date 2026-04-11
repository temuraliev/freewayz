import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  ApiError,
} from "@backend/middleware/with-error-handler";

const bodySchema = z.object({
  initData: z.string().min(1),
  referrerId: z.union([z.string(), z.number()]),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid referral payload");

  const userData = validateUserInitData(parsed.data.initData, req.headers.get("host"));
  if (!userData || !userData.id) throw new UnauthorizedError("Invalid auth");

  const telegramId = String(userData.id);
  const referrerId = String(parsed.data.referrerId);

  if (telegramId === referrerId) {
    throw new ApiError("Self-referral not allowed", 400, "SELF_REFERRAL");
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (user) {
    const hasOrders = await prisma.order.count({ where: { userId: user.id } });
    if (hasOrders > 0 || user.referredBy) {
      return NextResponse.json({
        success: true,
        message: "User already established or referred",
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { referredBy: referrerId },
    });
  } else {
    await prisma.user.create({
      data: {
        telegramId,
        firstName: userData.first_name,
        username: userData.username || null,
        referredBy: referrerId,
      },
    });
  }

  return NextResponse.json({ success: true });
});

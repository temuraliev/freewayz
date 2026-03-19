import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateUserInitData } from "@/lib/validate-user";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { initData, referrerId } = body;

    if (!initData || !referrerId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const host = req.headers.get("host");
    const userData = validateUserInitData(initData, host);
    if (!userData || !userData.id) {
      return NextResponse.json({ error: "Invalid auth" }, { status: 401 });
    }

    const telegramId = userData.id.toString();

    if (telegramId === referrerId.toString()) {
      return NextResponse.json({ error: "Self-referral not allowed" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (user) {
      const hasOrders = await prisma.order.count({ where: { userId: user.id } });
      if (hasOrders > 0 || user.referredBy) {
        return NextResponse.json({ success: true, message: "User already established or referred" });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { referredBy: referrerId.toString() },
      });
    } else {
      await prisma.user.create({
        data: {
          telegramId,
          firstName: userData.first_name,
          username: userData.username || null,
          referredBy: referrerId.toString(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Referral API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

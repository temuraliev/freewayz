import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateUserInitData } from "@/lib/validate-user";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { initData, cartItems } = body;

    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 });
    }

    const host = req.headers.get("host");
    const userData = validateUserInitData(initData, host);
    if (!userData || !userData.id) {
      return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
    }

    const telegramId = userData.id.toString();

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: true, message: "User not found, skipping sync" });
    }

    const cartItemsStr = cartItems && cartItems.length > 0 ? JSON.stringify(cartItems) : null;
    const cartUpdatedAt = cartItems && cartItems.length > 0 ? new Date() : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        cartItems: cartItemsStr,
        cartUpdatedAt,
        abandonedCartNotified: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart Sync API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

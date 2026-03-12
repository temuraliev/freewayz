import { NextResponse } from "next/server";
import { client } from "@/lib/sanity/client";
import { validateUserInitData } from "@/lib/validate-user";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { initData, cartItems } = body;

    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 });
    }

    // Validate Telegram User
    const host = req.headers.get("host");
    const userData = validateUserInitData(initData, host);
    if (!userData || !userData.id) {
      return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
    }

    const telegramId = userData.id.toString();

    // Find the user in Sanity
    const query = `*[_type == "user" && telegramId == $telegramId][0]`;
    const user = await client.fetch(query, { telegramId });

    if (!user) {
      // If user doesn't exist yet, do nothing — their first sync happens during checkout or explicit login
      return NextResponse.json({ success: true, message: "User not found, skipping sync" });
    }

    // Stringify the cart items (so we don't have to deal with nested Sanity schema for cart)
    const cartItemsStr = (cartItems && cartItems.length > 0) ? JSON.stringify(cartItems) : null;
    const cartUpdatedAt = (cartItems && cartItems.length > 0) ? new Date().toISOString() : null;

    // Patch the user document
    await client
      .patch(user._id)
      .set({
        cartItems: cartItemsStr,
        cartUpdatedAt: cartUpdatedAt,
        abandonedCartNotified: false // Reset notification flag because cart was modified
      })
      .commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart Sync API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { client } from "@/lib/sanity/client";
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
    
    // Prevent self-referral
    if (telegramId === referrerId.toString()) {
      return NextResponse.json({ error: "Self-referral not allowed" }, { status: 400 });
    }

    // Check if user already exists and if they already have a referrer
    const query = `*[_type == "user" && telegramId == $telegramId][0]`;
    const user = await client.fetch(query, { telegramId });

    if (user) {
      // If user exists, check if they already have orders or a referrer
      const hasOrders = user.orders && user.orders.length > 0;
      if (hasOrders || user.referredBy) {
        return NextResponse.json({ success: true, message: "User already established or referred" });
      }

      // Update existing user with referrer
      await client.patch(user._id).set({ referredBy: referrerId.toString() }).commit();
    } else {
      // User doesn't exist in Sanity yet. Note: Usually user doc is created on first interaction.
      // We can create it now with the referrer info.
      await client.create({
        _type: "user",
        telegramId: telegramId,
        firstName: userData.first_name,
        username: userData.username,
        referredBy: referrerId.toString(),
        totalSpent: 0,
        cashbackBalance: 0,
        status: "ROOKIE"
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Referral API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

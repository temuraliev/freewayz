import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@sanity/client";
import { validateUserInitData } from "@/lib/validate-user";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const telegramId = String(user.id);

  try {
    let userDoc = await prisma.user.findUnique({ where: { telegramId } });

    if (!userDoc) {
      // Auto-create on first visit
      userDoc = await prisma.user.create({
        data: {
          telegramId,
          firstName: user.first_name,
          username: user.username || null,
          photoUrl: user.photo_url || null,
        },
      });
    }

    // Resolve preferred brands/styles from Sanity for UI display
    let preferredBrands: { _id: string; title: string; slug: { current: string } }[] = [];
    let preferredStyles: { _id: string; title: string; slug: { current: string } }[] = [];

    if (userDoc.preferredBrandIds?.length > 0) {
      const brands = await sanity.fetch<{ _id: string; title: string; slug: { current: string } }[]>(
        `*[_type == "brand" && _id in $ids] { _id, title, slug }`,
        { ids: userDoc.preferredBrandIds }
      ).catch(() => []);
      preferredBrands = brands;
    }

    if (userDoc.preferredStyleIds?.length > 0) {
      const styles = await sanity.fetch<{ _id: string; title: string; slug: { current: string } }[]>(
        `*[_type == "style" && _id in $ids] { _id, title, slug }`,
        { ids: userDoc.preferredStyleIds }
      ).catch(() => []);
      preferredStyles = styles;
    }

    // Return in a compatible format for the frontend User type
    return NextResponse.json({
      _id: String(userDoc.id),
      telegramId: userDoc.telegramId,
      username: userDoc.username,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      photoUrl: userDoc.photoUrl,
      totalSpent: userDoc.totalSpent,
      status: userDoc.status,
      cashbackBalance: userDoc.cashbackBalance,
      onboardingDone: userDoc.onboardingDone,
      preferredBrands,
      preferredStyles,
    });
  } catch (e) {
    console.error("User fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

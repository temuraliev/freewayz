import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateUserInitData } from "@/lib/validate-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, brandIds, styleIds } = body as {
      initData?: string;
      brandIds?: string[];
      styleIds?: string[];
    };

    const user = validateUserInitData(
      initData ?? "",
      request.headers.get("host")
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const telegramId = String(user.id);

    const userDoc = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: userDoc.id },
      data: {
        preferredBrandIds: Array.isArray(brandIds) ? brandIds.filter(Boolean) : [],
        preferredStyleIds: Array.isArray(styleIds) ? styleIds.filter(Boolean) : [],
        onboardingDone: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("preferences error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

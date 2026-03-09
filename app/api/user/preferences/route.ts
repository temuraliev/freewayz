import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateUserInitData } from "@/lib/validate-user";

const sanityWrite = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

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

    const userDoc = await sanityWrite.fetch<{ _id: string } | null>(
      `*[_type == "user" && telegramId == $telegramId][0]{ _id }`,
      { telegramId }
    );

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const brandRefs = (brandIds || []).map((id) => ({
      _type: "reference" as const,
      _ref: id,
      _key: id,
    }));

    const styleRefs = (styleIds || []).map((id) => ({
      _type: "reference" as const,
      _ref: id,
      _key: id,
    }));

    await sanityWrite
      .patch(userDoc._id)
      .set({
        preferredBrands: brandRefs,
        preferredStyles: styleRefs,
        onboardingDone: true,
      })
      .commit();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("preferences error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

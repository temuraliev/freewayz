import { NextRequest, NextResponse } from "next/server";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

const bodySchema = z.object({ initData: z.string().min(1) });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  const result = validateAdminInitData(parsed.data.initData);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Unauthorized", reason: result.reason },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, user: result.user });
}

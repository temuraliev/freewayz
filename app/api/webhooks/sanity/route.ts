import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
import { prisma } from "@backend/db";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";

/**
 * Sanity webhook receiver — cleans up orphaned references in PostgreSQL
 * when brands/styles/products are deleted in Sanity Studio.
 *
 * Setup in Sanity:
 *   1. https://www.sanity.io/manage/personal/project/<id>/api/webhooks
 *   2. Add new GROQ-powered webhook
 *   3. URL: https://your-domain.vercel.app/api/webhooks/sanity
 *   4. Trigger on: Delete (and Update if you want richer sync)
 *   5. Filter: _type in ["brand", "style", "product"]
 *   6. Projection: {_id, _type, "deleted": delta::isDeleted()}
 *   7. Secret: set SANITY_WEBHOOK_SECRET env var to the same value
 */

interface SanityWebhookPayload {
  _id: string;
  _type: string;
  deleted?: boolean;
}

async function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  // Sanity uses sha256 HMAC
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`sha256=${expected}`))
      || crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const rawBody = await request.text();
  const secret = process.env.SANITY_WEBHOOK_SECRET;

  if (secret) {
    const sig =
      request.headers.get("sanity-webhook-signature") ||
      request.headers.get("x-sanity-signature");
    const ok = await verifySignature(rawBody, sig, secret);
    if (!ok) throw new UnauthorizedError("Invalid signature");
  }

  let payload: SanityWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { _id, _type, deleted } = payload;
  if (!_id || !_type) {
    return NextResponse.json({ ok: false, error: "Missing _id/_type" }, { status: 400 });
  }

  // Strip drafts.* prefix when comparing
  const cleanId = _id.replace(/^drafts\./, "");

  let deletedCount = 0;

  if (deleted) {
    if (_type === "brand" || _type === "style") {
      // Remove from UserPreference (normalized)
      const result = await prisma.userPreference.deleteMany({
        where: { externalId: cleanId, preferenceType: _type as "brand" | "style" },
      });
      deletedCount += result.count;

      // Also remove from legacy fields (until migration is finalized)
      if (_type === "brand") {
        const users = await prisma.user.findMany({
          where: { preferredBrandIds: { has: cleanId } },
          select: { id: true, preferredBrandIds: true },
        });
        for (const u of users) {
          await prisma.user.update({
            where: { id: u.id },
            data: { preferredBrandIds: u.preferredBrandIds.filter((id) => id !== cleanId) },
          });
        }
        deletedCount += users.length;
      } else {
        const users = await prisma.user.findMany({
          where: { preferredStyleIds: { has: cleanId } },
          select: { id: true, preferredStyleIds: true },
        });
        for (const u of users) {
          await prisma.user.update({
            where: { id: u.id },
            data: { preferredStyleIds: u.preferredStyleIds.filter((id) => id !== cleanId) },
          });
        }
        deletedCount += users.length;
      }
    } else if (_type === "product") {
      // Remove from cart and wishlist
      const cart = await prisma.cartItem.deleteMany({ where: { productId: cleanId } });
      const wish = await prisma.wishlistItem.deleteMany({ where: { productId: cleanId } });
      deletedCount += cart.count + wish.count;
    }
  }

  return NextResponse.json({ ok: true, type: _type, id: cleanId, deletedCount });
});

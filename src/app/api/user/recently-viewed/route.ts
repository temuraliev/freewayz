import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { ProductViewEntity } from "@backend/entities/ProductView";
import { validateUserInitData } from "@backend/auth/validate-user";
import { withErrorHandler } from "@backend/middleware/with-error-handler";
import { findByIds } from "@backend/repositories/product-repository";

const LIMIT = 12;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    return NextResponse.json({ products: [] });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const viewRepo = ds.getRepository(ProductViewEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ products: [] });
  }

  // Get distinct most recent product IDs using QueryBuilder for DISTINCT
  const views = await viewRepo
    .createQueryBuilder("v")
    .select("DISTINCT v.productId", "productId")
    .where("v.userId = :userId", { userId: userDoc.id })
    .orderBy("MAX(v.viewedAt)", "DESC")
    .groupBy("v.productId")
    .limit(LIMIT)
    .getRawMany();

  const ids = views.map((v: { productId: string }) => Number(v.productId)).filter((n: number) => !isNaN(n));
  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await findByIds(ids);

  // Preserve view order
  const productMap = new Map<number, unknown>();
  for (const p of products) {
    productMap.set(Number(p._id), p);
  }
  const ordered = ids.map((id: number) => productMap.get(id)).filter(Boolean);

  return NextResponse.json({ products: ordered });
});

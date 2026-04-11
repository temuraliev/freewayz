import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { OrderEntity } from "@backend/entities/Order";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual } from "typeorm";

/**
 * GET /api/admin/orders/export[?status=&from=&to=]
 * Returns CSV with all orders matching filters.
 * Not wrapped in withErrorHandler -- returns raw Response (CSV), not JSON.
 */

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString();
}

export async function GET(request: NextRequest) {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "";
  const from = params.get("from");
  const to = params.get("to");

  const ds = await getDataSource();
  const orderRepo = ds.getRepository(OrderEntity);

  const where: FindOptionsWhere<OrderEntity> = {};

  if (status && status !== "all") {
    where.status = status as OrderEntity["status"];
  }
  if (from) {
    where.createdAt = MoreThanOrEqual(new Date(from));
  }
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    // If both from and to, we need a query builder for range
    if (from) {
      // Use query builder for date range
      const qb = orderRepo
        .createQueryBuilder("o")
        .leftJoinAndSelect("o.user", "u")
        .where("o.createdAt >= :from", { from: new Date(from) })
        .andWhere("o.createdAt <= :to", { to: toEnd })
        .orderBy("o.createdAt", "DESC")
        .take(10000);

      if (status && status !== "all") {
        qb.andWhere("o.status = :status", { status });
      }

      const orders = await qb.getMany();
      return buildCsvResponse(orders);
    }
    where.createdAt = LessThanOrEqual(toEnd);
  }

  const orders = await orderRepo.find({
    where,
    order: { createdAt: "DESC" },
    relations: ["user"],
    take: 10000,
  });

  return buildCsvResponse(orders);
}

function buildCsvResponse(orders: OrderEntity[]) {
  const headers = [
    "Order ID",
    "Status",
    "Created",
    "Customer Username",
    "Customer Name",
    "Telegram ID",
    "Item Count",
    "Total (UZS)",
    "Cost (UZS)",
    "Track Number",
    "Tracking Status",
    "Notes",
  ];

  const rows = orders.map((o) => {
    const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
    return [
      o.orderId,
      o.status,
      formatDate(o.createdAt),
      o.user?.username ?? "",
      o.user?.firstName ?? "",
      o.user?.telegramId ?? "",
      items.length,
      o.total,
      o.cost ?? "",
      o.trackNumber ?? "",
      o.trackingStatus ?? "",
      (o.notes ?? "").replace(/\r?\n/g, " "),
    ]
      .map(csvEscape)
      .join(",");
  });

  // BOM for Excel compatibility with UTF-8
  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");

  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

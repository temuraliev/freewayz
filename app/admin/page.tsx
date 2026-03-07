"use client";

import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Дашборд</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/orders"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Заказы</h3>
          <p className="mt-1 text-sm text-muted-foreground">Трекинг посылок и статусы</p>
        </Link>
        <Link
          href="/admin/suppliers"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Поставщики Yupoo</h3>
          <p className="mt-1 text-sm text-muted-foreground">Мониторинг каталогов</p>
        </Link>
        <Link
          href="/admin/finance"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Финансы</h3>
          <p className="mt-1 text-sm text-muted-foreground">Учёт и отчёты</p>
        </Link>
        <Link
          href="/"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Каталог</h3>
          <p className="mt-1 text-sm text-muted-foreground">Редактирование товаров</p>
        </Link>
      </div>
    </div>
  );
}

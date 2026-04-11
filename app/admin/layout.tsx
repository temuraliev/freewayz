"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminStore } from "@frontend/stores";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) return;
    if (isAdmin === false) {
      router.replace("/admin/login");
    }
  }, [isAdmin, isLoginRoute, router]);

  // Allow /admin/login to render even when not admin
  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (isAdmin !== true) {
    return null;
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Admin</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              Дашборд
            </Link>
            <Link href="/admin/orders" className="text-muted-foreground hover:text-foreground">
              Заказы
            </Link>
            <Link href="/admin/customers" className="text-muted-foreground hover:text-foreground">
              Клиенты
            </Link>
            <Link href="/admin/promo" className="text-muted-foreground hover:text-foreground">
              Промо
            </Link>
            <Link href="/admin/suppliers" className="text-muted-foreground hover:text-foreground">
              Поставщики
            </Link>
            <Link href="/admin/finance" className="text-muted-foreground hover:text-foreground">
              Финансы
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Каталог
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

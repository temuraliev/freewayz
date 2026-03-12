"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminStore } from "@/lib/store";

export default function AdminLoginPage() {
  const router = useRouter();
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const setAdmin = useAdminStore((s) => s.setAdmin);

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin === true) router.replace("/admin");
  }, [isAdmin, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setAdmin(false);
        setError("Неверный пароль");
        return;
      }
      setAdmin(true);
      router.replace("/admin");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-lg font-semibold">Admin Login</div>
          <div className="text-sm text-muted-foreground">Вход в админ-панель из браузера</div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Пароль</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <button
            type="submit"
            disabled={loading || password.trim().length === 0}
            className="h-11 w-full rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}


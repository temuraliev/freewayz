"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Star, Flame, Gift, TrendingUp, Tag, Loader2, Check, Heart, Share2, Package, Settings } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

import { useUserStore, useWishlistStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { formatPrice, getStatusProgress, getUserStatusEmoji } from "@/lib/utils";
import { ymTrack } from "@/components/providers/yandex-metrica";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { getOrderHistory, applyPromo, ApiClientError } from "@/lib/api-client";

export default function ProfilePage() {
  const router = useRouter();
  const { telegramUser, user, getDisplayName, setUser } = useUserStore();

  const status = user?.status || "ROOKIE";
  const totalSpent = user?.totalSpent || 0;
  const cashback = user?.cashbackBalance || 0;
  const { current, next, progress, remaining } = getStatusProgress(totalSpent);

  const getStatusIcon = () => {
    switch (status) {
      case "LEGEND":
        return <Crown className="h-8 w-8 text-white" />;
      case "PRO":
        return <Star className="h-8 w-8 text-white" />;
      default:
        return <Flame className="h-8 w-8 text-white" />;
    }
  };

  const getStatusGradient = () => {
    switch (status) {
      case "LEGEND":
        return "from-purple-600 via-pink-500 to-red-500";
      case "PRO":
        return "from-amber-500 to-amber-600";
      default:
        return "from-zinc-600 to-zinc-700";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/80 px-4 py-4 backdrop-blur-md">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-headline text-lg uppercase tracking-widest">{ru.profile}</h1>
        <div className="w-10" />
      </div>

      <main className="flex-1 space-y-6 px-4 py-6">
        {/* User Info Card */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card to-background p-6"
        >
          <div className="relative z-10 flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-primary/20 bg-secondary p-0.5">
                {telegramUser?.photo_url ? (
                  <img
                    src={telegramUser.photo_url}
                    alt={telegramUser.first_name || "User"}
                    className="h-full w-full rounded-[14px] object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-primary/10 text-2xl font-bold text-primary">
                    {telegramUser?.first_name?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-xs shadow-lg">
                {getUserStatusEmoji(current)}
              </div>
            </div>
            <div>
              <h2 className="font-headline text-xl tracking-tight">
                {telegramUser?.first_name} {telegramUser?.last_name || ""}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase opacity-70">
                  {current} STATUS
                </span>
                <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs font-medium text-green-500">
                  {cashback.toLocaleString()} UZS кэшбэк
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-tighter">
              <span className="text-muted-foreground">{ru.progressTo} {next || "MAX"}</span>
              <span className="text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50 p-[1px]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]"
              />
            </div>
            {remaining > 0 ? (
              <p className="text-[11px] text-muted-foreground leading-tight">
                {/* @ts-ignore - added translation keys dynamically */}
                {ru.leftToSpend} <b>{formatPrice(remaining)}</b> {/* @ts-ignore */} {ru.forStatus} <b>{next}</b>
              </p>
            ) : (
              <p className="text-[11px] text-green-500 leading-tight">
                {/* @ts-ignore */}
                {ru.maxStatusReached}
              </p>
            )}
          </div>
        </motion.section>

        {/* Status Tier Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl bg-gradient-to-r ${getStatusGradient()} p-6 text-white shadow-xl`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">{ru.currentStatus}</p>
              <h3 className="mt-1 text-2xl font-bold flex items-center gap-2 uppercase tracking-wide">
                {status === "LEGEND" ? ru.statusLegend : status === "PRO" ? ru.statusPro : ru.statusRookie}
              </h3>
              <p className="mt-1 text-xs opacity-70">
                {status === "LEGEND" ? "Скидка 10% на всё" : status === "PRO" ? "Скидка 5% на всё" : "Копите покупки для скидок"}
              </p>
            </div>
            {getStatusIcon()}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/5 bg-card p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wider">{ru.totalSpent}</span>
            </div>
            <p className="mt-2 font-mono text-xl font-bold">
              {formatPrice(totalSpent)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/5 bg-card p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wider">{ru.cashback}</span>
            </div>
            <p className="mt-2 font-mono text-xl font-bold text-green-500">
              {formatPrice(cashback)}
            </p>
          </motion.div>
        </div>

        {/* Order History */}
        <OrderHistorySection telegramId={telegramUser?.id} />

        {/* Promo Code Section */}
        <PromoSection user={user} setUser={setUser} />

        {/* Referral Section */}
        <ReferralSection telegramId={telegramUser?.id} />

        {/* Wishlist Section */}
        <WishlistSection />

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            href="/onboarding"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-4 transition hover:bg-muted/50"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Изменить предпочтения</p>
              <p className="text-[11px] text-muted-foreground">Выбрать любимые бренды и стили</p>
            </div>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}

function OrderHistorySection({ telegramId }: { telegramId?: number }) {
  const [orders, setOrders] = useState<
    { orderId: string; status: string; total: number; createdAt: string; trackUrl?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!telegramId) { setLoading(false); return; }
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";
    if (!initData) { setLoading(false); return; }

    getOrderHistory()
      .then((d) => setOrders((d.orders || []) as typeof orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [telegramId]);

  if (loading) return null;
  if (orders.length === 0) return null;

  const STATUS_LABELS: Record<string, string> = {
    new: "Новый", paid: "Оплачен", ordered: "Заказан",
    shipped: "В пути", delivered: "Доставлен", cancelled: "Отменён",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-white/10 bg-card p-6"
    >
      <h3 className="mb-3 flex items-center gap-2 font-headline text-sm uppercase tracking-wider text-muted-foreground">
        <Package className="h-4 w-4" />
        Мои заказы ({orders.length})
      </h3>
      <div className="space-y-2">
        {orders.slice(0, 5).map((o) => (
          <div key={o.orderId} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
            <div>
              <span className="font-mono text-sm font-medium">#{o.orderId}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(o.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{o.total.toLocaleString()} UZS</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] bg-secondary text-muted-foreground">
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
          </div>
        ))}
        {orders.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            и ещё {orders.length - 5} заказов
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ReferralSection({ telegramId }: { telegramId?: number }) {
  const [copied, setCopied] = useState(false);
  if (!telegramId) return null;

  const referralLink = `https://t.me/free_wayz_bot/shop?startapp=ref_${telegramId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    ymTrack("referral_link_copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.36 }}
      className="rounded-2xl border border-white/10 bg-card p-6"
    >
      <h3 className="mb-3 flex items-center gap-2 font-headline text-sm uppercase tracking-wider text-muted-foreground">
        <Share2 className="h-4 w-4" />
        Программа лояльности
      </h3>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        Пригласи друга и получи <b>50,000 UZS</b> на баланс после его первого заказа! Друг также получит бонус.
      </p>
      
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={referralLink}
          className="h-10 flex-1 rounded border border-white/5 bg-secondary px-3 text-[11px] outline-none text-muted-foreground"
        />
        <Button
          variant="secondary"
          size="sm"
          className="h-10 px-4"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : "Копировать"}
        </Button>
      </div>
    </motion.div>
  );
}

function WishlistSection() {
  const items = useWishlistStore((s) => s.items);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38 }}
      className="space-y-4 pt-4"
    >
      <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-wider text-foreground px-1">
        <Heart className="h-5 w-5" />
        Избранное ({items.length})
      </h3>
      
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((product, i) => (
          <ProductCard key={product._id} product={product} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

function PromoSection({
  user,
  setUser,
}: {
  user: User | null;
  setUser: (user: User | null) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleApply = async () => {
    const codeVal = code.trim();
    if (!codeVal) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    try {
      const data = await applyPromo(initData, codeVal, "profile");

      if (data.type === "balance_topup") {
        setSuccessMsg(
          `Баланс пополнен на ${formatPrice(data.value)}! Новый баланс: ${formatPrice(data.newBalance ?? 0)}`
        );
        if (user) {
          setUser({ ...user, cashbackBalance: data.newBalance ?? user.cashbackBalance });
        }
        setCode("");
      } else {
        setSuccessMsg(
          "Промокод сохранён! Примените его в корзине при оформлении заказа."
        );
        setCode("");
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message || "Ошибка");
      } else {
        setError("Ошибка сети");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-white/10 bg-card p-6"
    >
      <h3 className="mb-3 flex items-center gap-2 font-headline text-sm uppercase tracking-wider text-muted-foreground">
        <Tag className="h-4 w-4" />
        Промокод
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
            setSuccessMsg(null);
          }}
          placeholder="Введите промокод"
          className="h-10 flex-1 rounded border border-white/5 bg-secondary px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0"
          disabled={loading || !code.trim()}
          onClick={handleApply}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Активировать"
          )}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {successMsg && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-green-500">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </motion.div>
  );
}

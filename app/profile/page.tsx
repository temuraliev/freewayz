"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Star, Flame, Gift, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

import { useUserStore } from "@/lib/store";
import { formatPrice, getStatusProgress, getUserStatusEmoji } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

export default function ProfilePage() {
  const router = useRouter();
  const { telegramUser, user, getDisplayName, getStatusLabel } = useUserStore();

  const status = user?.status || "ROOKIE";
  const totalSpent = user?.totalSpent || 0;
  const cashback = user?.cashbackBalance || 0;
  const progress = getStatusProgress(totalSpent);

  const getStatusIcon = () => {
    switch (status) {
      case "LEGEND":
        return <Crown className="h-8 w-8" />;
      case "PRO":
        return <Star className="h-8 w-8" />;
      default:
        return <Flame className="h-8 w-8" />;
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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            {ru.back}
          </button>
          <h1 className="font-headline text-lg tracking-wider">{ru.profile}</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-2xl font-bold">
              {telegramUser?.first_name?.[0] || "G"}
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-bold">{getDisplayName() === "Guest" ? ru.guest : getDisplayName()}</h2>
              <p className="text-sm text-muted-foreground">
                {telegramUser
                  ? `@${telegramUser.username || "user"}`
                  : ru.guestUser}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl bg-gradient-to-r ${getStatusGradient()} p-6 text-white`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">{ru.currentStatus}</p>
              <h3 className="mt-1 text-3xl font-bold flex items-center gap-2">
                {getUserStatusEmoji(status)} {status === "LEGEND" ? ru.statusLegend : status === "PRO" ? ru.statusPro : ru.statusRookie}
              </h3>
            </div>
            {getStatusIcon()}
          </div>

          {/* Progress to next level */}
          {progress.next && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-80">{ru.progressTo} {progress.next === "PRO" ? ru.statusPro : ru.statusLegend}</span>
                <span className="font-mono font-bold">
                  {formatPrice(progress.remaining)} {ru.left}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-white"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">{ru.totalSpent}</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold">
              {formatPrice(totalSpent)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">{ru.cashback}</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-green-500">
              {formatPrice(cashback)}
            </p>
          </motion.div>
        </div>

        {/* Status Tiers Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h3 className="mb-4 font-headline text-sm uppercase tracking-wider text-muted-foreground">
            {ru.statusTiers}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                  <Flame className="h-4 w-4 text-zinc-300" />
                </div>
                <div>
                  <p className="font-medium">{ru.statusRookie}</p>
                  <p className="text-xs text-muted-foreground">{ru.tierRookieRange}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{ru.cashbackRookie}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">{ru.statusPro}</p>
                  <p className="text-xs text-muted-foreground">{ru.tierProRange}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{ru.cashbackPro}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-red-500">
                  <Crown className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">{ru.statusLegend}</p>
                  <p className="text-xs text-muted-foreground">{ru.tierLegendRange}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{ru.cashbackLegend}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

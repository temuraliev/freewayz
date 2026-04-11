import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function optimizeImage(url: string, _width: number = 800) {
  // Images are served from R2 and optimized by Next.js Image component
  return url || "";
}

/** Tiny 1x1 transparent SVG used as blur placeholder while images load */
export const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23111' width='1' height='1'/%3E%3C/svg%3E";

/** Uzbekistan so'm (UZS). Set NEXT_PUBLIC_PRICES_IN_USD=true if CMS stores prices in USD. */
const UZS_LOCALE = "ru-UZ";
const USD_TO_UZS = 12_500;

function toUzs(price: number): number {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PRICES_IN_USD === "true") {
    return price * USD_TO_UZS;
  }
  return price;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat(UZS_LOCALE, {
    style: "currency",
    currency: "UZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toUzs(price));
}

export function generateCheckoutMessage(
  username: string,
  items: Array<{
    brand: string;
    title: string;
    size: string;
    color?: string;
    price: number;
  }>,
  total: number
): string {
  const itemsList = items
    .map(
      (item, index) => {
        const colorPart = item.color ? `, ${item.color}` : "";
        return `${index + 1}. ${item.brand} ${item.title} — ${item.size}${colorPart} — ${formatPrice(item.price)}`;
      }
    )
    .join("\n");

  return `👋 New Order!

User: @${username}

Items:
${itemsList}

Total: ${formatPrice(total)}`;
}

export function getTelegramCheckoutUrl(message: string): string {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME || "timik_aliev";
  const adminUsername = raw.replace(/^@/, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://t.me/${adminUsername}?text=${encodedMessage}`;
}

export function getUserStatusEmoji(status: string): string {
  switch (status) {
    case "LEGEND":
      return "👑";
    case "PRO":
      return "⭐";
    case "ROOKIE":
    default:
      return "🔥";
  }
}

export function getStatusDiscount(status?: string): number {
  switch (status) {
    case "LEGEND":
      return 10;
    case "PRO":
      return 5;
    default:
      return 0;
  }
}

/** Status thresholds. Use USD if NEXT_PUBLIC_PRICES_IN_USD=true, else UZS (4M PRO, 7M LEGEND). */
const PRO_THRESHOLD_USD = 500;
const LEGEND_THRESHOLD_USD = 2000;
const PRO_THRESHOLD_UZS = 4_000_000;
const LEGEND_THRESHOLD_UZS = 7_000_000;

export function getStatusProgress(totalSpent: number): {
  current: string;
  next: string | null;
  progress: number;
  remaining: number;
} {
  const inUsd = typeof process !== "undefined" && process.env.NEXT_PUBLIC_PRICES_IN_USD === "true";
  const PRO_THRESHOLD = inUsd ? PRO_THRESHOLD_USD : PRO_THRESHOLD_UZS;
  const LEGEND_THRESHOLD = inUsd ? LEGEND_THRESHOLD_USD : LEGEND_THRESHOLD_UZS;

  if (totalSpent >= LEGEND_THRESHOLD) {
    return {
      current: "LEGEND",
      next: null,
      progress: 100,
      remaining: 0,
    };
  }

  if (totalSpent >= PRO_THRESHOLD) {
    return {
      current: "PRO",
      next: "LEGEND",
      progress: ((totalSpent - PRO_THRESHOLD) / (LEGEND_THRESHOLD - PRO_THRESHOLD)) * 100,
      remaining: LEGEND_THRESHOLD - totalSpent,
    };
  }

  return {
    current: "ROOKIE",
    next: "PRO",
    progress: (totalSpent / PRO_THRESHOLD) * 100,
    remaining: PRO_THRESHOLD - totalSpent,
  };
}

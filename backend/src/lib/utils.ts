/**
 * Shared utility functions used by backend routes.
 * NOTE: This contains only server-relevant utils. The frontend
 * keeps its own utils.ts with cn(), formatPrice(), etc.
 */

/** Uzbekistan so'm (UZS). Set PRICES_IN_USD=true if CMS stores prices in USD. */
const UZS_LOCALE = "ru-UZ";
const USD_TO_UZS = 12_500;

function toUzs(price: number): number {
  if (process.env.PRICES_IN_USD === "true" || process.env.NEXT_PUBLIC_PRICES_IN_USD === "true") {
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
  const raw = process.env.TELEGRAM_ADMIN_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME || "timik_aliev";
  const adminUsername = raw.replace(/^@/, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://t.me/${adminUsername}?text=${encodedMessage}`;
}

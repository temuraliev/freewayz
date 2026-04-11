import { z } from "zod";

export const searchQuerySchema = z
  .string()
  .trim()
  .max(100, "Search query too long")
  .transform((s) => s.replace(/<[^>]*>/g, ""));

export const checkoutItemSchema = z.object({
  brand: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  size: z.string().min(1).max(20),
  color: z.string().max(30).optional().default(""),
  price: z.number().nonnegative(),
});

export const checkoutSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((s) => s.replace(/<[^>]*>/g, "")),
  items: z.array(checkoutItemSchema).min(1, "Cart cannot be empty"),
  total: z.number().nonnegative(),
});

export const telegramInitDataSchema = z.object({
  initData: z.string().min(1, "initData is required"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;

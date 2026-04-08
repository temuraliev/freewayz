import { describe, it, expect } from "vitest";
import {
  checkoutSchema,
  searchQuerySchema,
  telegramInitDataSchema,
} from "@/lib/validations";

describe("checkoutSchema", () => {
  const validCheckout = {
    username: "ivan",
    items: [
      { brand: "Amiri", title: "Hoodie", size: "L", price: 1200000 },
    ],
    total: 1200000,
  };

  it("accepts valid checkout data", () => {
    const result = checkoutSchema.safeParse(validCheckout);
    expect(result.success).toBe(true);
  });

  it("rejects empty cart", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const bad = {
      ...validCheckout,
      items: [{ ...validCheckout.items[0], price: -1 }],
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("strips HTML from username", () => {
    const result = checkoutSchema.parse({
      ...validCheckout,
      username: "<b>ivan</b>",
    });
    expect(result.username).toBe("ivan");
  });

  it("rejects username that is too long", () => {
    const bad = { ...validCheckout, username: "a".repeat(100) };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("strips HTML", () => {
    expect(searchQuerySchema.parse("<b>hoodie</b>")).toBe("hoodie");
  });

  it("trims whitespace", () => {
    expect(searchQuerySchema.parse("  hoodie  ")).toBe("hoodie");
  });

  it("rejects queries longer than 100 chars", () => {
    expect(searchQuerySchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("telegramInitDataSchema", () => {
  it("accepts non-empty string", () => {
    expect(telegramInitDataSchema.safeParse({ initData: "abc" }).success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(telegramInitDataSchema.safeParse({ initData: "" }).success).toBe(false);
  });

  it("rejects missing field", () => {
    expect(telegramInitDataSchema.safeParse({}).success).toBe(false);
  });
});

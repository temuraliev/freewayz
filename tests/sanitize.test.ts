import { describe, it, expect } from "vitest";
import { sanitizeInput, sanitizeObject } from "@backend/security/sanitize";

describe("sanitizeInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeInput("<script>alert('xss')</script>hello")).toBe("alert('xss')hello");
  });

  it("removes stray angle brackets", () => {
    expect(sanitizeInput("a < b > c")).toBe("a  b  c");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("preserves Cyrillic and special chars", () => {
    expect(sanitizeInput("Привет, мир! 123")).toBe("Привет, мир! 123");
  });

  it("handles empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });
});

describe("sanitizeObject", () => {
  it("sanitizes all string values", () => {
    const input = { name: "<b>Ivan</b>", age: 30, note: "<script>x</script>" };
    const result = sanitizeObject(input);
    expect(result).toEqual({ name: "Ivan", age: 30, note: "x" });
  });

  it("passes through non-string values unchanged", () => {
    const input = { items: [1, 2, 3], flag: true };
    expect(sanitizeObject(input)).toEqual(input);
  });
});

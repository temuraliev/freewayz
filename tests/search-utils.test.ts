import { describe, it, expect } from "vitest";
import { buildSearchTerms } from "@frontend/lib/search-utils";

describe("buildSearchTerms", () => {
  it("returns patterns for a simple Russian word", () => {
    const terms = buildSearchTerms("худи");
    expect(Array.isArray(terms)).toBe(true);
    expect(terms.length).toBeGreaterThan(0);
  });

  it("includes English synonym for футболка", () => {
    const terms = buildSearchTerms("футболка");
    const joined = terms.join(" ").toLowerCase();
    expect(joined).toMatch(/t-shirt|tee|tshirt/);
  });

  it("includes English synonym for худи", () => {
    const terms = buildSearchTerms("худи");
    const joined = terms.join(" ").toLowerCase();
    expect(joined).toMatch(/hoodie/);
  });

  it("returns empty for empty input", () => {
    expect(buildSearchTerms("").length).toBe(0);
  });

  it("handles multi-word input", () => {
    const terms = buildSearchTerms("черная футболка");
    expect(terms.length).toBeGreaterThan(0);
  });
});

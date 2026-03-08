/**
 * Normalize product subtype: "зип-худи" is deprecated, always store as "зипки".
 * Used by admin PATCH so manual edits never save "зип-худи".
 */
export function normalizeSubtype(subtype: string | null | undefined): string | null | undefined {
  if (subtype == null || typeof subtype !== "string") return subtype;
  const s = subtype.trim();
  const lower = s.toLowerCase();
  if (lower === "зип-худи" || lower === "зип худи" || lower === "зип-худі") return "зипки";
  return s || null;
}

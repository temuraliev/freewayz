export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key as keyof T];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    }
  }
  return result;
}

/**
 * Sanitize user input to prevent XSS / injection attacks.
 *
 * Strips all HTML tags and trims whitespace.
 * Use before rendering user-provided text or sending it to the backend.
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/<[^>]*>/g, "") // strip HTML tags
        .replace(/[<>]/g, "") // remove stray angle brackets
        .trim();
}

/**
 * Sanitize an object's string values recursively.
 * Non-string values are passed through unchanged.
 */
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

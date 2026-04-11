import { createClient } from "@sanity/client";

export function getSanityClient(options?: { useCdn?: boolean; withToken?: boolean }) {
  const token = options?.withToken ? process.env.SANITY_API_TOKEN : undefined;
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: options?.useCdn ?? true,
    ...(token ? { token } : {}),
  });
}

/** Read-only Sanity client (CDN) */
export const sanityClient = getSanityClient({ useCdn: true });

/** Sanity client with write token */
export const sanityWriteClient = getSanityClient({ useCdn: false, withToken: true });

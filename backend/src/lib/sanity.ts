import { createClient, type SanityClient } from "@sanity/client";

let _readClient: SanityClient | null = null;
let _writeClient: SanityClient | null = null;

export function getSanityClient(options?: { useCdn?: boolean; withToken?: boolean }): SanityClient {
  const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) throw new Error("SANITY_PROJECT_ID is not set");

  const token = options?.withToken ? process.env.SANITY_API_TOKEN : undefined;
  return createClient({
    projectId,
    dataset: process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: options?.useCdn ?? true,
    ...(token ? { token } : {}),
  });
}

/** Read-only Sanity client (CDN) — lazy singleton */
export function sanityClient(): SanityClient {
  if (!_readClient) _readClient = getSanityClient({ useCdn: true });
  return _readClient;
}

/** Sanity client with write token — lazy singleton */
export function sanityWriteClient(): SanityClient {
  if (!_writeClient) _writeClient = getSanityClient({ useCdn: false, withToken: true });
  return _writeClient;
}

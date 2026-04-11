import "server-only";

import { createClient } from "@sanity/client";

const rawProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";

function isValidSanityProjectId(id: string) {
  return /^[a-z0-9-]+$/.test(id);
}

const projectId = isValidSanityProjectId(rawProjectId)
  ? rawProjectId
  : "missing-project-id";

/**
 * Sanity client with write token — SERVER-ONLY.
 * Importing this file in a "use client" module will cause a build error.
 */
export const writeClient = createClient({
  projectId,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import { SanityImageSource } from "@sanity/image-url/lib/types/types";

function isValidSanityProjectId(id: string) {
  // Sanity projectId: lowercase letters, numbers, dashes
  return /^[a-z0-9-]+$/.test(id);
}

const rawProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const projectId = isValidSanityProjectId(rawProjectId)
  ? rawProjectId
  : "missing-project-id";

if (rawProjectId && projectId !== rawProjectId) {
  // Avoid crashing the app when env is placeholder like "your_project_id"
  console.warn(
    `[FreeWayz] Invalid NEXT_PUBLIC_SANITY_PROJECT_ID="${rawProjectId}". ` +
    `Using "${projectId}" so the app can boot with mock data.`
  );
}

export const client = createClient({
  projectId,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

// For mutations (creating/updating users) use:
// import { writeClient } from "@/lib/sanity/server-only-client";
// ↑ server-only — will error at build time if imported in a "use client" module.

const builder = imageUrlBuilder(client);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

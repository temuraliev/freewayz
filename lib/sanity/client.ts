import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import { SanityImageSource } from "@sanity/image-url/lib/types/types";

function isValidSanityProjectId(id: string) {
  return /^[a-z0-9-]+$/.test(id);
}

const rawProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const projectId = isValidSanityProjectId(rawProjectId)
  ? rawProjectId
  : "missing-project-id";

if (rawProjectId && projectId !== rawProjectId) {
  console.warn(
    `[FreeWayz] Invalid NEXT_PUBLIC_SANITY_PROJECT_ID="${rawProjectId}". ` +
    `Using "${projectId}" so the app can boot with mock data.`
  );
}

export const client = createClient({
  projectId,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  // CDN enabled for faster reads. ISR handles freshness at Next.js level.
  useCdn: true,
});

const builder = imageUrlBuilder(client);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

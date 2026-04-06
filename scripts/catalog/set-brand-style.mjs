#!/usr/bin/env node
/**
 * Set style "graphic" for all products of brand "sp5der".
 * Usage: node --env-file=.env.local scripts/set-brand-style.mjs [brandSlug] [styleSlug]
 * Default: brandSlug=sp5der, styleSlug=graphic
 */
import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(PROJECT_ROOT, ".env.local");
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          )
            value = value.slice(1, -1);
          process.env[key] = value.replace(/\r$/, "").trim();
        }
      }
    }
  } catch (_) {}
}

loadEnvLocal();

const token = (process.env.SANITY_API_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

if (!token || !projectId) {
  console.error("Set SANITY_API_TOKEN and NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  useCdn: false,
  token,
});

const brandSlug = process.argv[2] || "sp5der";
const styleSlug = process.argv[3] || "graphic";

async function run() {
  console.log(`Brand slug: "${brandSlug}", style slug: "${styleSlug}"`);

  const brand = await client.fetch(
    `*[_type == "brand" && slug.current == $slug][0]{ _id, title }`,
    { slug: brandSlug }
  );
  if (!brand) {
    console.error(`Brand with slug "${brandSlug}" not found.`);
    process.exit(1);
  }
  console.log(`Brand: ${brand.title} (${brand._id})`);

  const style = await client.fetch(
    `*[_type == "style" && slug.current == $slug][0]{ _id, title }`,
    { slug: styleSlug }
  );
  if (!style) {
    console.error(`Style with slug "${styleSlug}" not found.`);
    process.exit(1);
  }
  console.log(`Style: ${style.title} (${style._id})`);

  const products = await client.fetch(
    `*[_type == "product" && brand._ref == $brandId]{ _id, title, "currentStyle": style->slug.current }`,
    { brandId: brand._id }
  );

  const draftProducts = await client.fetch(
    `*[_type == "product" && _id in path("drafts.**") && brand._ref == $brandId]{ _id, title }`,
    { brandId: brand._id }
  );

  const allProducts = [...products, ...draftProducts];

  if (allProducts.length === 0) {
    console.log("No products found for this brand.");
    return;
  }
  console.log(`Found ${allProducts.length} product(s). Updating style to "${style.title}"...`);

  let updated = 0;
  for (const p of allProducts) {
    try {
      await client.patch(p._id).set({ style: { _type: "reference", _ref: style._id } }).commit();
      updated++;
      console.log(`  ✅ ${p.title}`);
    } catch (e) {
      console.error(`  ❌ ${p.title}: ${e.message}`);
    }
  }
  console.log(`\nDone. Updated ${updated}/${allProducts.length} products.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

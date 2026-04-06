#!/usr/bin/env node
/**
 * Set style for all products of specific brands (one-off batch).
 * - derschutze -> art
 * - mertra -> uk-trap
 * - broken planet -> graphic
 *
 * Usage: node scripts/set-styles-by-brand-batch.mjs
 * Requires .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, SANITY_API_TOKEN
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

const MAPPINGS = [
  { brandSlug: "derschutze", styleSlug: "art" },
  { brandSlug: "mertra", styleSlug: "uk-trap" },
  { brandSlug: "broken-planet", styleSlug: "graphic" },
];

async function run() {
  const styleIds = {};
  for (const { styleSlug } of MAPPINGS) {
    if (styleIds[styleSlug]) continue;
    const style = await client.fetch(
      `*[_type == "style" && slug.current == $slug][0]{ _id, title }`,
      { slug: styleSlug }
    );
    if (!style) {
      console.error(`Style with slug "${styleSlug}" not found.`);
      process.exit(1);
    }
    styleIds[styleSlug] = style._id;
    console.log(`Style "${styleSlug}": ${style.title} (${style._id})`);
  }

  for (const { brandSlug, styleSlug } of MAPPINGS) {
    console.log(`\n--- ${brandSlug} -> ${styleSlug} ---`);

    const brand = await client.fetch(
      `*[_type == "brand" && slug.current == $slug][0]{ _id, title }`,
      { slug: brandSlug }
    );
    if (!brand) {
      console.error(`Brand with slug "${brandSlug}" not found, skipping.`);
      continue;
    }
    console.log(`Brand: ${brand.title} (${brand._id})`);

    const products = await client.fetch(
      `*[_type == "product" && brand._ref == $brandId]{ _id, title }`,
      { brandId: brand._id }
    );
    const draftProducts = await client.fetch(
      `*[_type == "product" && _id in path("drafts.**") && brand._ref == $brandId]{ _id, title }`,
      { brandId: brand._id }
    );
    const allProducts = [...products, ...draftProducts];

    if (allProducts.length === 0) {
      console.log("  No products found.");
      continue;
    }
    console.log(`  Updating ${allProducts.length} product(s)...`);

    const styleRef = { _type: "reference", _ref: styleIds[styleSlug] };
    let updated = 0;
    for (const p of allProducts) {
      try {
        await client.patch(p._id).set({ style: styleRef }).commit();
        updated++;
        console.log(`  ✅ ${p.title}`);
      } catch (e) {
        console.error(`  ❌ ${p.title}: ${e.message}`);
      }
    }
    console.log(`  Done: ${updated}/${allProducts.length}`);
  }
  console.log("\nBatch complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

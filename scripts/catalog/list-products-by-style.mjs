/**
 * List products that have a given style (by slug).
 * Usage: node scripts/list-products-by-style.mjs [style-slug]
 * Example: node scripts/list-products-by-style.mjs archive
 *
 * Requires .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 */

import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

try {
  const content = readFileSync(join(PROJECT_ROOT, ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const eq = t.indexOf("=");
      if (eq > 0) {
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        process.env[t.slice(0, eq).trim()] = v.replace(/\r$/, "").trim();
      }
    }
  }
} catch {}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = (process.env.SANITY_API_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

if (!projectId || !token) {
  console.error("Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN in .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  useCdn: false,
  token,
});

const styleSlug = process.argv[2] || "archive";

const products = await client.fetch(
  `*[_type == "product" && style->slug.current == $styleSlug] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    tier,
    "brand": brand->title,
    "style": style->title
  }`,
  { styleSlug }
);

console.log(`\nТовары со стилем "${styleSlug}": ${products.length}\n`);
if (products.length === 0) {
  console.log("(нет товаров)");
  process.exit(0);
}

products.forEach((p, i) => {
  console.log(`${i + 1}. ${p.title}`);
  console.log(`   slug: ${p.slug} | tier: ${p.tier ?? "—"} | brand: ${p.brand ?? "—"}`);
});
console.log("");

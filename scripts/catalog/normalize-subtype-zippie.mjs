#!/usr/bin/env node
/**
 * One-off: change all products with subtype "зип-худи" (any case) to "зипки".
 * Usage: node --env-file=.env.local scripts/normalize-subtype-zippie.mjs
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

const OLD_SUBTYPE = "зип-худи";
const NEW_SUBTYPE = "зипки";

function isZipHudi(subtype) {
  if (typeof subtype !== "string") return false;
  const n = subtype.trim().toLowerCase();
  return n === "зип-худи" || n === "зип худи" || n === "зип-худі";
}

async function run() {
  const products = await client.fetch(
    `*[_type == "product" && defined(subtype) && (subtype == "зип-худи" || subtype == "Зип-худи" || subtype == "ЗИП-ХУДИ" || subtype == "Зип-Худи" || subtype match "*зип*худи*")]{ _id, title, subtype }`
  );

  const toUpdate = products.filter((p) => isZipHudi(p.subtype));
  if (toUpdate.length === 0) {
    console.log(`No products with subtype "${OLD_SUBTYPE}" (or variants) found.`);
    return;
  }

  console.log(`Found ${toUpdate.length} product(s) with subtype "${OLD_SUBTYPE}". Changing to "${NEW_SUBTYPE}"...`);
  let updated = 0;
  for (const p of toUpdate) {
    try {
      await client.patch(p._id).set({ subtype: NEW_SUBTYPE }).commit();
      updated++;
      console.log(`  ✅ ${p.title} (was: ${p.subtype})`);
    } catch (e) {
      console.error(`  ❌ ${p.title}: ${e.message}`);
    }
  }
  console.log(`\nDone. Updated ${updated}/${toUpdate.length} products to subtype "${NEW_SUBTYPE}".`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

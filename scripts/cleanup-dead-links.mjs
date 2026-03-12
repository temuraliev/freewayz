import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
import pc from "picocolors";
import fetch from "node-fetch";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

try {
  const cont = readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8");
  cont
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .forEach((l) => {
      const eq = l.indexOf("=");
      if (eq > 0)
        process.env[l.slice(0, eq).trim()] = l
          .slice(eq + 1)
          .replace(/["']/g, "")
          .trim();
    });
} catch (e) {}

const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const SANITY_API_TOKEN = (process.env.SANITY_API_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

if (!SANITY_PROJECT_ID || !SANITY_API_TOKEN) {
  console.error(pc.red("Missing Sanity credentials in .env.local"));
  process.exit(1);
}

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: "2024-03-01",
  token: SANITY_API_TOKEN,
  useCdn: false,
});

async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD", // Use HEAD request to save bandwidth
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
    });

    if (response.status === 404) {
      return false; // Dead link
    }
    return true; // Any other response, assume alive to be safe
  } catch (error) {
    // Treat connection/timeout errors as temporary failures, not "dead" links
    console.warn(pc.yellow(`  ⚠️ [Network Error] ${error.message} for ${url}`));
    return null; // Null means we aren't sure, keep the product
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log(pc.cyan("=== Freewayz: Dead Link Cleanup ==="));
  if (isDryRun) {
    console.log(pc.yellow("MODE: Dry Run (No products will be deleted)"));
  } else {
    console.log(pc.red("MODE: LIVE (Dead products WILL be deleted)"));
  }

  // Fetch all products that have a sourceUrl
  console.log(pc.blue("\nFetching products from Sanity..."));
  const products = await client.fetch(
    `*[_type == "product" && defined(sourceUrl)]{ _id, title, sourceUrl, "brand": brand->title }`
  );

  console.log(pc.green(`Found ${products.length} products with source URLs.`));

  const deadProducts = [];
  let checked = 0;

  for (const product of products) {
    checked++;
    process.stdout.write(`\rChecking ${checked}/${products.length}...`);
    
    // Avoid rate limits on Yupoo
    await new Promise(r => setTimeout(r, 200)); 
    
    const isAlive = await checkUrl(product.sourceUrl);
    
    if (isAlive === false) {
      console.log(`\n  ${pc.red("✖ DEAD:")} [${product.brand || 'No Brand'}] ${product.title}`);
      console.log(`          ${pc.gray(product.sourceUrl)}`);
      deadProducts.push(product);
    }
  }

  console.log(pc.cyan(`\n\n=== Report ===`));
  console.log(`Total Checked: ${products.length}`);
  console.log(`Dead Links Found: ${pc.red(deadProducts.length)}`);

  if (deadProducts.length === 0) {
    console.log(pc.green("All product links are healthy!"));
    return;
  }

  if (isDryRun) {
    console.log(pc.yellow("\nSkipping deletion because --dry-run is enabled."));
  } else {
    console.log(pc.red(`\nDeleting ${deadProducts.length} dead products...`));
    let deleted = 0;
    for (const p of deadProducts) {
      try {
        await client.delete(p._id);
        deleted++;
      } catch (err) {
        console.error(pc.red(`Failed to delete ${p._id}: ${err.message}`));
      }
    }
    console.log(pc.green(`Successfully deleted ${deleted} products.`));
  }
}

main().catch(console.error);

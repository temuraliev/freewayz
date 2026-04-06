#!/usr/bin/env node
/**
 * One-time migration: set tier = "ultimate" on all existing products that lack a tier field.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-tier.mjs
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function loadEnvLocal() {
  try {
    const envPath = join(PROJECT_ROOT, '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
});

async function main() {
  const products = await client.fetch(
    `*[_type == "product" && !defined(tier)]{ _id }`
  );

  console.log(`Found ${products.length} products without a tier field.`);

  if (products.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let tx = client.transaction();
  for (const p of products) {
    tx = tx.patch(p._id, (patch) => patch.set({ tier: 'ultimate' }));
  }

  const result = await tx.commit();
  console.log(`Migration complete. Updated ${products.length} products to tier="ultimate".`);
  console.log(`Transaction ID: ${result.transactionId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

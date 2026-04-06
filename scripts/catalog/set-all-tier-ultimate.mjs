#!/usr/bin/env node
/**
 * Set tier = "ultimate" for ALL products.
 *
 * Usage:
 *   node --env-file=.env.local scripts/set-all-tier-ultimate.mjs
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
    `*[_type == "product"]{ _id, tier }`
  );

  console.log(`Found ${products.length} products.`);

  if (products.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const alreadyUltimate = products.filter((p) => p.tier === 'ultimate').length;
  const toUpdate = products.filter((p) => p.tier !== 'ultimate');

  if (toUpdate.length === 0) {
    console.log(`All ${products.length} products already have tier "ultimate".`);
    return;
  }

  console.log(`${alreadyUltimate} already ultimate, updating ${toUpdate.length} to tier "ultimate"...`);

  // Sanity transactions have a limit; patch in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK);
    let tx = client.transaction();
    for (const p of chunk) {
      tx = tx.patch(p._id, (patch) => patch.set({ tier: 'ultimate' }));
    }
    await tx.commit();
    console.log(`  Updated ${Math.min(i + CHUNK, toUpdate.length)} / ${toUpdate.length}`);
  }

  console.log('Done. All products now have tier "ultimate".');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

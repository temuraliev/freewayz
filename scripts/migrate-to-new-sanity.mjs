#!/usr/bin/env node
/**
 * Migrate all Sanity documents except products and image assets to a new project.
 * Preserves _id so references (order→user, expense→order) stay valid.
 *
 * Prerequisites:
 *   In .env.local set:
 *   - Source (current/old): NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 *   - Target (new):        NEW_SANITY_PROJECT_ID, NEW_SANITY_DATASET, NEW_SANITY_API_TOKEN
 *
 * Brand logo and category image are not copied (no asset migration). After migration,
 * point the app to the new project (replace NEXT_PUBLIC_* and SANITY_API_TOKEN with new values).
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-to-new-sanity.mjs
 *   node --env-file=.env.local scripts/migrate-to-new-sanity.mjs --dry-run
 */

import { createClient } from '@sanity/client';

const dryRun = process.argv.includes('--dry-run');

const sourceProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const sourceDataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const sourceToken = process.env.SANITY_API_TOKEN;

const targetProjectId = process.env.NEW_SANITY_PROJECT_ID;
const targetDataset = process.env.NEW_SANITY_DATASET || 'production';
const targetToken = process.env.NEW_SANITY_API_TOKEN;

if (!sourceProjectId || !sourceToken) {
  console.error('Missing source: set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN');
  process.exit(1);
}
if (!targetProjectId || !targetToken) {
  console.error('Missing target: set NEW_SANITY_PROJECT_ID and NEW_SANITY_API_TOKEN in .env.local');
  process.exit(1);
}

const source = createClient({
  projectId: sourceProjectId,
  dataset: sourceDataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: sourceToken,
});

const target = createClient({
  projectId: targetProjectId,
  dataset: targetDataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: targetToken,
});

const TYPES_TO_MIGRATE = [
  'brand',
  'category',
  'style',
  'yupooSupplier',
  'user',
  'order',
  'expense',
  'promoCode',
];

/** Strip asset refs so we don't create broken references in target (assets not migrated) */
function stripAssetRefs(doc, type) {
  const out = { ...doc };
  if (type === 'brand' && out.logo) delete out.logo;
  if (type === 'category' && out.image) delete out.image;
  return out;
}

async function migrateType(type) {
  const docs = await source.fetch(`*[_type == $type]`, { type });
  if (!docs?.length) {
    console.log(`  ${type}: 0 documents`);
    return { count: 0, failed: 0 };
  }

  let ok = 0;
  let failed = 0;

  for (const doc of docs) {
    const id = doc._id;
    const payload = stripAssetRefs(
      { _id: id, _type: type, ...doc },
      type
    );
    delete payload._rev;
    delete payload._createdAt;
    delete payload._updatedAt;

    if (dryRun) {
      ok++;
      continue;
    }

    try {
      await target.createOrReplace(payload);
      ok++;
    } catch (e) {
      console.error(`    Failed ${id}: ${e?.message || e}`);
      failed++;
    }
  }

  console.log(`  ${type}: ${ok} migrated${failed ? `, ${failed} failed` : ''}`);
  return { count: ok, failed };
}

async function main() {
  console.log('Source:', sourceProjectId, sourceDataset);
  console.log('Target:', targetProjectId, targetDataset);
  if (dryRun) console.log('(dry-run: no writes)\n');
  else console.log('');

  let total = 0;
  let totalFailed = 0;

  for (const type of TYPES_TO_MIGRATE) {
    const { count, failed } = await migrateType(type);
    total += count;
    totalFailed += failed;
  }

  console.log('\nTotal:', total, 'documents migrated', totalFailed ? `, ${totalFailed} failed` : '');
  if (dryRun) console.log('Run without --dry-run to apply.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

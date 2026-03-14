#!/usr/bin/env node
/**
 * Delete only orphaned image assets (not referenced by any document).
 * Use when products were deleted but assets were left, to free quota.
 *
 * Usage:
 *   node --env-file=.env.local scripts/delete-orphan-assets.mjs
 *   node --env-file=.env.local scripts/delete-orphan-assets.mjs --confirm
 *
 * Without --confirm: dry-run, only prints how many would be deleted.
 */

import { createClient } from '@sanity/client';
import { createInterface } from 'readline';

const confirmed = process.argv.includes('--confirm');

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

const CONCURRENCY = 10;

async function askYesNo(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function runPool(items, concurrency, fn) {
  const executing = new Set();
  const results = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}

async function main() {
  console.log('Finding orphaned image assets (not referenced by any document)...');

  const orphans = await client.fetch(
    `*[_type == "sanity.imageAsset" && !defined(*[references(^._id)][0])]{ _id }`
  );

  const count = orphans?.length ?? 0;
  console.log(`Found ${count} orphaned image assets.`);

  if (count === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (!confirmed) {
    console.log('\nDry-run. Run with --confirm to actually delete.');
    console.log('Example: node --env-file=.env.local scripts/delete-orphan-assets.mjs --confirm');
    return;
  }

  const proceed = await askYesNo(
    `\nDelete ${count} orphaned assets? Type "yes" to confirm: `
  );
  if (!proceed) {
    console.log('Aborted.');
    return;
  }

  console.log(`\nDeleting (${CONCURRENCY} concurrent)...`);
  let done = 0;
  const results = await runPool(orphans, CONCURRENCY, async (o) => {
    try {
      await client.delete(o._id);
      if (++done % 200 === 0 || done === count) console.log(`  ... ${done}/${count}`);
      return 'ok';
    } catch {
      if (++done % 200 === 0 || done === count) console.log(`  ... ${done}/${count}`);
      return 'fail';
    }
  });

  const deleted = results.filter((r) => r === 'ok').length;
  const failed = results.filter((r) => r === 'fail').length;
  console.log(`\nDone. Deleted: ${deleted}, failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

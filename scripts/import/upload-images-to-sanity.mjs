#!/usr/bin/env node
/**
 * Upload all images from a folder to Sanity's asset library.
 *
 * Usage:
 *   node scripts/upload-images-to-sanity.mjs [folderPath]
 *
 * Default folder: D:\FreeWayz\Broken Planet\Zip_files
 *
 * Requires in .env.local (or environment):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN  (token with Editor rights from sanity.io/manage)
 */

import { createClient } from '@sanity/client';
import { createReadStream, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const DEFAULT_FOLDER = 'D:\\FreeWayz\\Broken Planet\\Zip_files';

function loadEnvLocal() {
  const path = join(PROJECT_ROOT, '.env.local');
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
          process.env[key] = value.replace(/\r$/, '').trim();
        }
      }
    }
  } catch (e) {
    // .env.local optional
  }
}

function getImageFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.error('Cannot read folder:', dir, e.message);
    return files;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      getImageFiles(full, files);
    } else if (ent.isFile() && IMAGE_EXT.has(extname(ent.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return map[ext] || 'application/octet-stream';
}

async function main() {
  loadEnvLocal();

  const folderPath = process.argv[2] || DEFAULT_FOLDER;
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || process.env.SANITY_AUTH_TOKEN || '').replace(/\r\n?|\n/g, '').trim();

  if (!projectId || projectId === 'missing-project-id') {
    console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local');
    process.exit(1);
  }
  if (!token) {
    console.error('Set SANITY_API_TOKEN in .env.local (create an API token at sanity.io/manage with Editor rights)');
    process.exit(1);
  }

  console.log('Using project:', projectId, 'dataset:', dataset);
  console.log('Token present:', token ? `yes (${token.length} chars)` : 'no');
  if (token.length < 20) {
    console.error('Token looks too short. Create a new API token at https://www.sanity.io/manage → your project → API → Tokens.');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  });

  // Preflight: verify token works before uploading (fail fast with clear error)
  try {
    await client.fetch('*[_type == "product"][0]{_id}');
  } catch (e) {
    const msg = e && (e.message || String(e));
    console.error('Token check failed:', msg);
    if (msg.includes('Unauthorized') || msg.includes('Session not found')) {
      console.error('\nYour token is not valid for API access.');
      console.error('1. Go to https://www.sanity.io/manage → your project → API → Tokens');
      console.error('2. Create a NEW token with Permission: **Editor** (not "Viewer" or "Media editor")');
      console.error('3. Copy it and set SANITY_API_TOKEN=<new token> in .env.local');
      console.error('4. If this token was "Media editor", it cannot upload via script — use Editor.');
    }
    process.exit(1);
  }

  const imageFiles = getImageFiles(folderPath);
  if (imageFiles.length === 0) {
    console.log('No image files found in', folderPath);
    console.log('Supported extensions:', [...IMAGE_EXT].join(', '));
    process.exit(0);
  }

  console.log('Uploading', imageFiles.length, 'images from', folderPath, '...\n');

  let ok = 0;
  let err = 0;
  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const name = basename(filePath);
    try {
      const stream = createReadStream(filePath);
      const asset = await client.assets.upload('image', stream, {
        filename: name,
        contentType: getContentType(filePath),
      });
      ok++;
      console.log(`[${i + 1}/${imageFiles.length}] ${name} -> ${asset._id}`);
    } catch (e) {
      err++;
      const msg = e && (e.message || String(e));
      console.error(`[${i + 1}/${imageFiles.length}] ${name} FAILED:`, msg);
      if (i === 0 && (msg.includes('Unauthorized') || msg.includes('Session not found'))) {
        console.error('\n  → Fix: Create an API token (not a browser session). Go to https://www.sanity.io/manage');
        console.error('    → Your project → API → Tokens → Add API token → Name it, set Permission to "Editor" → Copy.');
        console.error('    → In .env.local set: SANITY_API_TOKEN=<paste the token> (no quotes, no newline).');
      }
    }
  }

  console.log('\nDone. Uploaded:', ok, 'Failed:', err);
  console.log('Open Sanity Studio and assign these assets to products via the Images field.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

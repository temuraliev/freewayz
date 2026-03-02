#!/usr/bin/env node
/**
 * Verify that your Sanity API token works before running upload scripts.
 * Run: node scripts/check-sanity-token.mjs
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

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
  } catch (e) {}
}

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = (process.env.SANITY_API_TOKEN || process.env.SANITY_AUTH_TOKEN || '').replace(/\r\n?|\n/g, '').trim();

console.log('Project ID:', projectId || '(missing)');
console.log('Dataset:', dataset);
console.log('Token:', token ? `set (${token.length} chars, starts with ${token.slice(0, 4)}...)` : 'MISSING');
console.log('');

if (!projectId || projectId === 'missing-project-id') {
  console.error('Add NEXT_PUBLIC_SANITY_PROJECT_ID to .env.local');
  process.exit(1);
}

if (!token) {
  console.error('Add SANITY_API_TOKEN to .env.local');
  console.error('');
  console.error('Steps:');
  console.error('  1. Go to https://www.sanity.io/manage');
  console.error('  2. Open your project → API → Tokens → Add API token');
  console.error('  3. Name it (e.g. "Upload"), set Permission to "Editor"');
  console.error('  4. Copy the token and in .env.local add:');
  console.error('     SANITY_API_TOKEN=paste_here');
  console.error('  5. No quotes, no space after =, save the file');
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
  try {
    await client.fetch('*[_type == "product"][0]{_id}');
    console.log('Token is valid. You can run npm run upload-images.');
  } catch (e) {
    const msg = e && (e.message || String(e));
    console.error('Token check failed:', msg);
    console.error('');
    if (msg.includes('Unauthorized') || msg.includes('Session not found')) {
      console.error('Your token is invalid or not an API token.');
      console.error('');
      console.error('Do this:');
      console.error('  1. Go to https://www.sanity.io/manage → your project');
      console.error('  2. API → Tokens → Add API token (do NOT use a token from the browser)');
      console.error('  3. Permission: Editor → Save → Copy the new token');
      console.error('  4. In .env.local set: SANITY_API_TOKEN=<paste the new token>');
      console.error('  5. One line, no quotes, no newline after the token');
      console.error('  6. Run this script again: node scripts/check-sanity-token.mjs');
    }
    process.exit(1);
  }
}

main();

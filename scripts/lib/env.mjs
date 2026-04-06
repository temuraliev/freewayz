/**
 * Shared .env.local loader for all scripts and bots.
 * Call loadEnvLocal() before accessing process.env.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const PROJECT_ROOT = join(__dirname, '..', '..');

export function loadEnvLocal() {
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
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          )
            value = value.slice(1, -1);
          process.env[key] = value.replace(/\r$/, '').trim();
        }
      }
    }
  } catch (_) {
    // .env.local may not exist in production (env vars set by system)
  }
}

/** Clean env value: strip line breaks and trim */
export function cleanEnv(key) {
  return (process.env[key] || '').replace(/\r\n?|\n/g, '').trim();
}

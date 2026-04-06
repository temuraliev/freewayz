/**
 * Shared Sanity client for scripts and bots.
 * Requires SANITY_API_TOKEN and NEXT_PUBLIC_SANITY_PROJECT_ID in env.
 */
import { createClient } from '@sanity/client';
import { cleanEnv } from './env.mjs';

let _client;

export function getSanityClient() {
  if (_client) return _client;

  const token = cleanEnv('SANITY_API_TOKEN');
  const projectId = cleanEnv('NEXT_PUBLIC_SANITY_PROJECT_ID');

  if (!token || !projectId) {
    return null;
  }

  _client = createClient({
    projectId,
    dataset: cleanEnv('NEXT_PUBLIC_SANITY_DATASET') || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  });

  return _client;
}

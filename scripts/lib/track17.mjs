/**
 * 17track API integration with retry logic.
 */
import { cleanEnv } from './env.mjs';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 && attempt < retries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Register a tracking number with 17track.
 * @returns {{ success: boolean, error?: string }}
 */
export async function registerWith17track(trackNumber) {
  const apiKey = cleanEnv('TRACK17_API_KEY');
  if (!apiKey) {
    return { success: false, error: '17track API key not configured' };
  }

  try {
    const res = await fetchWithRetry(
      'https://api.17track.net/track/v2.2/register',
      {
        method: 'POST',
        headers: {
          '17token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ number: trackNumber }]),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = await res.json();
    const accepted = data?.data?.accepted || [];
    const rejected = data?.data?.rejected || [];

    if (accepted.length > 0) {
      return { success: true };
    }
    if (rejected.length > 0) {
      return { success: false, error: rejected[0]?.error?.message || 'Rejected' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get tracking info from 17track.
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export async function getTrackingInfo(trackNumber) {
  const apiKey = cleanEnv('TRACK17_API_KEY');
  if (!apiKey) {
    return { success: false, error: '17track API key not configured' };
  }

  try {
    const res = await fetchWithRetry(
      'https://api.17track.net/track/v2.2/gettrackinfo',
      {
        method: 'POST',
        headers: {
          '17token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ number: trackNumber }]),
      }
    );

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

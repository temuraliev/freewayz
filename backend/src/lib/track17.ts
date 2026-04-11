const API_BASE = "https://api.17track.net/track/v2.2";

function getApiKey(): string {
  return (process.env.TRACK17_API_KEY || "").trim();
}

export async function registerTracking(
  trackNumber: string,
  carrier?: number
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "TRACK17_API_KEY not set" };

  try {
    const payload: { number: string; carrier?: number }[] = [
      { number: trackNumber },
    ];
    if (carrier) payload[0].carrier = carrier;

    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: {
        "17token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { data?: { accepted?: unknown[]; rejected?: { error?: { message?: string } }[] } };
    const accepted = data?.data?.accepted ?? [];
    if (accepted.length > 0) return { ok: true };

    const rejected = data?.data?.rejected ?? [];
    const reason = rejected[0]?.error?.message || "unknown rejection";
    return { ok: false, error: reason };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface TrackingEvent {
  date: string;
  status: string;
  description: string;
  location: string;
}

const STATUS_MAP: Record<number, string> = {
  0: "NotFound",
  10: "InTransit",
  20: "Expired",
  30: "PickedUp",
  35: "Undelivered",
  40: "Delivered",
  50: "Alert",
};

export function parseTrackStatus(statusCode: number): string {
  return STATUS_MAP[statusCode] || `Unknown(${statusCode})`;
}

export function parseTrackEvents(
  rawEvents: Array<{ a: string; b?: string; c: string; d?: string }>
): TrackingEvent[] {
  return rawEvents.map((ev) => ({
    date: ev.a || "",
    description: ev.c || "",
    location: ev.d || "",
    status: ev.b || "",
  }));
}

export function mapTrackStatusToOrderStatus(
  trackStatus: string
): string | null {
  switch (trackStatus) {
    case "Delivered":
      return "delivered";
    case "PickedUp":
    case "InTransit":
      return "shipped";
    default:
      return null;
  }
}

export async function getTrackingInfo(trackNumber: string): Promise<{
  ok: boolean;
  status?: string;
  events?: TrackingEvent[];
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "TRACK17_API_KEY not set" };

  try {
    const res = await fetch(`${API_BASE}/gettrackinfo`, {
      method: "POST",
      headers: {
        "17token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ number: trackNumber }]),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { data?: { accepted?: { track?: { e?: number; z1?: Array<{ a: string; b?: string; c: string; d?: string }>; z0?: Array<{ a: string; b?: string; c: string; d?: string }> } }[] } };
    const track = data?.data?.accepted?.[0]?.track;
    if (!track) return { ok: false, error: "No tracking data" };

    const latestStatus = track.e != null ? parseTrackStatus(track.e) : "Unknown";
    const events = parseTrackEvents(track.z1 || track.z0 || []);

    return { ok: true, status: latestStatus, events };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

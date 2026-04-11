import { Hono } from "hono";
import { z } from "zod";
import { isAdminRequest } from "../../lib/admin-gate.js";
import { getSanityClient } from "../../lib/sanity.js";

const app = new Hono();

function getWriteClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new Error("Sanity token not configured");
  return getSanityClient({ useCdn: false, withToken: true });
}

// ── GET / ─────────────────────────────────────────────────
app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = isAdminRequest(c, initData);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const client = getWriteClient();
  const list = await client.fetch(`*[_type == "yupooSupplier"] | order(name asc) { _id, name, url, lastCheckedAt, lastAlbumCount, isActive }`);
  return c.json(list ?? []);
});

// ── POST / ────────────────────────────────────────────────
const createSchema = z.object({
  initData: z.string().optional(),
  name: z.string().min(1).max(200),
  url: z.string().url(),
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid supplier payload" }, 400);

  const auth = isAdminRequest(c, parsed.data.initData ?? "");
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const client = getWriteClient();
  const doc = await client.create({ _type: "yupooSupplier", name: parsed.data.name.trim(), url: parsed.data.url.trim(), isActive: true });
  return c.json({ ok: true, id: doc._id });
});

export { app as adminSuppliersRoutes };

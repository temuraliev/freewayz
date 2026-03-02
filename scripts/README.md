# Upload images to Sanity (bulk)

Upload all images from a folder into your Sanity asset library in one go.

## 1. Get a Sanity API token (important)

You must use an **API token** from the Sanity dashboard, not a browser/session token.

1. Go to [sanity.io/manage](https://www.sanity.io/manage) and open **your project**.
2. Open **API** in the left menu → **Tokens** → **Add API token**.
3. Give it a name (e.g. "Upload script"), set **Permission** to **Editor**.
4. Click **Save** and **copy the token** (you only see it once).

## 2. Add token to `.env.local`

In your project root `.env.local` add (one line, no quotes, no space around `=`):

```env
SANITY_API_TOKEN=sk...your_long_token_here...
```

You should already have:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID=...
NEXT_PUBLIC_SANITY_DATASET=...
```

**For AI-powered import and enrichment (Gemini):** add a Google AI Studio API key:

```env
GEMINI_API_KEY=your_google_ai_studio_key
```

Optional: multiple keys (comma-separated) for automatic rotation on 429/503:

```env
GEMINI_API_KEYS=key1,key2,key3
```

Get keys at [aistudio.google.com](https://aistudio.google.com) → Get API key. Required when using `--ai` with the Yupoo import or when running `enrich-products-with-gemini.mjs`.

If you get **"Unauthorized - Session not found"**: the token is wrong or missing.

1. **Check the token:** run `npm run check-sanity-token`. It will tell you if the token is missing or invalid.
2. Create a **new API token** at [sanity.io/manage](https://www.sanity.io/manage) → your project → **API** → **Tokens** → **Add API token** (Permission: **Editor**). Copy it right after creating.
3. In `.env.local` set exactly: `SANITY_API_TOKEN=paste_the_token_here` (no quotes, no space after `=`, no newline in the token).
4. Run `npm run check-sanity-token` again. When it says "Token is valid", run `npm run upload-images` again.

## 3. Run the script

The npm scripts use **Node’s `--env-file=.env.local`** so the same env (and token) as your app is used. **Node 20.6+** is required for that. If you’re on Node 18, run from project root: `node scripts/upload-images-to-sanity.mjs` (the script will load `.env.local` itself).

**Default folder** (`D:\FreeWayz\Broken Planet\Zip_files`):

```bash
npm run upload-images
```

**Or pass a folder path:**

```bash
node scripts/upload-images-to-sanity.mjs "D:\FreeWayz\Broken Planet\Zip_files"
```

On Mac/Linux:

```bash
node scripts/upload-images-to-sanity.mjs "/path/to/your/images"
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`. Subfolders are included.

## 4. Assign images to products

After the script runs, open **Sanity Studio** → **Product** → open a product → **Images** → **Add item** → choose from the asset library. All uploaded images will appear there.

---

## Upload images from a webpage (scrape then upload)

You can fetch a **webpage URL**, extract image URLs from the HTML, download them, and upload to Sanity in one go.

By default the script keeps only **main product photos**: it skips URLs that look like size charts, tags, thumbnails (e.g. path contains `small`, `thumb`, `chart`, `tag`, `label`), and uploads at most **15** images. Use `--all` to upload every image that passes the filter, or `--no-filter` to include everything.

```bash
node scripts/upload-images-from-url.mjs "https://rainbowreps.x.yupoo.com/albums/198266095"
node scripts/upload-images-from-url.mjs --max 8 "https://..."
node scripts/upload-images-from-url.mjs --all "https://..."
node scripts/upload-images-from-url.mjs --no-filter "https://..."
```

Or with npm:

```bash
npm run upload-images-from-url -- "https://example.com/album-page"
npm run upload-images-from-url -- --max 10 "https://..."
```

**Requirements:** Same `.env.local` as above (projectId, dataset, SANITY_API_TOKEN).

**Limitations:**

- Only images that appear in the page’s **initial HTML** (e.g. in `img` `src` or `data-src`) are found. If the site loads images with JavaScript after load, this script won’t see them.
- Some sites block or restrict direct image downloads (hotlink protection, 403). If many downloads fail, use the folder upload method instead (save images to disk, then `npm run upload-images`).
- **Legal / ToS:** Only use on content you’re allowed to use. You are responsible for rights and the site’s terms of service.

---

## Import from Yupoo (high-quality images + products)

Script `import-yupoo-to-sanity.mjs` fetches a **Yupoo category or album URL**, extracts **high-resolution** image URLs (prefers `data-origin-src` when present), **downloads** the images, **uploads** them to Sanity, and **creates product** documents.

**Usage:**

```bash
npm run import-yupoo -- "https://rainbowreps.x.yupoo.com/categories/4834693"
npm run import-yupoo -- "https://rainbowreps.x.yupoo.com/categories/4834693" --max 5
npm run import-yupoo -- "https://rainbowreps.x.yupoo.com/categories/4834693" --brand broken-planet --style opium
npm run import-yupoo -- "https://rainbowreps.x.yupoo.com/albums/123456" --brand hellstar --style uk-drill
```

- **Category URL** (`/categories/...`): parses the page for album links and imports the first N albums (default 5).
- **Album URL** (`/albums/...`): imports that single album as one product.
- **`--max N`**: max number of products to create from a category (default 5).
- **`--brand SLUG`**: slug of the **Brand** in Sanity to assign to all imported products (e.g. `broken-planet`, `hellstar`). If omitted, uses `broken-planet`.
- **`--style SLUG`**: slug of the **Style** in Sanity to assign (e.g. `opium`, `uk-drill`). If omitted, uses the first style found in Sanity.
- **`--ai`**: use **Gemini** to fill title, description, subtype, category, style, brand, colors, and price (formula-based). Requires `GEMINI_API_KEY` or `GEMINI_API_KEYS` in `.env.local`. The script sends the first product image and metadata to Google AI Studio and writes the returned fields into the product. With multiple keys, 429/503 triggers a switch to the next key.

**Example with AI:**

```bash
npm run import-yupoo -- "https://rainbowreps.x.yupoo.com/albums/123456" --brand hellstar --ai
```

**In Sanity:** Create the desired Brands and Styles in Studio and note their **slugs** (e.g. in the document URL or in the slug field). Use those slugs with `--brand` and `--style`. Price is parsed from titles like `¥~158` and converted to UZS (or computed by AI when using `--ai`); otherwise a default is used.

---

## Enrich existing products with Gemini

Script `enrich-products-with-gemini.mjs` fills **title**, **description**, **subtype**, **category**, **style**, **brand**, **colors**, and optionally **price** for products that have images but no description, using the first product image and Gemini.

**Requirements:** Same `.env.local` as above, plus `GEMINI_API_KEY` or `GEMINI_API_KEYS` (comma-separated for key rotation on 429/503).

**Usage:**

```bash
node --env-file=.env.local scripts/enrich-products-with-gemini.mjs
node --env-file=.env.local scripts/enrich-products-with-gemini.mjs --limit 10
node --env-file=.env.local scripts/enrich-products-with-gemini.mjs --dry-run
```

- **`--limit N`**: process at most N products (default 50).
- **`--dry-run`**: log what would be updated without patching Sanity.

Products are selected by filter: `_type == "product"`, with images, and without a description. The script reuses the same Gemini prompt and price formula as the Yupoo import with `--ai`.

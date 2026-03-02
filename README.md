# FreeWayz - Underground Streetwear Store

A high-end streetwear Telegram Mini App with dark, underground Opium-style aesthetics.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI (Radix Primitives)
- **Animations:** Framer Motion
- **State Management:** Zustand
- **Backend/CMS:** Sanity.io
- **Telegram Integration:** Telegram WebApp API (`telegram-web-app.js`)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SANITY_PROJECT_ID` - Your Sanity project ID
- `NEXT_PUBLIC_SANITY_DATASET` - Your Sanity dataset (usually "production")
- `SANITY_API_TOKEN` - Your Sanity API token (for write operations)
- `NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME` - Your Telegram admin username for checkout

### 3. Set Up Sanity CMS

1. Create a new Sanity project at [sanity.io](https://sanity.io)
2. Copy the schemas from `lib/sanity/schemas/` to your Sanity Studio
3. Add the schemas to your Sanity Studio's `schema.ts`:

```typescript
import { productSchema, categorySchema, userSchema } from './schemas'

export const schemaTypes = [productSchema, categorySchema, userSchema]
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How to Get This App as a Telegram Mini App

Your app is already built for Telegram (Web App script, `TelegramProvider`, haptics). To open it inside Telegram you need a **public URL** and a **Telegram Bot** that points to it.

### Step 1: Deploy the app (get a public HTTPS URL)

The Mini App must be served over **HTTPS**. Easiest option: Vercel.

1. Push your code to GitHub (if not already).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. Add env vars: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME`.
4. Deploy. You’ll get a URL like `https://freewayz.vercel.app`.

### Step 2: Create a Telegram Bot and attach the Mini App

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, follow the prompts, and get your **bot token**.
3. Attach your app to the bot using one of these:

**Option A – Menu button (recommended)**  
Users tap the bot’s **Menu** (or “Web App”) to open the app.

- In BotFather: open your bot → **Bot Settings** → **Menu Button** → **Configure menu button**.
- Set **URL** to your app URL, e.g. `https://freewayz.vercel.app`.
- Set **Button text** (e.g. “Open Store” or “Каталог”).

**Option B – Inline link**  
Share a link that opens the Mini App:

- Format: `https://t.me/YourBotUsername/your_web_app_short_name`  
  You set `your_web_app_short_name` when creating the Web App in BotFather.
- Or use **BotFather** → **Create new app** (or edit existing app) and set the **Web App URL** there; then use the link BotFather gives you.

**Option C – “Create new app” in BotFather**  
- Send `/newapp` (or use **Bot Settings** → **Web Apps** if available).
- Create a Web App with your deployed URL and a short name.
- Use the generated link (e.g. `https://t.me/YourBot/app`) to open the Mini App.

### Step 3: Open and test

- Open the link (e.g. Menu button or `https://t.me/YourBot/app`) in Telegram (mobile or desktop).
- The app should load in the in-app browser with Telegram theme and `window.Telegram.WebApp` available.

### Optional: Same app for multiple bots

You can use the **same deployed URL** for different bots: each bot gets its own Menu Button or Web App link pointing to the same `https://your-app.vercel.app`.

## Features

### Home Page
- Product grid with 2-column layout
- Filter by Style (Opium, Old Money, UK Drill, Y2K, Gorpcore)
- Filter by Brand (Hellstar, Corteiz, Rick Owens, etc.)
- User status badge in header

### Product Details
- Image carousel with thumbnails
- Size selector with availability
- Color selector
- Animated "Add to Cart" button
- Haptic feedback (in Telegram)

### Cart
- Item list with quantity controls
- Remove items
- Total calculation
- Checkout via Telegram message

### Profile
- User status display (Rookie/Pro/Legend)
- Progress bar to next status
- Total spent tracking
- Cashback balance
- Status tier information

## Design System

- **Background:** Dark grey/black (#0a0a0a) with noise texture
- **Typography:** Wide, bold sans-serif for headers, monospace for details
- **Accents:** White text, subtle grey borders
- **Mobile-first:** Optimized for Telegram Mini App viewport

## Loyalty Program

| Status | Spend Required | Cashback |
|--------|---------------|----------|
| Rookie | $0 - $499 | 3% |
| Pro | $500 - $1,999 | 5% |
| Legend | $2,000+ | 10% |

## Push to GitHub and import in Vercel

### 1. Install Git (if needed)

If `git` is not in your PATH: install [Git for Windows](https://git-scm.com/download/win), then restart the terminal.

### 2. Push the project to GitHub

In a terminal, from the project folder (`f:\PROG\Freewayz`):

```bash
# Initialize git (only if this folder is not yet a repo)
git init

# Add all files (.env.local is ignored by .gitignore — do not commit secrets)
git add .
git commit -m "Initial commit: FreeWayz Telegram Mini App"

# Create a new repo on GitHub: https://github.com/new
# Name it e.g. "freewayz", leave "Add a README" unchecked, then copy the repo URL.

# Add GitHub as remote and push (replace YOUR_USERNAME and freewayz with your repo)
git remote add origin https://github.com/YOUR_USERNAME/freewayz.git
git branch -M main
git push -u origin main
```

If GitHub asks for login: use a [Personal Access Token](https://github.com/settings/tokens) as the password, or sign in with the GitHub CLI (`gh auth login`).

### 3. Import the repo in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `YOUR_USERNAME/freewayz`). Click **Import**.
4. **Environment variables:** add the same ones you have in `.env.local` (they are not in the repo):
   - `NEXT_PUBLIC_SANITY_PROJECT_ID`
   - `NEXT_PUBLIC_SANITY_DATASET`
   - `SANITY_API_TOKEN`
   - `NEXT_PUBLIC_TELEGRAM_ADMIN_USERNAME`
5. Click **Deploy**. Wait for the build to finish.
6. Your app will be at `https://your-project.vercel.app`. Use this URL as the Telegram Mini App URL in BotFather.

Later: push to `main` and Vercel will redeploy automatically.

---

## Deployment (alternative: Vercel CLI)

Deploy to Vercel from the command line:

```bash
npm run build
vercel
```

Or link and deploy: `vercel --prod`

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   ├── cart/page.tsx       # Cart page
│   ├── profile/page.tsx    # Profile page
│   └── product/[slug]/     # Product details page
├── components/
│   ├── ui/                 # Shadcn UI components
│   ├── layout/             # Layout components (Header, BottomNav)
│   ├── products/           # Product components
│   ├── cart/               # Cart components
│   └── providers/          # Context providers
├── lib/
│   ├── sanity/             # Sanity client and schemas
│   ├── store/              # Zustand stores
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Utility functions
└── public/
    └── noise.svg           # Asphalt texture overlay
```

## License

MIT

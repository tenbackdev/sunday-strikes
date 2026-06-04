# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

There is no test suite.

## Architecture

**Sunday Strikes** is a bowling analytics web app. Players photograph scorecards, AI parses the frames, and results are stored for stats and head-to-head comparisons.

### Stack

- **React 19** (functional components + hooks) + **Vite 8**
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (no `tailwind.config.js` — configured directly in CSS)
- **Supabase** for auth (Google OAuth), database (Postgres with RLS), and RPC calls
- **Google Gemini 2.5 Flash Lite** (`src/lib/gemini.js`) for vision-based scorecard parsing
- **Vercel** deployment with an SPA rewrite rule (`vercel.json`)

### Auth & Routing

`App.jsx` manages the Supabase session. When unauthenticated it renders `Auth.jsx`; when authenticated it renders `Layout.jsx`.

There is **no router library**. `Layout.jsx` holds `activePage` state (`my-games` | `vs-matches` | `find-friends`) and conditionally renders the three main page components. Sidebar nav buttons call `onNavClick` to switch pages.

### Data Layer

All DB access goes through the Supabase client in `src/lib/supabase.js`. The main patterns used throughout:

- `supabase.from('table').select()/insert()/update()` for CRUD
- `supabase.rpc('function_name', { ...params })` for multi-table atomic writes (e.g., `create_vs_match` creates both game records and the match record in one call)
- `Promise.all()` for parallel queries
- Supabase RLS enforces per-user data isolation at the DB level

Key tables: `games`, `vs_matches`, `friend_requests`, `profiles`, `vs_notifications`.

### Scorecard Parse Flow

The core user journey for recording a game:

1. User captures a photo
2. `gemini.js` sends the image to Gemini with a detailed prompt — it returns frame data using bowling notation (`X`=strike, `/`=spare, `-`=gutter, digits for pin count, with 10th-frame bonus balls)
3. `parseGame.js` computes running scores (`computeScores`) and per-game stats (`computeStats`): strikes, spares, opens, splits, and "initial run" (consecutive strikes from frame 1)
4. User reviews and may edit frames via `Scorecard.jsx` before saving
5. If the user edits AI-parsed frames, the original AI frames are stored separately alongside the edited version

### Multi-Step Workflows

Both major workflows use a **phase/step state machine** pattern — a single state variable drives which UI is shown:

- **Single game upload** (in `MyGames.jsx`): `capture → playerLabel → parsing → review → saving`
- **VS match submission** (`VSSubmitModal.jsx`): 4–5 numbered steps covering opponent selection, date/time, scorecard photo(s), and review. Supports two modes — two separate photos or one combined scorecard.

### Upload Preferences

`src/lib/uploadPrefs.js` persists player label, photo mode, and opponent friend selection to `localStorage` with a daily expiry key (`ss_upload_prefs`). This prevents stale selections carrying across days.

### UI Layout

- Desktop: fixed sidebar (`w-64`) + top header
- Mobile: hamburger → slide-in sidebar overlay; FAB for quick game upload
- Modals use a fixed overlay with backdrop blur
- **Page root containers must cancel Layout padding.** Layout's content wrapper uses `py-6` (24px top padding). Every page component's root div must apply `style={{ marginTop: -24 }}` so that sticky headers land at exactly `top: FIXED_H` (56 px) and page-to-page navigation feels fixed. MyGames already does this; all new and existing pages must follow the same pattern.
- **Mobile FAB clearance.** The content wrapper in `Layout.jsx` uses `pb-24 md:pb-6` so the mobile FAB (56px tall, 24px from the bottom = 80px total) never covers the last piece of content on any page. Do not reduce this bottom padding on mobile.

### Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
```

---

## Frontend Development Rules

### Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

### Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

### Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `npm run dev` (Vite serves at the port it prints)
- If the server is already running, do not start a second instance.

### Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

### Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.

### Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Derive from a custom brand color.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating).

### Bowling Chart Rules
- Score-based Y-axes (any chart showing bowling scores) always cap at **300** — the maximum possible score. Never use `'auto'` as the Y-axis upper bound for score data.
- Score distribution histograms must give scores of exactly 300 their own dedicated bucket labeled `"300"`, separate from the 280–299 bucket.
- **Score distribution buckets must always be pre-defined and complete.** Do not generate buckets dynamically from `min → max` of actual data — that causes gaps when no scores fall in a range. Always use this fixed set: one `"< 100"` bucket for all scores 0–99, then 20-point buckets from 100–119 through 280–299, then a dedicated `"300"` bucket for perfect games. Every bucket must always appear in the chart data (with count 0 if empty) so the x-axis is never missing a range.
- **Chart whitespace:** All Recharts chart components (`BarChart`, `LineChart`, etc.) must use a non-negative left margin. Use `margin={{ left: 0, right: 16, top: 4, bottom: 0 }}` as the minimum baseline. Never use a negative `left` margin value — it causes the chart to clip against the container edge.

### Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
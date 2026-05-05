# Workout Tracker

Personal workout tracking PWA. iOS-native feel, Supabase backend, deploys to GitHub Pages.

---

## Quick start

### 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste + run the contents of `migrations/001_initial.sql`
3. Go to **Auth → URL Configuration** and add both:
   - `http://localhost:5173` (for local dev)
   - `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME` (for production)
4. In **Auth → Email Templates** you can optionally customize the magic-link email

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Find your values in Supabase: **Settings → API**

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Seed exercises

After signing in, find your **User ID** in Supabase → Auth → Users, then run
this in the SQL editor (replace the UUID with yours):

```sql
SELECT seed_default_exercises('your-user-uuid-here');
```

This populates your exercise library with ~50 common exercises.

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## GitHub Pages deployment

### One-time setup

1. Create a GitHub repo and push this code to `main`
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. Go to **Settings → Secrets → Actions** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — the workflow in `.github/workflows/deploy.yml` auto-builds and deploys

Your app will be live at `https://USERNAME.github.io/REPO_NAME`

> **Note:** The base path is auto-detected from `GITHUB_REPOSITORY` in CI.
> You don't need to change any config.

---

## iOS home screen installation

1. Open your deployed URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. The app opens full-screen with no browser chrome

---

## Icons

The app ships with a placeholder SVG icon. To generate proper PNGs:

```bash
npm install -D sharp          # one-time
node scripts/generate-icons.mjs
```

Or upload `public/icon-source.svg` to [pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
and put the output files in `public/icons/`. Required sizes:

| File | Size | Used for |
|------|------|----------|
| `icon-16.png`  | 16×16  | Browser favicon |
| `icon-32.png`  | 32×32  | Browser favicon |
| `icon-120.png` | 120×120 | iOS home screen (iPhone) |
| `icon-152.png` | 152×152 | iOS home screen (iPad) |
| `icon-167.png` | 167×167 | iOS home screen (iPad Pro) |
| `icon-180.png` | 180×180 | iOS home screen (iPhone Retina) |
| `icon-192.png` | 192×192 | Android / PWA manifest |
| `icon-512.png` | 512×512 | PWA manifest (large) |
| `icon-512-maskable.png` | 512×512 | Android adaptive icon |

---

## Data model

```
exercises         — exercise definitions (name, body_part, notes)
templates         — workout templates (Push Day, Pull Day, etc.)
template_exercises — ordered exercises within a template
workouts          — logged workout sessions (started_at, ended_at)
workout_sets      — individual sets (weight, reps, exercise_id, workout_id)
```

All tables use Row Level Security — users can only see their own data.

---

## Features

| Screen | What you can do |
|--------|----------------|
| **Home** | Quick-start any template, see recent PRs, weekly/monthly stats |
| **Templates** | Create/edit/delete named exercise lists |
| **Active Workout** | Log sets with weight+reps, see last-session reference, add exercises on the fly, skip exercises |
| **Exercises** | Browse by body part, add custom exercises |
| **Exercise Detail** | Full history, estimated 1RM chart (Epley formula), volume chart |
| **Progress** | Workout frequency chart, volume by muscle group, per-exercise progression |
| **Calendar** | Month view with color-coded body-part dots, tap any day for full workout detail |

---

## Stack

- **React 18** + Vite
- **Supabase** (Postgres + Auth with magic-link)
- **Tailwind CSS** (iOS system colors, safe-area insets, SF Pro font stack)
- **Recharts** for all graphs
- **vite-plugin-pwa** — service worker + manifest auto-generation
- **date-fns** for all date math
- **lucide-react** for icons
- **react-router-dom v6** with HashRouter (required for GitHub Pages SPA)

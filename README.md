# 🐛 PestDispatch

Technician dispatch lookup for pest control operations.  
All data lives in Supabase — every device reads and writes from the same source in real time.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Vercel account](https://vercel.com) (free)
- [Supabase account](https://supabase.com) (free)

---

## 1 — Set up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) → **New project**. Name it anything (e.g. `pest-dispatch`). Save the database password somewhere safe.

2. Once the project is ready, open the **SQL Editor** (left sidebar) and run the contents of **`supabase-setup.sql`** (included in this project). This creates the single table the app needs and seeds it.

3. Go to **Project Settings → API** and copy two values:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → this is your `SUPABASE_SERVICE_ROLE_KEY`
   
   > ⚠️ The service_role key has full database access. Never put it in frontend code. It stays in Vercel's environment variables only.

---

## 2 — Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install
npm install -g vercel
vercel
```

When prompted, add these environment variables:
```
SUPABASE_URL            = https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ...
```

### Option B — GitHub + Vercel Dashboard (recommended)

```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pest-dispatch.git
git push -u origin main
```

Then on [vercel.com](https://vercel.com):
1. **Add New Project** → import your repo
2. Before deploying, open **Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Click **Deploy**

Every future `git push` automatically redeploys.

---

## 3 — First Run

1. Open your deployed app and click **Manage Techs**
2. You'll be prompted to create your **Master Code** (this only happens once)
3. Once inside, go to **🔐 Access Codes** to create manager codes for your staff
4. Start adding technicians under the **Technicians** tab

---

## Local Development

```bash
cp .env.example .env.local
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

npm install
npm run dev        # runs `vercel dev` — starts both Vite and the API routes
```

> Requires the Vercel CLI: `npm install -g vercel`

---

## Data & Storage

| Scenario | Behavior |
|---|---|
| Multiple devices / computers | ✅ All see the same live data |
| Page refresh | ✅ Data persists |
| App crash | ✅ Data persists |
| Offline | ❌ Cannot read or write (requires database connection) |

---

## Architecture

```
Browser (React)
    │
    ├── GET  /api/techs     → read technicians   (public)
    ├── PUT  /api/techs     → write technicians  (requires admin code)
    └── POST /api/auth      → login / setup / manage codes
              │
              └── Supabase (Postgres)
                    └── app_config table
                          ├── key: "technicians"  → [ ...tech objects ]
                          └── key: "auth"          → { master, managers[] }
```

The service_role key never leaves the server. The browser only calls your own `/api/` routes.

---

## Customization

Everything lives in `src/App.jsx`:

| What | Where |
|---|---|
| Business name | Search for `PEST<span>DISPATCH</span>` |
| Service types | `TECH_TYPES` array at the top |
| Type colors | `TYPE_CFG` object at the top |
| Type subtitles | `TYPE_SUB` object inside `SearchView` |

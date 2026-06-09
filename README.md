# Trouble-Call Dispatch

A purpose-built web app for pest control call center agents to quickly look up technicians by service area, skill set, or name — and connect with them in seconds.

Built from scratch with no templates or off-the-shelf UI kits. Every screen and feature was designed specifically for this workflow.

---

## Live App

Deployed on Vercel. Open any browser on any device — no install, no account required for agents.

---

## How It Works

1. Enter a customer ZIP code, select a branch, or search by technician name / PestPac username
2. Select one or more service types to filter results
3. Matched technicians appear sorted by status — tap to call or copy the PestPac username

---

## Features

### Lookup

| Feature | Description |
|---|---|
| ZIP code search | Enter a 5-digit ZIP to find all technicians covering that area |
| Branch search | Select a branch to browse all assigned technicians |
| Name / PestPac search | Find any technician instantly by name or PestPac username |
| 16 service type filters | Filter by any combination of service types |
| Saved filter shortcuts | Save up to 5 ZIP + service type combos as one-tap shortcuts |
| Result sort options | Sort by status, A→Z, Z→A, branch, or newest |
| Supervisor guard | Supervisors only appear when the Supervisor type is explicitly selected |

### Technician Cards

Each result card shows:
- **Status badge** — color-coded availability indicator
- **Phone** — tap to call on mobile, copy button for desktop
- **PestPac username** — one-tap copy button
- **Service type badges** — matched types highlighted in color
- **ZIP coverage** — matched ZIP shown, "+N more" for additional areas
- **Branch label**
- **Warning flag** — red banner for techs requiring special attention before scheduling

### Technician Statuses

| Status | Meaning |
|---|---|
| **Best Fit** | Confirmed top match for this call — sort priority 1 |
| **Manual Schedule** | Requires coordination before booking |
| **In Training** | Verify availability before scheduling |
| **PTO** | Not available |
| **Do Not Schedule** | Do not assign — check notes |
| *(none)* | Status not set |

### Desktop Features

- **Pop-out window** — Opens a compact floating window via the ⧉ button. Keep the lookup visible while working in other tabs.
- **Keyboard shortcuts** — `Ctrl+K` / `⌘K` jumps to lookup. `Esc` closes any open modal.
- **Offline mode** — Service worker caches the tech list. Lookup works during outages with a visible offline banner.

---

### Admin Panel

Requires a manager or master access code. Accessible via **Manage Techs** in the navigation.

#### Technicians Tab
- Add, edit, and delete technicians
- Quick status toggle directly in the table — no modal required
- Filter by branch or search by name
- Duplicate detection — warns if a phone number or PestPac username already exists
- Export roster as JSON · Import JSON to bulk-load technicians

#### Reports Tab
- **Coverage Gap Report** — For each branch, shows which service types have 0 techs (gap), 1 tech (at-risk), or 2+ (covered). Sorted by most gaps first. Excludes Do Not Schedule techs.
- **Usage Analytics** — Tracks the last 500 searches. Shows total lookups, this week's count, average result count, top 5 ZIPs, and top 5 most-searched service types.

#### Backups Tab
- Auto-backup on every save — last 10 states stored, one-tap restore
- Download any backup as JSON

#### Access Codes Tab *(master only)*
- Change the master access code
- Add, rename, or delete named manager codes

---

## Service Types

GHP · Lawn · Termite · Mosquito · Commercial · Bed Bugs · Exclusion · Wildlife · TAP · Sentricon · SMART · Pre Treat · Post Treat · Field Inspector · Trouble Call · Supervisor

---

## Branches

Jax N · Jax E · Jax W · Jax S · St. Augustine · Melbourne · Ocala · Sarasota · Ft. Myers/Naples · Tampa · Orlando · WPB-FTL · Daytona

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Plain CSS (dark theme) |
| Fonts | Barlow Condensed · DM Mono · Barlow |
| API | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Offline | Service Worker (Cache API) |

---

## Environment Variables

```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Deployment

Auto-deploys on every push to `main` via Vercel.

```bash
npm install && npm run dev    # local dev
npm run build                 # production build
```

*Built by Brett Wingert*

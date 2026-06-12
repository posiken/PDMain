# Tech Dispatch

A purpose-built web app for pest control call center agents: look up the right technician by service area, call type, skill set, or name — and connect in seconds. Includes a full CS service-code cheat sheet.

Built from scratch with no templates or off-the-shelf UI kits. Professional light theme, blue brand accent.

---

## How It Works

1. Pick the call type — **Trouble Call** (new starts, floaters, callbacks) or **Production** (standard route techs)
2. Pick services — Res GHP, Commercial GHP, Lawn, Termite, or any of 12 specialty types
3. Enter a ZIP, choose a branch, or search by name / PestPac username — any order works
4. Tap to call, or copy the PestPac username

---

## Lookup Features

| Feature | Description |
|---|---|
| Call-type lens | Trouble Call vs Production as the first choice; opposites auto-clear each other. Never filters supervisors |
| Smart ZIP search | Techs **confirmed** for the ZIP appear first; other techs from the serving branch sit behind a "NOT confirmed for this ZIP" warning button — reference only |
| Branch & name search | Browse a whole branch, or find anyone by name / PestPac username |
| 16 service types | Featured core services + specialty grid; supervisors tagged by department (Supervisor + Lawn → lawn supervisor) |
| Supervisor guard | Supervisors only appear when explicitly selected |
| No-coverage escalation | Empty results show the branch's supervisors as tap-to-call contacts, labeled by department, specialty matches highlighted |
| Saved shortcuts | Up to 5 one-tap filter combos, persistent per browser |
| Jump pill | Live "N confirmed ↓" count beside the type grid scrolls straight to results |
| Order-independent input | Types first or location first — results compute when both exist |

## Technician Cards

Status badge · tap-to-call phone · PestPac copy button · matched service types · ZIP coverage · branch · orange warning banner for techs needing notes review.

**Statuses:** Best Fit · Manual Schedule · In Training · PTO · Do Not Schedule · (none)

## CS Cheat Sheet (Codes page)

~75 service codes across GHP/TurnerShield, TurnerGuard, Lawn/TurnerGreen, SMART, Service Calls, Follow-Ups, Termite Warranties, Commercial, Mosquito, and Impact — each with frequency, common/uncommon marker, and coverage explanation. Coverage talking points per category (✓ included / ✗ not covered). Search by code, pest, or service; tap any code to copy.

## Admin Panel

Manager or master access code required.

- **Technicians** — full CRUD, quick status dropdown per row, **bulk status updates** via checkbox selection, branch filter + name search, duplicate detection (phone & PestPac), JSON export/import
- **Reports** — Coverage Gap report per branch (0 / 1 / 2+ techs per service type) and Usage Analytics (last 500 searches: top ZIPs, top services, weekly counts)
- **Backups** — auto-backup on every save, last 10 kept, one-tap restore
- **Access Codes** *(master)* — manage named manager codes

## Desktop Extras

Pop-out compact window (⧉) · `Ctrl/⌘+K` jumps to lookup · `Esc` closes modals · Offline mode serves the cached roster with a visible banner.

---

## Branches (15)

Jax N · Jax E · Jax W · Jax S · St. Augustine · Daytona · Gainesville · Ocala · Orlando · Melbourne · Port St Lucie · WPB-FTL · Sarasota · Tampa · Ft. Myers/Naples — plus a regional Wildlife team.

Current roster: **383 technicians** imported from the operational Excel workbooks, with PestPac usernames, ZIP territories, statuses, and supervisor department tags.

## Service Types

GHP · Commercial · Lawn · Termite · Mosquito · Bed Bugs · Exclusion · Wildlife · TAP · Sentricon · SMART · Pre Treat · Post Treat · Field Inspector · Trouble Call · Supervisor
*(Production is a lookup-only lens: every tech without the Trouble Call tag.)*

---

## Tech Stack

React 18 + Vite · plain CSS (light theme) · Vercel serverless API · Supabase (PostgreSQL) · Service Worker offline cache · Barlow Condensed / DM Mono / Barlow.

## Environment Variables

```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Deployment

Auto-deploys on push to `main` via Vercel.

```bash
npm install && npm run dev    # local dev
npm run build                 # production build
```

*Built by Brett Wingert*

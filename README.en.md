# Date Alert · date_alert

[简体中文](README.md) · **English**

A minimal date-countdown reminder that runs entirely on Cloudflare: **public card wall + admin console + scheduled Bark push notifications**.

It uses only Cloudflare-native resources (Workers / D1 / Cron Triggers) — **no domain required, no email service required**.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB_USER/date_alert)

> Replace `YOUR_GITHUB_USER` in the button above with your GitHub username — the repository must be **public**.
> After deploying, open the site: the first visit asks you to **set the admin password** yourself (see below).

---

## Features

**Home page (public, no login)**

- Card wall, up to 4 per row, responsive down to mobile
- Sorted by days remaining; colors come from configurable day-range rules (with labels, light/dark themes)
- Items without a due date are grouped in a separate section below
- Notes are clamped to 2 lines and expand on hover
- Logged in: click a card for details. Logged out: three clicks show a sign-in hint

**Admin console (password login)**

| Module | Contents |
|---|---|
| Reminders | List (active / archived / no-date / all), search, pagination, create, edit, archive, restore, delete, clear archived |
| Time zone & language | 418 IANA zones with live clock preview, default UI language, push language |
| Color rules | Add/remove day-range rules, color picker, live preview, overlap validation, restore defaults, dark mode |
| Notifications | Master switch, push time (minute precision), days-left reminders, daily digest, Bark URL / device key / group / sound / level, **test push** |
| Execution log | 7-day success/failure counters, filters, failure details (request / response / error, key masked) |
| Data & backup | Export JSON, import (merge / replace), purge archived |

**Notifications**

- Cron every minute; a 30-minute delivery window evaluated in the configured time zone (handles midnight wrap)
- Multiple hits are merged into one message; failures are retried on subsequent minutes (max 3 attempts); successful sends are idempotent
- Items without a due date are never pushed and never auto-archived

**Security**

- PBKDF2-SHA256 (10,000 iterations + server-side pepper) — sized for the 10 ms CPU limit of the free plan
- Login rate limiting (5 failures per IP per 15 min), forced password change on first login, all sessions revoked on change
- Bark device key stored with AES-256-GCM; never returned by any API
- Device keys are masked as `••••••` in execution logs

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers (free plan is enough) |
| Server | Hono + TypeScript |
| Database | Cloudflare D1 (SQLite) |
| Scheduling | Cron Triggers (every minute) |
| Frontend | Vue 3 + Vite + Tailwind CSS |
| Tests | Vitest (99 cases) |
| i18n | Lightweight in-house implementation (zh-CN / zh-TW / English) |

---

## Local development

Requires Node.js ≥ 20.

```bash
npm install
npm run db:local                 # create tables (local D1)
node scripts/init.mjs --local    # generate the initial password (printed once)
npm run dev                      # build frontend + start Worker (8787) and Vite (5173)
```

Open <http://localhost:8787/> and sign in with the password printed by `init`; the first login forces a password change.

| Command | Purpose |
|---|---|
| `npm run dev` | Build, then run Worker and Vite together |
| `npm run build` | Build the frontend only (into `web/dist`) |
| `npm run db:local` | Apply migrations to the local D1 |
| `npm run db:remote` | Apply migrations to the remote D1 |
| `npm test` | Unit tests |
| `npm run init` | Initialize the admin password (remote) |
| `npm run reset:password` | Reset the password and revoke all sessions |
| `npm run deploy` | Build → migrate (remote) → deploy |
| `npm run cron:local` | Fire the scheduled handler once (local Cron does not run by itself) |

> **Local development never triggers Cron automatically** — Wrangler only fires `crons` in production.
> To debug pushes: set the push time to the current minute, then run `npm run cron:local`.

Local secrets live in `.dev.vars` (gitignored): `SECRET_KEY=<32-byte Base64>`.

---

## Deploy to Cloudflare

### Option A — one-click button

1. Push the repo to GitHub (public) and replace `YOUR_GITHUB_USER` in the button above
2. Click the button — Cloudflare clones the repo, creates the D1 database, injects the binding and runs `npm run deploy`
3. Open the site and finish the two steps below

### After one-click deploy (two steps)

1. Open `https://<your-worker>.workers.dev`
2. The first visit redirects to the **setup page** — choose your admin password there

> One-click builds run inside Cloudflare CI, where there is no interactive terminal,
> so the initial password is chosen by you on first visit.
> To prevent someone else from claiming the instance first, configure an optional `SETUP_TOKEN` (below).

**Optional hardening: `SETUP_TOKEN`**

Add an encrypted variable named `SETUP_TOKEN` in the Cloudflare dashboard
(Worker → Settings → Variables and Secrets). The setup page then requires the same value:

```bash
npx wrangler secret put SETUP_TOKEN
```

### Option B — command line

```bash
npm install
npx wrangler login

npx wrangler d1 create date-alert        # copy the returned database_id into wrangler.toml
npm run build
npm run db:remote                        # create tables
npm run deploy                           # first deploy (includes migrations)
```

With the CLI you can also generate a random initial password (printed to the terminal):

```bash
npm run init             # writes the admin row, pushes SECRET_KEY, prints a random password
npm run reset:password   # reset if you forget it
```

You may skip `init` entirely and use the setup page on first visit instead.

> `database_id` in `wrangler.toml` is a placeholder. The one-click button creates the database
> and replaces it automatically; with the CLI you must run `d1 create` and paste the id first,
> otherwise the `--remote` migration step fails.

---

## Configure Bark push

1. Install [Bark](https://github.com/Finb/Bark) on your phone and copy the device key
2. Sign in → **Settings → Notifications**, paste the device key → save
3. Click **Send test push** — if the phone buzzes, you are done
4. Optional settings:
   - **Push time**: minute precision, evaluated in your time zone; failed sends are retried every minute for 30 minutes (max 3 attempts)
   - **Days-left reminders**: defaults to `1 / 3 / 5`
   - **Daily digest**: one summary per day of everything due within N days
   - Per-reminder override: follow global / never notify / custom day list

Message format: a single hit renders as "title · N days left"; multiple hits are merged into one list (max 10 lines).

---

## Data & backup

- Everything lives in D1; export JSON from **Settings → Data & backup**
- Exports **exclude** the Bark device key — re-enter it after importing into another environment
- Import supports **merge** (upsert by id) and **replace** (wipe then import)
- D1 includes Time Travel (7 days on the free plan); export regularly for anything important

---

## Updates & caching

- All API responses and page entries are `Cache-Control: no-store`, so a deploy takes effect immediately
- `/assets/*` files are content-hashed and cached long-term
- The frontend polls `/version.json` on visibility change, window focus and every 5 minutes; a new deploy triggers an automatic reload — no hard refresh needed

---

## FAQ

| Symptom | Fix |
|---|---|
| No push received | Use "Send test push" and check the execution log for the failure details (URL, status code, error) |
| Log shows failure ×3 | All 3 attempts were used. Fix the URL/key; the next scheduled run will try again |
| Page looks outdated | Auto-reload is built in. If it persists, check for a hard browser cache: `Cmd/Ctrl + Shift + R` |
| Login returns 429 | 5 wrong passwords from one IP within 15 minutes locks it for 15 minutes |
| Forgot the password | `npm run reset:password` (remote) or `node scripts/reset-password.mjs --local` |
| Setup page says "already initialized" | An admin already exists — just sign in; use the reset command if the password is lost |
| Setup page asks for a token | You configured `SETUP_TOKEN`; enter the value you set at deploy time |
| Error 1102 / CPU exceeded on login | The free plan allows 10 ms per request. Hashing is already reduced to 10,000 iterations; upgrade to Workers Paid if it still happens |
| `workers.dev` unreachable | Access from mainland China can be unstable; bind your own domain |
| Times look wrong after changing the time zone | Push time is evaluated in **Settings → Time zone**, not the browser's zone |
| Where is the data stored | Cloudflare D1; locally under `.wrangler/state` (gitignored) |

---

## Project layout

```
├─ src/                  Worker: Hono routes, auth, scheduled task
│  ├─ api/               public / auth / admin endpoints
│  ├─ lib/               time, colors, validation, crypto, Bark, push copy (with tests)
│  └─ middleware/        sessions and login rate limiting
├─ web/                  Frontend: pages, components, i18n, design tokens
│  └─ public/            _headers, manifest, icons
├─ migrations/           D1 migrations
├─ scripts/              init and password reset
├─ docs/DESIGN.md        Requirements spec (what was built, in Chinese)
└─ wrangler.toml
```

---

## Development conventions

- Both server and frontend are TypeScript; pure functions (dates, colors, scheduling window, validation) must have unit tests
- Schema changes go through `migrations/` — never edit production tables by hand
- All user-facing copy must go through `web/src/i18n`; no hard-coded strings
- Run `npm test` and `npm run build` before committing

The full requirements-to-implementation mapping lives in [`docs/DESIGN.md`](docs/DESIGN.md) (Chinese).

# GIM Property Management Scoreboard

A dashboard that surfaces task-level performance metrics from the Buildium API
so a property management supervisor can see, at a glance, who is closing tasks
quickly, who is letting them rot, and where the backlog is hiding. Designed to
gamify day-to-day PM work: leaderboard, wall of shame, per-manager scorecards.

Built on AWS Amplify Gen 2 (React + Vite frontend, Cognito auth, Lambda proxy).

## What it shows

### Team KPIs (top row)
- Open tasks (+ unassigned count)
- Overdue (due-date passed)
- Stale (no activity 7+ days)
- High-priority open
- Closed last 7 / last 30 days vs created in the same window
- Avg + median days to close
- Oldest open task age

### Gamification
- **Leaderboard** ranked by composite Score (see formula below)
- **Per-manager scorecards** with open / overdue / stale / closed / avg-close / oldest-open
- **Wall of Shame** — top 10 most silent open tasks plus the top 10 most overdue
- Score tone coloring (green / amber / red) per manager

### Charts
- Last 30 days: tasks created vs closed (line)
- Status breakdown (pie)
- Priority breakdown (pie)
- Top 10 categories of open tasks (horizontal bar)

### Score formula (composite, "higher is better")
```
+10  × tasks closed in last 30 days
 +5  × tasks closed in last 7 days
-15  × overdue open tasks
 -5  × stale open tasks (no update 7d+)
 -3  × high-priority open tasks
-0.3 × days since creation of oldest open task
```
Closing tasks rewards you. Deferring or ignoring them hurts. Tweak in
[`src/buildium/metrics.ts`](src/buildium/metrics.ts) (`computeMetrics`, score line).

## Architecture

Two transports, same frontend code — the client picks one based on
`import.meta.env.DEV`:

```
DEV (npm run dev)
  Browser ──► Vite dev server /api/buildium/* ──► api.buildium.com
              (reads .env, injects x-buildium-client-* headers)

PROD (Amplify Hosting)
  Browser ──► AppSync buildiumFetch ──► Lambda buildium-proxy ──► api.buildium.com
              (Cognito-authenticated)    (reads Amplify secrets)
```

- Credentials **never** reach the browser in either mode. Locally they live in
  `.env` (gitignored); in production they're Amplify secrets injected into the
  Lambda.
- The Lambda enforces a strict allow-list of paths (tasks, users, categories,
  work orders, rentals, associations). Local proxy inherits the same safety
  because Vite's `server.proxy` only exposes the `/api/buildium/*` route.
- Both transports support auto-pagination to drain multi-page Buildium
  collections in one logical call.
- Frontend computes all metrics client-side from the raw task/user payloads —
  no database, no caching layer. Refresh cadence: every 5 minutes + manual.

## Running locally (fastest path)

### 1. Install
```bash
npm install
```

### 2. Create `.env`
Copy the template and fill in your Buildium keys:
```bash
cp .env.example .env
# then edit .env with your BUILDIUM_CLIENT_ID / BUILDIUM_CLIENT_SECRET
```
`.env` is gitignored. The values are read by `vite.config.ts` server-side and
injected as request headers on the `/api/buildium/*` proxy — they never end
up in the client bundle.

### 3. Run
```bash
npm run dev
```
Open the URL Vite prints. The first time you'll need to sign up (email +
password) against the Cognito pool that was set up in the earlier sandbox
deploy — `amplify_outputs.json` already wires this up.

> If `amplify_outputs.json` doesn't exist yet, run `npm run sandbox` once to
> provision Cognito + AppSync + the Lambda into your AWS account. After that,
> local dev doesn't need the sandbox running — the Vite proxy handles
> everything.

## Deploying to Amplify Hosting

1. Push to the GitHub repo.
2. Connect it in the Amplify console (Hosting).
3. Set the two secrets per branch:
   ```bash
   npx ampx secret set BUILDIUM_CLIENT_ID --branch main
   npx ampx secret set BUILDIUM_CLIENT_SECRET --branch main
   ```
   …or enter them via Amplify console → App settings → Secret manager.
4. Amplify will run `amplify.yml` — backend first, then `npm run build`. The
   production bundle routes through the Lambda; `.env` is only used in dev.

## Deploying to Amplify Hosting

1. Push to the GitHub repo.
2. Connect it in the Amplify console (Hosting).
3. Set the two secrets per branch in Secret Manager (step 2 above).
4. Amplify will run `amplify.yml` — backend first, then `npm run build`.

## File layout

```
.env.example                       Template for local creds (copy to .env)
vite.config.ts                     Dev-only proxy: /api/buildium/* → Buildium
amplify/
  auth/resource.ts                 Cognito user pool (email login)
  data/resource.ts                 GraphQL schema + custom buildiumFetch query
  functions/buildium-proxy/
    resource.ts                    Lambda definition + secret wiring
    handler.ts                     REST proxy with path allow-list + pagination
  backend.ts                       Registers auth, data, function
src/
  App.tsx                          Authenticator wrapper → Dashboard
  buildium/
    types.ts                       Hand-rolled Buildium response types
    client.ts                      Dual-transport fetcher (dev proxy vs Lambda)
    metrics.ts                     computeMetrics — all the math lives here
    useDashboardData.ts            Data-loading hook (30-day window, refresh)
  components/
    Dashboard.tsx                  Layout + filter tabs + orchestration
    MetricCard.tsx                 KPI tile
    Leaderboard.tsx                Ranked table of staff
    StaffScorecard.tsx             Per-manager breakdown tile
    WallOfShame.tsx                Stale + overdue task tables
    Charts.tsx                     recharts pie / bar / line
```

## Extending

- **New metric** — add the computation in `metrics.ts` (`StaffMetrics` or
  `TeamMetrics` struct), render it in a component.
- **Another Buildium endpoint** — add the regex to `ALLOWED_PATH_PATTERNS` in
  [`handler.ts`](amplify/functions/buildium-proxy/handler.ts), then expose a
  helper in [`client.ts`](src/buildium/client.ts).
- **Push/email alerts** — a Lambda on a schedule could re-run
  `computeMetrics` and DM Slack when someone's stale-count crosses a threshold.

## Security notes

- Buildium keys are view-only per the build spec — even so, they're stored as
  Amplify secrets, not in code or `.env` files.
- The proxy rejects any path not on the allow-list. If you add PUT/POST paths
  later, also tighten the HTTP method (handler currently hard-codes GET).
- GraphQL custom query is `@auth(rules: [{ allow: authenticated }])` — only
  signed-in Cognito users can call it.
- **Rotate the keys** after evaluation — the pair embedded in this repo's
  initial prompt is disposable.

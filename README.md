# Darkturbo bingo dashboard & Wise Old Man export

Vue 3 + TypeScript, PrimeVue 4 (MIT), Tailwind CSS 4, and Apache ECharts.

```sh
npm install
npm run dev
# Open the Local URL printed by Vite (normally http://127.0.0.1:5173).
npm run build
npm run preview
```

The Bingo page contains all six crypts and 54 numbered tiles. Click a tile for its
requirements, sourced drop rates, recorded team activity, fixed-rate expectations,
and player contributions. The crypt headers show the same shared Barrows chest
activity. Armour drops, die rolls, unlocked tiles, actual loot, and completion
scores are not available and are never inferred.

Overview, Teams, Players, and Bosses provide kills and EHB rankings, per-member
comparisons, contribution shares, player comparisons, a scatterplot, a heatmap,
and full start/end/gained boss statistics. Player colors always follow their team.
Team and boss filters apply to aggregate views; individual profiles show the full
competition. Table alternatives accompany charts. Dates use Europe/Amsterdam.

The dashboard reads the committed dataset at
`output/competition-160537-bosses.json`. Website visitors cannot reload or import
competition data. Run the exporter manually to update it:

```sh
npm run export
git add output/competition-160537-bosses.json
git commit -m "Update competition boss data"
git push
```

The Pages workflow rebuilds and deploys the committed snapshot after pushes to
`main`. The dashboard and workflow never call the WOM API; exports remain manual.

**Expected drops** are expected item quantities, never confirmed loot or crafted
sets. Fixed estimates use the available eligible player credits and verified
rates, including quantities/rolls. Separate components and alternative items are
modeled explicitly. Missing counts are not known zeroes; partial coverage is
marked. Shared sources reuse the same kill counts across component rows.

Conditional sources (raid contribution, awakened modes, corpse choices, perfect
kills, delve levels, chest eligibility, and shared loot) require an optional
scenario: enter eligible rolls, effective item probability from 0 to 1, and items
per successful roll. The calculator never substitutes group kill credits for
unique encounters. Scenario inputs are stored locally per competition and tile;
Reset clears them. Unsupported components display `no data provided for this tile`.

Boss/item mappings, event restrictions, source URLs, and verification dates live
in `src/catalog.ts`. They should be reviewed after game updates. The checked Wiki
pages include current changes such as Cerberus's 1/520 Primordial crystal rate
and the separate key-gated Obor chest. Images are cached under `public/images`,
with file-page attribution in `src/wiki-images.json` and the app footer. Re-cache missing
images with `npm run assets:wiki` (requires network access); unavailable images
have accessible placeholders.

```sh
npm test          # Exporter and analytics/catalog tests
npm run typecheck
npm run test:e2e  # Desktop + mobile browser flows
```

Browser tests use installed macOS Chrome when available; otherwise install
Playwright Chromium with `npx playwright install chromium`. A custom binary can
be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests launch and stop their
own Vite server on port 5174.

## GitHub Pages deployment

`.github/workflows/pages.yml` tests and builds on pull requests, then builds and
deploys `dist` on pushes to `main` or manual workflow runs. It uses Node.js 24,
`npm ci`, a Pages artifact, and the `github-pages` deployment environment. Source
images and exported JSON work under `/dt-bingo-dashboard/`; local development
continues to use `/`.

Enable **Settings → Pages → Build and deployment → Source → GitHub Actions**.
GitHub Pages for this private repository requires GitHub Pro or another eligible
paid plan. The current Free account rejected Pages setup; the workflow is ready,
but deployment remains blocked until the plan supports the private repository
or its owner explicitly chooses to make the repository public. Repository
visibility is not changed by the workflow. See
[GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To reproduce the Pages build and browser checks locally:

```sh
VITE_BASE_PATH=/dt-bingo-dashboard/ npm run build
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_BASE_PATH=/dt-bingo-dashboard/ npm run test:e2e
```

## Reusable competition exporter

Requires Node.js 22.18 or newer; no dependencies to install.

```sh
npm run export
# Another competition or output filename:
npm run export -- 160537 output/final-bosses.json
npm test
```

Run the exporter again after the competition ends to get the final available data.
The competition API supplies the roster, team assignments, and exact UTC start/end
timestamps automatically. Each run fetches fresh data and replaces the chosen output
file. The default is `output/competition-160537-bosses.json`.

The reusable function can also be imported:

```ts
import { exportCompetitionBossData } from './scripts/export-competition.ts';

const result = await exportCompetitionBossData(160537, {
  outputPath: 'output/final-bosses.json', // Optional: omit to return JSON in memory only.
  userAgent: 'your-discord-name / bingo-export',
  onProgress: console.log,
});
```

Output is grouped as `teams[].players[username].bosses[bossMetric]`. Each player
includes their profile, participation timestamps, actual snapshot range, and all
boss metrics returned by WOM. Every boss retains `kills`, `rank`, and `ehb`, each
with `start`, `end`, and `gained`. Values of `-1` are preserved as WOM's unknown or
unranked values; they should not be treated as known zero counts.

`requestedRange` contains the competition dates; `snapshotRange` records the actual
available data boundaries for each player. WOM data depends on recorded snapshots,
so the available boundaries can differ from the competition timestamps. An ongoing
competition has `interim: true`. `complete: true` means all players were fetched
successfully, not that the competition has ended or that every player has a snapshot
at the exact deadline. This exports aggregate boss progress, not individual kill
events or every historical snapshot. It reads existing WOM data without triggering
player updates.

Requests are serialized and spaced by at least 3.1 seconds, staying below 20 per
60 seconds for this client. HTTP 429 responses honor `Retry-After` with a minimum
61-second pause; exhausted server rate limits honor `RateLimit-Reset`. Transient
network/server failures are retried. Avoid concurrent runs or other API traffic
from the same IP; independent clients share the server's limit. A 77-player run
takes roughly four minutes without retries.

The JSON is checkpointed after each player. Failed players remain in the output
with `status: "error"`, and the command exits with a nonzero status on any failure.
Rerunning fetches the whole roster again. Optional environment variables:
`WOM_USER_AGENT` (use a contactable identifier) and `WOM_API_KEY`. Even with an API
key, the script retains the requested 20-per-minute limit.

API references:
- https://docs.wiseoldman.net/api
- https://docs.wiseoldman.net/api/competitions/competition-endpoints
- https://docs.wiseoldman.net/api/players/player-endpoints#get-player-gains

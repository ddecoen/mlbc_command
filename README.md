# MLBC Command

**Season 2142 Dashboard** for an MLBC (Major League Baseball Classic) simulation running on the Hardball Heaven 2003 engine, cycle started 2102.

## What it is

A single-file interactive HTML dashboard built from HHRecord exported CSVs. All data is embedded — no server required.

## Features

- **⚾ Batting** — 455 active MLB hitters (100+ AB), sortable/filterable by position. Click any player for a season-by-season OPS chart and full stat history. Shows park factor (PF) for each player's home park.
- **⚡ Pitching** — 440 active pitchers with ERA, WHIP, K/9, and OPS-against. Qualified-only filter (SP 500+ IP / RP 200+ IP) for meaningful rate stat comparisons.
- **🏟️ Parks** — HR park factors for all 30 parks, derived from 2141 season game logs. Ranges from 1.316x (Team 12, extreme hitter park) to 0.801x (Team 28, extreme pitcher park).
- **⭐ Prospects** — 1,359 prospects graded and projected. Hitters graded on card OPS (higher = better); pitchers graded on OPS-against (lower = better). ETA model accounts for current level, age, and talent grade.
- **📈 Career Sim** — Park-aware career projector. Strips current park factor to get a neutral HR rate from the baseline window, then re-applies target park factor. Supports "what if player moves to a different park" scenarios.

## Park Factor Math

Park factors are computed from `SeasonIndBat.csv` game logs. For each game, the home team ID is the park ID. HR rates per park are normalized against the league average. Single season of data (2141).

## HR Projection Fix

Career HR rate is NOT used as the baseline. The sim takes only the most recent N seasons (user-adjustable slider), computes raw HR/AB from those seasons, divides by current park factor to get park-neutral rate, then multiplies by target park factor for projections. This correctly handles players who changed parks mid-career (e.g. Sung Jinwoo's move to Kauffman in 2140).

## Source Files

| File | Description |
|------|-------------|
| `index.html` | The complete built dashboard (self-contained, ~1.3MB) |
| `dash_css.css` | All styles |
| `dash_js.js` | Main JS: batting, pitching, parks, career sim |
| `dash_js_prospects.js` | Prospects tab JS |
| `dash_hitters.json` | 455 active MLB hitters with computed stats + park factors |
| `dash_pitchers.json` | 440 active MLB pitchers with ERA, WHIP, K/9, OPS-against |
| `dash_years.json` | Year-by-year MLB batting (3,305 rows) |
| `dash_prospects.json` | 1,359 prospects with ETA projections |
| `park_factors.json` | HR park factors for all 30 teams |

## Data Source

All stats from HHRecord.exe companion app exports (Microsoft Access .mdb → CSV). IP stored as outs in source data (divided by 3). Year offset: DB year + 140 = sim year.

## Rebuilding

The `index.html` is self-contained and can be opened directly in any browser. To rebuild from source after editing CSS/JS, concatenate: data JSON → dash_js.js → dash_js_prospects.js into the script block, and dash_css.css into the style block.

## Notable Players (Season 2142)

| Player | Age | Career HR | Career OPS | Notes |
|--------|-----|-----------|-----------|-------|
| Dutch van der Linde | 39 | 786 | 1.007 | All-time HR leader |
| Sung Jinwoo | 27 | 289 | 0.997 | 57+52 HR at Kauffman (2140-41) |
| Mayday Montgomery | 29 | 359 | 1.015 | T12 (1.316x HR park) |
| Zan Allen | 25 | 85 | 1.142 | Top active OPS, 311 G |
| Spencer Strider | 39 | — | — | 3,290 IP, 220W, 8.43 K/9 |
| Bray Wyatt | 28 | — | — | 1,298 IP, 3.56 ERA |

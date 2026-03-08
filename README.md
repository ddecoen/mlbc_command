# MLBC Command

Season dashboard for an MLBC simulation on the High Heat 2003 engine (cycle started 2102).

## Quick Start

```bash
# Install dependencies (one time)
pip install -r requirements.txt

# Start the local build server
python app.py

# Open in browser
open http://localhost:5001
```

## Updating the Dashboard (each new season)

1. Export CSVs from HHRecord (all 8 files below)
2. Run `python app.py` and open `http://localhost:5001`
3. Enter the new season year, upload all CSVs, click **Process & Build**
4. The dashboard (`index.html`) is rebuilt automatically
5. Commit and push to GitHub — GitHub Pages auto-updates

```bash
git add .
git commit -m "Season 2143 data"
git push
```

## Required HHRecord CSV Exports

| File | Contents |
|------|----------|
| `CareerBatStat.csv` | Career MLB batting totals |
| `CareerPitStat.csv` | Career MLB pitching totals |
| `YearAllBatStat.csv` | Year-by-year batting (all levels) |
| `YearAllPitStat.csv` | Year-by-year pitching (all levels) |
| `Players.csv` | Player registry (age, team, level, card OPS) |
| `SeasonIndBat.csv` | Per-game individual batting logs (for park factors) |
| `SeasonTeamBat.csv` | Per-game team batting logs |
| `StatBatCompletePlayer.csv` | Batting splits by hand |

## Repo Structure

```
mlbc_command/
├── index.html              ← Built dashboard (served by GitHub Pages)
├── app.py                  ← Local Flask build server
├── pipeline.py             ← Data processing logic
├── requirements.txt
├── templates/
│   └── admin.html          ← Build server UI
├── src/
│   ├── dash_css.css
│   ├── dash_js.js
│   └── dash_js_prospects.js
└── data/
    ├── current/            ← Active season JSON (what index.html uses)
    │   ├── hitters.json
    │   ├── pitchers.json
    │   ├── years.json
    │   ├── prospects.json
    │   └── park_factors.json
    └── seasons/            ← Per-season archive
        ├── 2142/
        └── 2143/
```

## GitHub Pages

Enable in repo Settings → Pages → Source: main branch, root folder.  
Your dashboard will be live at `https://YOUR_USERNAME.github.io/mlbc_command/`

## Dashboard Features

- **⚾ Batting** — 455+ active hitters, sortable, filterable by position. Park factor column. Click for season-by-season OPS chart.
- **⚡ Pitching** — ERA, WHIP, K/9, OPS-against. Qualified-only filter (SP 500+ IP / RP 200+ IP).
- **🏟️ Parks** — HR park factors for all 30 parks from game log data.
- **⭐ Prospects** — Graded on card talent (hitters: OPS higher=better; pitchers: OPS-against lower=better). ETA model by age + level + grade.
- **📈 Career Sim** — Park-aware projector. Strips park effect from baseline window HR rate before projecting. Supports park-change scenarios.
- **Season switcher** — Dropdown to flip the dashboard between archived seasons.

## Key Data Notes

- IP is stored as outs in HHRecord — divided by 3 in pipeline
- Sim year = DB year + 140
- Park factors computed from `SeasonIndBat.csv` game logs: home team ID = park ID
- HR projection uses only the baseline window (not career) to avoid pre-park-change dilution

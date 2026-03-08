"""
MLBC Command — Data Processing Pipeline
Converts HHRecord CSV exports into dashboard JSON data files.
"""

import os, json, csv, math, shutil
from collections import defaultdict

BASE_DIR     = os.path.dirname(__file__)
CURRENT_DIR  = os.path.join(BASE_DIR, 'data', 'current')
SEASONS_DIR  = os.path.join(BASE_DIR, 'data', 'seasons')
SRC_DIR      = os.path.join(BASE_DIR, 'src')
INDEX_PATH   = os.path.join(BASE_DIR, 'index.html')

YEAR_OFFSET = 140   # DB year + 140 = sim year
IP_DIVISOR  = 3     # IP stored as outs

POS_MAP = {'1':'P','2':'C','3':'1B','4':'2B','5':'3B','6':'SS',
           '7':'LF','8':'CF','9':'RF','10':'DH'}
LEVEL_NAME = {0:'MLB', 1:'AAA', 2:'AA', 3:'A/A+', 6:'Rookie', 7:'Draft'}


# ─────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────

def process_csvs(csv_dir: str, season: int) -> dict:
    """
    Read HHRecord CSVs from csv_dir, return processed data dict + meta.
    season = sim year (e.g. 2143)
    """
    players      = _load_players(csv_dir)
    career_bat   = _load_career_bat(csv_dir)
    career_pit   = _load_career_pit(csv_dir)
    year_bat     = _load_year_bat(csv_dir)
    year_pit     = _load_year_pit(csv_dir)
    park_factors = _compute_park_factors(csv_dir)

    hitters   = _build_hitters(players, career_bat, year_bat, park_factors)
    pitchers  = _build_pitchers(players, career_pit, park_factors)
    years     = _build_years(year_bat)
    prospects = _build_prospects(players, year_bat, year_pit, season)

    meta = {
        'season': season,
        'hitters': len(hitters),
        'pitchers': len(pitchers),
        'prospects': len(prospects),
        'parks': len(park_factors),
        'year_rows': len(years),
    }

    return {
        'data': {
            'hitters':      hitters,
            'pitchers':     pitchers,
            'years':        years,
            'prospects':    prospects,
            'park_factors': park_factors,
        },
        'meta': meta,
    }


# ─────────────────────────────────────────────
# LOADERS
# ─────────────────────────────────────────────

def _load_players(csv_dir):
    players = {}
    with open(os.path.join(csv_dir, 'Players.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            pid = int(row['id'])
            players[pid] = {
                'id':         pid,
                'name':       row['Name'].strip(),
                'pos':        POS_MAP.get(row['Pos'], row['Pos']),
                'pos_raw':    row['Pos'],
                'age':        int(row['Age']),
                'team':       int(row['Team']),
                'level':      int(row['Level']),
                'rookie_year': int(row['RookieYear']) + YEAR_OFFSET if row.get('RookieYear') else None,
                'ops_card':   float(row['OPS']) if row.get('OPS') else None,
                'bats':       row.get('Bats',''),
                'throws':     row.get('Throws',''),
            }
    return players


def _load_career_bat(csv_dir):
    data = {}
    with open(os.path.join(csv_dir, 'CareerBatStat.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            if int(row['level']) != 0: continue
            pid = int(row['ID'])
            data[pid] = {k: int(v) if v.lstrip('-').isdigit() else v
                         for k, v in row.items() if k != 'ID'}
            data[pid]['Team'] = int(row['Team'])
    return data


def _load_career_pit(csv_dir):
    data = {}
    with open(os.path.join(csv_dir, 'CareerPitStat.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            if int(row['level']) != 0: continue
            pid = int(row['ID'])
            data[pid] = {k: int(v) if v.lstrip('-').isdigit() else v
                         for k, v in row.items() if k != 'ID'}
    return data


def _load_year_bat(csv_dir):
    data = defaultdict(list)
    with open(os.path.join(csv_dir, 'YearAllBatStat.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            pid   = int(row['ID'])
            level = int(row['level'])
            ab    = int(row['ab']); h = int(row['h']); bb = int(row['bb'])
            hbp   = int(row['hbp']); sf = int(row['sf'])
            b2    = int(row['b2']); b3 = int(row['b3']); hr = int(row['hr'])
            tb    = (h - hr - b2 - b3) + 2*b2 + 3*b3 + 4*hr
            obp   = (h+bb+hbp)/(ab+bb+hbp+sf) if (ab+bb+hbp+sf) else 0
            slg   = tb/ab if ab else 0
            data[pid].append({
                'id':    pid,
                'year':  int(row['Year']) + YEAR_OFFSET,
                'level': level,
                'G':  int(row['g']),  'AB': ab,    'H':  h,
                'B2': b2,             'B3': b3,     'HR': hr,
                'BB': bb,             'SO': int(row['so']), 'RBI': int(row['rbi']),
                'SB': int(row['sb']), 'R':  int(row['r']),
                'HBP': hbp,           'SF': sf,
                'AVG': round(h/ab, 3) if ab else 0,
                'OBP': round(obp, 3),
                'SLG': round(slg, 3),
                'OPS': round(obp+slg, 3),
            })
    return data


def _load_year_pit(csv_dir):
    data = defaultdict(list)
    with open(os.path.join(csv_dir, 'YearAllPitStat.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            pid   = int(row['ID'])
            level = int(row['level'])
            ip    = int(row['ip']) / IP_DIVISOR
            if ip < 5: continue
            er = int(row['er']); h = int(row['h']); bb = int(row['bb']); k = int(row['k'])
            era  = round(er*9/ip, 2) if ip else 0
            whip = round((h+bb)/ip, 3) if ip else 0
            data[pid].append({
                'id':    pid,
                'year':  int(row['Year']) + YEAR_OFFSET,
                'level': level,
                'IP': round(ip,1), 'W': int(row['w']), 'L': int(row['l']),
                'SV': int(row['sv']), 'H': h, 'BB': bb, 'K': k,
                'ER': er, 'ERA': era, 'WHIP': whip,
            })
    return data


# ─────────────────────────────────────────────
# PARK FACTORS
# ─────────────────────────────────────────────

def _compute_park_factors(csv_dir):
    park_hr = defaultdict(lambda: {'ab': 0, 'hr': 0})
    with open(os.path.join(csv_dir, 'SeasonIndBat.csv'), encoding='utf-8', errors='replace') as f:
        for row in csv.DictReader(f):
            loc  = int(row['Loc'])
            team = int(row['Team'])
            opp  = int(row['OppTeam'])
            # park = home team ID
            park_id = team if loc == 0 else opp
            park_hr[park_id]['ab'] += int(row['AB'])
            park_hr[park_id]['hr'] += int(row['HR'])

    total_ab = sum(v['ab'] for v in park_hr.values())
    total_hr = sum(v['hr'] for v in park_hr.values())
    lg_rate  = total_hr / total_ab if total_ab else 1

    return {
        str(pid): round(v['hr']/v['ab']/lg_rate, 3)
        for pid, v in park_hr.items()
        if v['ab'] > 2000
    }


# ─────────────────────────────────────────────
# HITTERS
# ─────────────────────────────────────────────

def _build_hitters(players, career_bat, year_bat, park_factors):
    hitters = []
    for pid, cb in career_bat.items():
        p = players.get(pid)
        if not p: continue
        ab = cb.get('ab', 0); h = cb.get('h', 0); bb = cb.get('bb', 0)
        hbp = cb.get('hbp', 0); sf = cb.get('sf', 0)
        b2 = cb.get('b2', 0); b3 = cb.get('b3', 0); hr = cb.get('hr', 0)
        if ab < 100: continue
        tb  = (h - hr - b2 - b3) + 2*b2 + 3*b3 + 4*hr
        obp = (h+bb+hbp)/(ab+bb+hbp+sf) if (ab+bb+hbp+sf) else 0
        slg = tb/ab if ab else 0
        ops = obp + slg

        pf      = park_factors.get(str(p['team']), 1.0)
        hr_raw  = round(hr/ab, 4) if ab else 0
        hr_neut = round(hr_raw/pf, 4) if pf else hr_raw

        mlb_seasons = [y for y in year_bat.get(pid, []) if y['level'] == 0]

        hitters.append({
            'id':              pid,
            'name':            p['name'],
            'age':             p['age'],
            'pos':             p['pos'],
            'team':            f"Team {p['team']}",
            'team_id':         p['team'],
            'park_factor':     round(pf, 3),
            'seasons':         len(mlb_seasons),
            'G':   cb.get('g',0),   'AB': ab,    'H':  h,
            'B2':  b2,               'B3': b3,    'HR': hr,
            'R':   cb.get('r',0),    'RBI': cb.get('rbi',0),
            'BB':  bb,               'SO': cb.get('so',0),
            'SB':  cb.get('sb',0),
            'AVG': round(h/ab, 3) if ab else 0,
            'OBP': round(obp, 3),
            'SLG': round(slg, 3),
            'OPS': round(ops, 3),
            'hr_rate_raw':     hr_raw,
            'hr_rate_neutral': hr_neut,
        })

    hitters.sort(key=lambda x: -x['OPS'])
    return hitters


# ─────────────────────────────────────────────
# PITCHERS
# ─────────────────────────────────────────────

def _build_pitchers(players, career_pit, park_factors):
    pitchers = []
    for pid, cp in career_pit.items():
        p = players.get(pid)
        if not p: continue
        ip_outs = cp.get('ip', 0)
        ip = ip_outs / IP_DIVISOR
        if ip < 100: continue
        er = cp.get('er', 0); h = cp.get('h', 0); bb = cp.get('bb', 0); k = cp.get('k', 0)
        era  = round(er*9/ip, 2) if ip else 0
        whip = round((h+bb)/ip, 3) if ip else 0
        k9   = round(k*9/ip, 2) if ip else 0
        ops_against = round(p['ops_card'], 3) if p.get('ops_card') else None

        pitchers.append({
            'id':          pid,
            'name':        p['name'],
            'age':         p['age'],
            'team':        f"Team {p['team']}",
            'team_id':     p['team'],
            'G':   cp.get('g',0),   'GS': cp.get('gs',0),
            'IP':  round(ip, 1),    'W':  cp.get('w',0),   'L': cp.get('l',0),
            'SV':  cp.get('sv',0),  'HLD': cp.get('hld',0),
            'CG':  cp.get('cg',0),  'SHO': cp.get('sho',0),
            'QS':  cp.get('qs',0),
            'H':   h,   'HR': cp.get('hr',0), 'BB': bb,
            'K':   k,   'ER': er,
            'ERA': era, 'WHIP': whip, 'K9': k9,
            'OPS_against': ops_against,
        })

    pitchers.sort(key=lambda x: x['ERA'])
    return pitchers


# ─────────────────────────────────────────────
# YEAR-BY-YEAR (for player panels + career sim)
# ─────────────────────────────────────────────

def _build_years(year_bat):
    rows = []
    for pid, seasons in year_bat.items():
        for s in seasons:
            if s['level'] == 0:
                rows.append(s)
    return rows


# ─────────────────────────────────────────────
# PROSPECTS
# ─────────────────────────────────────────────

def _build_prospects(players, year_bat, year_pit, current_season):
    prospects = []
    for pid, p in players.items():
        level = p['level']
        team  = p['team']
        age   = p['age']
        if team == 255: continue   # free agents
        if level == 0: continue    # MLB
        if level == 1 and age > 30: continue  # journeyman AAA
        if age > 29: continue

        ops_card = p['ops_card'] or 0
        is_pitcher = p['pos'] == 'P'

        # ETA model
        levels_to_mlb = {1: 1, 2: 2, 3: 3, 6: 4, 7: 5}
        remaining = levels_to_mlb.get(level, 2)

        if is_pitcher:
            # Lower OPS-against = better talent
            if ops_card <= 0.65:   ypl = 1.0
            elif ops_card <= 0.70: ypl = 1.3
            elif ops_card <= 0.75: ypl = 1.6
            else:                  ypl = 2.0
        else:
            if ops_card >= 1.0:    ypl = 1.0
            elif ops_card >= 0.90: ypl = 1.3
            elif ops_card >= 0.85: ypl = 1.6
            elif ops_card >= 0.80: ypl = 1.9
            else:                  ypl = 2.3

        eta_raw  = current_season + remaining * ypl
        eta_age  = age + remaining * ypl

        # Age floors
        if not is_pitcher and ops_card < 0.85 and eta_age < 23:
            eta_age = 23; eta_raw = current_season + (23 - age)
        if not is_pitcher and ops_card >= 0.95 and eta_age < 21:
            eta_age = 21; eta_raw = current_season + (21 - age)

        # Best recent MiLB hitting stats
        last_mil_ops = last_mil_ab = hr_last = None
        mil_hits = sorted(
            [y for y in year_bat.get(pid, []) if y['level'] in (1,2,3)],
            key=lambda x: x['year'], reverse=True
        )
        if mil_hits:
            best = mil_hits[0]
            if best['AB'] >= 50:
                last_mil_ops = best['OPS']
                last_mil_ab  = best['AB']
                hr_last      = best['HR']

        # Best recent MiLB pitching stats
        last_era = last_ip = last_whip = last_k = None
        mil_pit = sorted(
            [y for y in year_pit.get(pid, []) if y['level'] in (1,2,3)],
            key=lambda x: x['year'], reverse=True
        )
        if mil_pit:
            best = mil_pit[0]
            if best['IP'] >= 20:
                last_era  = best['ERA']
                last_ip   = best['IP']
                last_whip = best['WHIP']
                last_k    = best['K']

        prospects.append({
            'id':           pid,
            'name':         p['name'],
            'age':          age,
            'level':        level,
            'level_name':   LEVEL_NAME.get(level, str(level)),
            'team':         team,
            'pos':          p['pos'],
            'ops_card':     round(ops_card, 3),
            'eta_year':     round(eta_raw, 1),
            'eta_age':      round(eta_age, 1),
            'mil_seasons':  len(mil_hits),
            'last_mil_ops': round(last_mil_ops, 3) if last_mil_ops else None,
            'last_mil_ab':  last_mil_ab,
            'hr_last':      hr_last,
            'last_mil_year': mil_hits[0]['year'] if mil_hits else None,
            'last_era':     round(last_era, 2) if last_era else None,
            'last_ip':      last_ip,
            'last_whip':    round(last_whip, 3) if last_whip else None,
            'last_k':       last_k,
        })

    prospects.sort(key=lambda x: x['ops_card'] if x['pos'] == 'P' else -x['ops_card'])
    return prospects


# ─────────────────────────────────────────────
# DASHBOARD BUILDER
# ─────────────────────────────────────────────

def build_dashboard(season: int):
    """Rebuild index.html from current data + src files."""
    # Load data
    def load(name):
        return json.load(open(os.path.join(CURRENT_DIR, f'{name}.json')))

    hitters      = load('hitters')
    pitchers     = load('pitchers')
    years        = load('years')
    prospects    = load('prospects')
    park_factors = load('park_factors')

    # Build year_by_player index
    year_by_player = defaultdict(list)
    for row in years:
        year_by_player[str(row['id'])].append(row)

    # Load all historical seasons for the multi-season selector
    seasons_meta = []
    for d in sorted(os.listdir(SEASONS_DIR), reverse=True):
        meta_path = os.path.join(SEASONS_DIR, d, 'meta.json')
        if os.path.exists(meta_path):
            seasons_meta.append(json.load(open(meta_path)))

    js_data = '\n'.join([
        f"const SEASON = {season};",
        f"const SEASONS_META = {json.dumps(seasons_meta)};",
        f"const HITTERS = {json.dumps(hitters)};",
        f"const PITCHERS = {json.dumps(pitchers)};",
        f"const YEAR_DATA = {json.dumps(dict(year_by_player))};",
        f"const PARK_FACTORS = {json.dumps({int(k): v for k,v in park_factors.items()})};",
        f"const PROSPECTS = {json.dumps(prospects)};",
    ])

    css       = open(os.path.join(SRC_DIR, 'dash_css.css')).read()
    js_main   = open(os.path.join(SRC_DIR, 'dash_js.js')).read()
    js_pros   = open(os.path.join(SRC_DIR, 'dash_js_prospects.js')).read()

    js_main = js_main.replace(
        '  filterBat();\n  filterPit();\n}',
        '  filterBat();\n  filterPit();\n  initProspects();\n  filterProspects();\n}'
    )

    html = _html_shell(season, css, js_data, js_main, js_pros)
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        f.write(html)
    return INDEX_PATH


def _html_shell(season, css, js_data, js_main, js_pros):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MLBC Command &mdash; Season {season}</title>
<style>{css}</style>
</head>
<body>
<div class="header">
  <div>
    <div class="header-logo">MLBC COMMAND</div>
    <div class="header-sub">High Heat &mdash; Engine Cycle 2102&ndash;</div>
  </div>
  <div style="display:flex;align-items:center;gap:20px;">
    <select id="season-select" onchange="switchSeason(this.value)" style="background:#181c24;border:1px solid #252a35;color:#e8a020;font-family:'IBM Plex Mono',monospace;font-size:13px;padding:6px 10px;border-radius:4px;cursor:pointer;"></select>
    <div class="header-season">SEASON {season}</div>
  </div>
</div>
<div class="nav">
  <div class="nav-tab active" onclick="showPage('batting',this)">&#9918; BATTING</div>
  <div class="nav-tab" onclick="showPage('pitching',this)">&#9889; PITCHING</div>
  <div class="nav-tab" onclick="showPage('parks',this)">&#127966; PARKS</div>
  <div class="nav-tab" onclick="showPage('prospects',this)">&#11088; PROSPECTS</div>
  <div class="nav-tab" onclick="showPage('sim',this)">&#128200; CAREER SIM</div>
</div>
<div class="main">

<div id="page-batting" class="page active">
  <div class="cards">
    <div class="card"><div class="card-label">Active Hitters</div><div class="card-value" id="stat-hitters">&#8212;</div><div class="card-sub">100+ AB</div></div>
    <div class="card blue"><div class="card-label">Avg OPS</div><div class="card-value" id="stat-avg-ops">&#8212;</div><div class="card-sub">league average</div></div>
    <div class="card green"><div class="card-label">Top OPS</div><div class="card-value" id="stat-top-ops">&#8212;</div><div class="card-sub" id="stat-top-ops-name">&#8212;</div></div>
    <div class="card red"><div class="card-label">Most HR</div><div class="card-value" id="stat-top-hr">&#8212;</div><div class="card-sub" id="stat-top-hr-name">&#8212;</div></div>
    <div class="card"><div class="card-label">Most Hits</div><div class="card-value" id="stat-top-h">&#8212;</div><div class="card-sub" id="stat-top-h-name">&#8212;</div></div>
  </div>
  <div class="controls">
    <input class="search-box" type="text" id="bat-search" placeholder="Search player..." oninput="filterBat()">
    <select class="filter" id="bat-pos" onchange="filterBat()">
      <option value="">All Positions</option>
      <option>C</option><option>1B</option><option>2B</option><option>3B</option>
      <option>SS</option><option>LF</option><option>CF</option><option>RF</option><option>DH</option>
    </select>
    <select class="filter" id="bat-sort" onchange="filterBat()">
      <option value="OPS">Sort: OPS</option><option value="HR">Sort: HR</option>
      <option value="H">Sort: Hits</option><option value="RBI">Sort: RBI</option>
      <option value="R">Sort: Runs</option><option value="AVG">Sort: AVG</option>
      <option value="SB">Sort: SB</option><option value="G">Sort: Games</option>
      <option value="age">Sort: Age</option>
    </select>
    <span class="sort-label" id="bat-count"></span>
  </div>
  <div class="table-wrap"><div class="table-scroll">
    <table><thead><tr>
      <th>#</th><th>Name</th><th>Age</th><th>Pos</th><th>Team</th>
      <th class="pf-col" title="Park Factor">PF</th>
      <th>Seas</th><th>G</th><th>AB</th><th>H</th><th>2B</th><th>3B</th>
      <th>HR</th><th>R</th><th>RBI</th><th>BB</th><th>SO</th><th>SB</th>
      <th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th>
    </tr></thead><tbody id="bat-tbody"></tbody></table>
  </div><div class="pagination" id="bat-pagination"></div></div>
</div>

<div id="page-pitching" class="page">
  <div class="cards">
    <div class="card"><div class="card-label">Active Pitchers</div><div class="card-value" id="stat-pitchers">&#8212;</div><div class="card-sub">100+ IP</div></div>
    <div class="card blue"><div class="card-label">Top ERA</div><div class="card-value" id="stat-top-era">&#8212;</div><div class="card-sub" id="stat-top-era-name">&#8212;</div></div>
    <div class="card green"><div class="card-label">Most Wins</div><div class="card-value" id="stat-top-w">&#8212;</div><div class="card-sub" id="stat-top-w-name">&#8212;</div></div>
    <div class="card red"><div class="card-label">Most K</div><div class="card-value" id="stat-top-k">&#8212;</div><div class="card-sub" id="stat-top-k-name">&#8212;</div></div>
    <div class="card"><div class="card-label">Most Saves</div><div class="card-value" id="stat-top-sv">&#8212;</div><div class="card-sub" id="stat-top-sv-name">&#8212;</div></div>
  </div>
  <div class="controls">
    <input class="search-box" type="text" id="pit-search" placeholder="Search pitcher..." oninput="filterPit()">
    <select class="filter" id="pit-role" onchange="filterPit()">
      <option value="">All Roles</option><option value="SP">Starters (SP)</option>
      <option value="RP">Relievers (RP)</option><option value="CL">Closers (SV&#8805;20)</option>
    </select>
    <select class="filter" id="pit-sort" onchange="filterPit()">
      <option value="ERA">Sort: ERA</option><option value="W">Sort: Wins</option>
      <option value="K">Sort: Strikeouts</option><option value="IP">Sort: IP</option>
      <option value="WHIP">Sort: WHIP</option><option value="K9">Sort: K/9</option>
      <option value="SV">Sort: Saves</option>
      <option value="OPS_against">Sort: OPS-vs</option>
    </select>
    <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a6070;cursor:pointer;display:flex;align-items:center;gap:6px;">
      <input type="checkbox" id="pit-qualified" onchange="filterPit()"> Qualified only
    </label>
    <span class="sort-label" id="pit-count"></span>
  </div>
  <div class="table-wrap"><div class="table-scroll">
    <table><thead><tr>
      <th>#</th><th>Name</th><th>Age</th><th>G</th><th>GS</th><th>IP</th>
      <th>W</th><th>L</th><th>SV</th><th>HLD</th><th>CG</th><th>SHO</th>
      <th>H</th><th>HR</th><th>BB</th><th>K</th>
      <th>ERA</th><th>WHIP</th><th>K/9</th><th title="OPS Against">OPS-vs</th>
    </tr></thead><tbody id="pit-tbody"></tbody></table>
  </div><div class="pagination" id="pit-pagination"></div></div>
</div>

<div id="page-parks" class="page">
  <div class="cards">
    <div class="card green"><div class="card-label">Most HR-Friendly</div><div class="card-value" id="park-top">&#8212;</div><div class="card-sub" id="park-top-sub">&#8212;</div></div>
    <div class="card red"><div class="card-label">Most Pitcher-Friendly</div><div class="card-value" id="park-bot">&#8212;</div><div class="card-sub" id="park-bot-sub">&#8212;</div></div>
    <div class="card blue"><div class="card-label">League Avg HR/AB</div><div class="card-value" id="park-avg-hr">&#8212;</div><div class="card-sub">all parks</div></div>
  </div>
  <div class="park-grid" id="park-grid"></div>
  <div style="margin-top:12px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5a6070;letter-spacing:1px;">
    * Park factors from season {season - 1} game logs. PF &gt; 1.0 = hitter-friendly.
  </div>
</div>

<div id="page-prospects" class="page">
  <div class="cards">
    <div class="card"><div class="card-label">Total Prospects</div><div class="card-value" id="pros-total">&#8212;</div><div class="card-sub">in system</div></div>
    <div class="card green"><div class="card-label">Elite (80 grade)</div><div class="card-value" id="pros-elite">&#8212;</div><div class="card-sub">H: OPS 1.000+ / P: OPS-vs &le;.650</div></div>
    <div class="card blue"><div class="card-label">Plus (70 grade)</div><div class="card-value" id="pros-plus">&#8212;</div><div class="card-sub">H: OPS .930+ / P: OPS-vs &le;.700</div></div>
    <div class="card red"><div class="card-label">ETA This Year</div><div class="card-value" id="pros-eta-now">&#8212;</div><div class="card-sub" id="pros-eta-label">&#8212;</div></div>
  </div>
  <div class="prospect-controls">
    <input class="search-box" type="text" id="pros-search" placeholder="Search prospect..." oninput="filterProspects()">
    <select class="filter" id="pros-pos" onchange="filterProspects()">
      <option value="">All Positions</option>
      <option value="H">Hitters only</option><option value="P">Pitchers only</option>
      <option>C</option><option>1B</option><option>2B</option><option>3B</option>
      <option>SS</option><option>LF</option><option>CF</option><option>RF</option>
    </select>
    <select class="filter" id="pros-team" onchange="filterProspects()">
      <option value="">All Teams</option>
    </select>
    <select class="filter" id="pros-eta" onchange="filterProspects()">
      <option value="">Any ETA</option>
      <option value="0">Ready NOW</option>
      <option value="2">Within 2 years</option>
      <option value="3">Within 3 years</option>
      <option value="4">Within 4 years</option>
    </select>
    <select class="filter" id="pros-sort" onchange="filterProspects()">
      <option value="ops_card">Sort: Grade (card)</option>
      <option value="mil_ops">Sort: MiLB OPS (hitters)</option>
      <option value="era">Sort: ERA (pitchers)</option>
      <option value="eta">Sort: ETA (soonest)</option>
      <option value="age">Sort: Age (youngest)</option>
      <option value="level">Sort: Level (highest)</option>
    </select>
    <span class="sort-label" id="pros-count"></span>
  </div>
  <div class="prospect-grid" id="prospect-grid"></div>
  <div class="pagination" id="pros-pagination"></div>
</div>

<div id="page-sim" class="page">
  <div class="sim-layout">
    <div class="sim-panel">
      <div class="sim-title">Career Projector</div>
      <div class="sim-field">
        <label>Select Player</label>
        <select id="sim-player-select" onchange="onSimPlayerChange()">
          <option value="">&#8212; Choose a player &#8212;</option>
        </select>
      </div>
      <div id="sim-player-info" style="display:none;margin-bottom:16px;padding:12px;background:#181c24;border-radius:6px;border:1px solid #252a35;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5a6070;letter-spacing:1px;margin-bottom:6px;">CURRENT PARK</div>
        <div id="sim-park-display" style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#e8a020;"></div>
        <div id="sim-park-factor" style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#d4d8e0;margin-top:4px;"></div>
      </div>
      <div class="sim-field">
        <label>Project Through Age</label>
        <input type="number" id="sim-retire-age" value="38" min="28" max="45">
      </div>
      <div class="sim-field">
        <label>Park for Projection</label>
        <select id="sim-park-select">
          <option value="-1">Same as current park</option>
        </select>
      </div>
      <div style="margin:16px 0 12px;border-top:1px solid #252a35;padding-top:16px;">
        <div class="section-title">Aging Assumptions</div>
      </div>
      <div class="assumption-row">
        <div class="assumption-label">Baseline Yrs</div>
        <input type="range" id="sim-baseline-yrs" min="1" max="7" value="3" oninput="updateSliderVal('sim-baseline-yrs','baseline-yrs-val',' yrs')">
        <div class="assumption-val" id="baseline-yrs-val">3 yrs</div>
      </div>
      <div class="assumption-row">
        <div class="assumption-label">Peak Age</div>
        <input type="range" id="sim-peak-age" min="25" max="32" value="28" oninput="updateSliderVal('sim-peak-age','peak-age-val','')">
        <div class="assumption-val" id="peak-age-val">28</div>
      </div>
      <div class="assumption-row">
        <div class="assumption-label">Peak Duration</div>
        <input type="range" id="sim-peak-dur" min="1" max="6" value="3" oninput="updateSliderVal('sim-peak-dur','peak-dur-val',' yrs')">
        <div class="assumption-val" id="peak-dur-val">3 yrs</div>
      </div>
      <div class="assumption-row">
        <div class="assumption-label">Decline Rate</div>
        <input type="range" id="sim-decline" min="1" max="10" value="3" oninput="updateSliderVal('sim-decline','decline-val','%')">
        <div class="assumption-val" id="decline-val">3%</div>
      </div>
      <div class="assumption-row">
        <div class="assumption-label">Games/Season</div>
        <input type="range" id="sim-games" min="100" max="162" value="150" oninput="updateSliderVal('sim-games','games-val','')">
        <div class="assumption-val" id="games-val">150</div>
      </div>
      <button class="btn-run" onclick="runSim()">&#9654; RUN PROJECTION</button>
    </div>
    <div class="sim-results">
      <div id="sim-output">
        <div class="sim-empty"><span class="sim-empty-icon">&#128202;</span>Select a player and run a projection</div>
      </div>
    </div>
  </div>
</div>

</div>
<div class="panel-overlay" id="panel-overlay" onclick="closePanel()"></div>
<div class="panel" id="player-panel">
  <div class="panel-header">
    <div>
      <div class="panel-name" id="panel-name">&#8212;</div>
      <div class="panel-meta" id="panel-meta">&#8212;</div>
    </div>
    <button class="panel-close" onclick="closePanel()">&#x2715;</button>
  </div>
  <div class="panel-body" id="panel-body"></div>
</div>
<script>
{js_data}
{js_main}
{js_pros}
// Season selector
(function() {{
  var sel = document.getElementById('season-select');
  SEASONS_META.forEach(function(m) {{
    var o = document.createElement('option');
    o.value = m.season;
    o.textContent = 'Season ' + m.season;
    if (m.season === SEASON) o.selected = true;
    sel.appendChild(o);
  }});
}})();
function switchSeason(s) {{
  if (parseInt(s) !== SEASON) window.location.href = '/season/' + s;
}}
// Prospect ETA label
document.getElementById('pros-eta-label').textContent = 'projected MLB ready ' + SEASON;
// Prospect summary cards
document.getElementById('pros-total').textContent = PROSPECTS.length;
document.getElementById('pros-elite').textContent = PROSPECTS.filter(function(p){{return p.pos==='P' ? p.ops_card<=0.650 : p.ops_card>=1.0;}}).length;
document.getElementById('pros-plus').textContent = PROSPECTS.filter(function(p){{return p.pos==='P' ? p.ops_card<=0.700 : p.ops_card>=0.93;}}).length;
document.getElementById('pros-eta-now').textContent = PROSPECTS.filter(function(p){{return p.eta_year<=SEASON;}}).length;
</script>
</body>
</html>"""

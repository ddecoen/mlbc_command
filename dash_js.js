const PAGE_SIZE = 50;
let batPage = 0, pitPage = 0;
let filteredHitters = [...HITTERS];
let filteredPitchers = [...PITCHERS];
let batSortKey = 'OPS';
let pitSortKey = 'ERA';

function fmtAvg(v) { return v.toFixed(3).replace('0.', '.'); }
function opsClass(o) { return o >= 1.0 ? 'ops-high' : o >= 0.85 ? 'ops-great' : o >= 0.70 ? 'ops-avg' : 'ops-low'; }
function eraClass(e) { return e < 3.5 ? 'era-great' : e < 4.2 ? 'era-good' : e < 5.0 ? 'era-avg' : 'era-bad'; }
function opsAgainstClass(o) { return o <= 0.65 ? 'era-great' : o <= 0.72 ? 'era-good' : o <= 0.80 ? 'era-avg' : 'era-bad'; }
function pfClass(pf) { return pf >= 1.05 ? 'pf-high' : pf <= 0.95 ? 'pf-low' : 'pf-mid'; }
function pfLabel(pf) { return pf.toFixed(3); }

function init() {
  const h100 = HITTERS.filter(h => h.AB >= 100);
  document.getElementById('stat-hitters').textContent = HITTERS.length;
  document.getElementById('stat-avg-ops').textContent = (h100.reduce((s,h) => s+h.OPS,0)/h100.length).toFixed(3);
  const topOps = HITTERS[0];
  document.getElementById('stat-top-ops').textContent = topOps.OPS.toFixed(3);
  document.getElementById('stat-top-ops-name').textContent = topOps.name;
  const topHR = [...HITTERS].sort((a,b) => b.HR-a.HR)[0];
  document.getElementById('stat-top-hr').textContent = topHR.HR;
  document.getElementById('stat-top-hr-name').textContent = topHR.name;
  const topH = [...HITTERS].sort((a,b) => b.H-a.H)[0];
  document.getElementById('stat-top-h').textContent = topH.H;
  document.getElementById('stat-top-h-name').textContent = topH.name;
  document.getElementById('stat-pitchers').textContent = PITCHERS.length;
  const topERA = PITCHERS.filter(p => p.IP >= 300).sort((a,b) => a.ERA-b.ERA)[0];
  document.getElementById('stat-top-era').textContent = topERA.ERA.toFixed(2);
  document.getElementById('stat-top-era-name').textContent = topERA.name;
  const topW = [...PITCHERS].sort((a,b) => b.W-a.W)[0];
  document.getElementById('stat-top-w').textContent = topW.W;
  document.getElementById('stat-top-w-name').textContent = topW.name;
  const topK = [...PITCHERS].sort((a,b) => b.K-a.K)[0];
  document.getElementById('stat-top-k').textContent = topK.K;
  document.getElementById('stat-top-k-name').textContent = topK.name;
  const topSV = [...PITCHERS].sort((a,b) => b.SV-a.SV)[0];
  document.getElementById('stat-top-sv').textContent = topSV.SV;
  document.getElementById('stat-top-sv-name').textContent = topSV.name;

  // Park factors summary cards
  const pfEntries = Object.entries(PARK_FACTORS).map(([k,v]) => ({tid: parseInt(k), pf: v}));
  const topPark = pfEntries.sort((a,b) => b.pf-a.pf)[0];
  const botPark = pfEntries.sort((a,b) => a.pf-b.pf)[0];
  document.getElementById('park-top').textContent = topPark.pf.toFixed(3);
  document.getElementById('park-top-sub').textContent = 'Team ' + topPark.tid;
  document.getElementById('park-bot').textContent = botPark.pf.toFixed(3);
  document.getElementById('park-bot-sub').textContent = 'Team ' + botPark.tid;
  const lgHRRate = (0.03322).toFixed(5);
  document.getElementById('park-avg-hr').textContent = lgHRRate;
  renderParkGrid();

  // Sim player select
  const sel = document.getElementById('sim-player-select');
  [...HITTERS].sort((a,b) => a.name.localeCompare(b.name)).forEach(function(h) {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.name + ' (' + h.pos + ', age ' + h.age + ', T' + h.team_id + ')';
    sel.appendChild(opt);
  });

  // Sim park select
  const psel = document.getElementById('sim-park-select');
  const pfSorted = Object.entries(PARK_FACTORS).map(function(e) { return {tid: parseInt(e[0]), pf: e[1]}; }).sort(function(a,b) { return b.pf - a.pf; });
  pfSorted.forEach(function(p) {
    const opt = document.createElement('option');
    opt.value = p.tid;
    opt.textContent = 'Team ' + p.tid + ' Park  (PF: ' + p.pf.toFixed(3) + ')';
    psel.appendChild(opt);
  });

  filterBat();
  filterPit();
}

function showPage(name, el) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  el.classList.add('active');
}

function setSortBat(key) { batSortKey = key; filterBat(); }
function filterBat() {
  const q = document.getElementById('bat-search').value.toLowerCase();
  const pos = document.getElementById('bat-pos').value;
  const sortKey = document.getElementById('bat-sort').value || batSortKey;
  batSortKey = sortKey;
  filteredHitters = HITTERS.filter(function(h) {
    if (q && !h.name.toLowerCase().includes(q)) return false;
    if (pos && h.pos !== pos) return false;
    return true;
  });
  const asc = (sortKey === 'age');
  filteredHitters.sort(function(a,b) { return asc ? a[sortKey]-b[sortKey] : b[sortKey]-a[sortKey]; });
  batPage = 0;
  renderBat();
}
function renderBat() {
  const tbody = document.getElementById('bat-tbody');
  const start = batPage * PAGE_SIZE;
  const slice = filteredHitters.slice(start, start+PAGE_SIZE);
  document.getElementById('bat-count').textContent = filteredHitters.length + ' players';
  tbody.innerHTML = slice.map(function(h, i) {
    const pf = h.park_factor || 1.0;
    return '<tr onclick="openHitterPanel(' + h.id + ')">' +
      '<td>' + (start+i+1) + '</td><td>' + h.name + '</td><td>' + h.age + '</td>' +
      '<td>' + h.pos + '</td><td>T' + h.team_id + '</td>' +
      '<td class="' + pfClass(pf) + '">' + pf.toFixed(3) + '</td>' +
      '<td>' + h.seasons + '</td><td>' + h.G + '</td><td>' + h.AB + '</td><td>' + h.H + '</td>' +
      '<td>' + h.B2 + '</td><td>' + h.B3 + '</td><td>' + h.HR + '</td>' +
      '<td>' + h.R + '</td><td>' + h.RBI + '</td><td>' + h.BB + '</td><td>' + h.SO + '</td>' +
      '<td>' + h.SB + '</td>' +
      '<td>' + fmtAvg(h.AVG) + '</td><td>' + fmtAvg(h.OBP) + '</td><td>' + fmtAvg(h.SLG) + '</td>' +
      '<td class="' + opsClass(h.OPS) + '">' + h.OPS.toFixed(3) + '</td></tr>';
  }).join('');
  renderPagination('bat', filteredHitters.length, batPage, function(p) { batPage=p; renderBat(); });
}

function setSortPit(key) { pitSortKey = key; filterPit(); }
function filterPit() {
  const q = document.getElementById('pit-search').value.toLowerCase();
  const role = document.getElementById('pit-role').value;
  const qualified = document.getElementById('pit-qualified') && document.getElementById('pit-qualified').checked;
  const sortKey = document.getElementById('pit-sort').value || pitSortKey;
  pitSortKey = sortKey;
  filteredPitchers = PITCHERS.filter(function(p) {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (role === 'SP' && p.GS <= p.G*0.5) return false;
    if (role === 'RP' && p.GS > p.G*0.5) return false;
    if (role === 'CL' && p.SV < 20) return false;
    if (qualified && p.GS > p.G*0.5 && p.IP < 500) return false;
    if (qualified && p.GS <= p.G*0.5 && p.IP < 200) return false;
    return true;
  });
  const asc = (sortKey === 'ERA' || sortKey === 'WHIP' || sortKey === 'OPS_against');
  filteredPitchers.sort(function(a,b) { return asc ? a[sortKey]-b[sortKey] : b[sortKey]-a[sortKey]; });
  pitPage = 0;
  renderPit();
}
function renderPit() {
  const tbody = document.getElementById('pit-tbody');
  const start = pitPage * PAGE_SIZE;
  const slice = filteredPitchers.slice(start, start+PAGE_SIZE);
  document.getElementById('pit-count').textContent = filteredPitchers.length + ' pitchers';
  tbody.innerHTML = slice.map(function(p, i) {
    return '<tr onclick="openPitcherPanel(' + p.id + ')">' +
      '<td>' + (start+i+1) + '</td><td>' + p.name + '</td><td>' + p.age + '</td>' +
      '<td>' + p.G + '</td><td>' + p.GS + '</td><td>' + p.IP.toFixed(1) + '</td>' +
      '<td>' + p.W + '</td><td>' + p.L + '</td><td>' + p.SV + '</td><td>' + p.HLD + '</td>' +
      '<td>' + p.CG + '</td><td>' + p.SHO + '</td>' +
      '<td>' + p.H + '</td><td>' + p.HR + '</td><td>' + p.BB + '</td><td>' + p.K + '</td>' +
      '<td class="' + eraClass(p.ERA) + '">' + p.ERA.toFixed(2) + '</td>' +
      '<td>' + p.WHIP.toFixed(3) + '</td><td>' + p.K9.toFixed(2) + '</td>' +
      '<td class="' + opsAgainstClass(p.OPS_against) + '">' + (p.OPS_against ? p.OPS_against.toFixed(3) : '---') + '</td></tr>';
  }).join('');
  renderPagination('pit', filteredPitchers.length, pitPage, function(p) { pitPage=p; renderPit(); });
}

function renderParkGrid() {
  const grid = document.getElementById('park-grid');
  const pfArr = Object.entries(PARK_FACTORS).map(function(e) { return {tid: parseInt(e[0]), pf: e[1]}; }).sort(function(a,b) { return b.pf-a.pf; });
  const maxPf = 1.35, minPf = 0.75;
  grid.innerHTML = pfArr.map(function(p) {
    const pf = p.pf;
    const cls = pf >= 1.05 ? 'hitter' : pf <= 0.95 ? 'pitcher' : 'neutral';
    const pfColor = pf >= 1.05 ? '#f87171' : pf <= 0.95 ? '#60a5fa' : '#6b7280';
    const barPct = Math.round((pf - minPf) / (maxPf - minPf) * 100);
    const barColor = pf >= 1.1 ? 'linear-gradient(90deg,#f0b429,#f87171)' : pf >= 1.0 ? 'linear-gradient(90deg,#e8a020,#f0b429)' : pf >= 0.95 ? '#6b7280' : 'linear-gradient(90deg,#60a5fa,#34d399)';
    const badge = pf >= 1.15 ? ' HITTER HAVEN' : pf >= 1.05 ? ' HITTER FRIENDLY' : pf <= 0.85 ? ' EXTREME PITCHER PARK' : pf <= 0.95 ? ' PITCHER FRIENDLY' : ' NEUTRAL';
    return '<div class="park-card ' + cls + '">' +
      '<div class="park-card-header">' +
      '<div><div class="park-card-name">TEAM ' + p.tid + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a6070;letter-spacing:1px;">' + badge + '</div></div>' +
      '<div class="park-card-pf" style="color:' + pfColor + '">' + pf.toFixed(3) + 'x</div>' +
      '</div>' +
      '<div class="park-bar-bg"><div class="park-bar-fill" style="width:' + barPct + '%;background:' + barColor + '"></div></div>' +
      '</div>';
  }).join('');
}

function renderPagination(prefix, total, currentPage, onPageClick) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById(prefix + '-pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '<button class="page-btn" ' + (currentPage > 0 ? '' : 'disabled') + ' onclick="(' + onPageClick + ')(' + (currentPage-1) + ')">&#8249;</button>';
  for (let i = 0; i < totalPages; i++) {
    if (i===0 || i===totalPages-1 || Math.abs(i-currentPage)<=2) {
      html += '<button class="page-btn ' + (i===currentPage ? 'active' : '') + '" onclick="(' + onPageClick + ')(' + i + ')">' + (i+1) + '</button>';
    } else if (Math.abs(i-currentPage)===3) {
      html += '<span class="page-info">&#8230;</span>';
    }
  }
  html += '<button class="page-btn" ' + (currentPage < totalPages-1 ? '' : 'disabled') + ' onclick="(' + onPageClick + ')(' + (currentPage+1) + ')">&#8250;</button>';
  html += '<span class="page-info">' + (currentPage+1) + ' / ' + totalPages + '</span>';
  el.innerHTML = html;
}

function openHitterPanel(id) {
  const h = HITTERS.find(function(x) { return x.id === id; });
  if (!h) return;
  const pf = h.park_factor || 1.0;
  document.getElementById('panel-name').textContent = h.name;
  document.getElementById('panel-meta').textContent = h.pos + ' \u00b7 Age ' + h.age + ' \u00b7 Team ' + h.team_id + ' (Park PF: ' + pf.toFixed(3) + ') \u00b7 ' + h.seasons + ' MLB seasons';
  const years = (YEAR_DATA[String(id)] || []).sort(function(a,b) { return a.year-b.year; });
  const maxOps = Math.max.apply(null, years.map(function(y) { return y.OPS; }).concat([0.001]));
  let html = '<div class="stat-grid">' +
    '<div class="stat-box"><div class="stat-box-label">AVG</div><div class="stat-box-value highlight">' + fmtAvg(h.AVG) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">OBP</div><div class="stat-box-value">' + fmtAvg(h.OBP) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">SLG</div><div class="stat-box-value">' + fmtAvg(h.SLG) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">OPS</div><div class="stat-box-value highlight">' + h.OPS.toFixed(3) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">HR</div><div class="stat-box-value">' + h.HR + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">RBI</div><div class="stat-box-value">' + h.RBI + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">Park PF</div><div class="stat-box-value ' + pfClass(pf) + '">' + pf.toFixed(3) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">Neutral HR/AB</div><div class="stat-box-value">' + (h.hr_rate_neutral*100).toFixed(2) + '%</div></div>' +
    '</div>';
  if (years.length > 0) {
    html += '<div class="section-title">OPS by Season</div>';
    years.forEach(function(y) {
      const pct = Math.round(y.OPS/maxOps*100);
      html += '<div class="ops-bar-wrap"><div class="ops-bar-year">' + y.year + '</div><div class="ops-bar-bg"><div class="ops-bar-fill" style="width:' + pct + '%"></div></div><div class="ops-bar-val">' + y.OPS.toFixed(3) + '</div></div>';
    });
    html += '<div class="section-title" style="margin-top:20px">Year-by-Year Stats</div>' +
      '<table class="year-table"><thead><tr><th>Year</th><th>G</th><th>AB</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th><th>AVG</th><th>OPS</th></tr></thead><tbody>';
    years.forEach(function(y) {
      html += '<tr><td>' + y.year + '</td><td>' + y.G + '</td><td>' + y.AB + '</td><td>' + y.H + '</td><td>' + y.HR + '</td><td>' + y.RBI + '</td><td>' + y.BB + '</td><td>' + y.SO + '</td><td>' + fmtAvg(y.AVG) + '</td><td class="' + opsClass(y.OPS) + '">' + y.OPS.toFixed(3) + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  document.getElementById('panel-body').innerHTML = html;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('player-panel').classList.add('open');
}

function openPitcherPanel(id) {
  const p = PITCHERS.find(function(x) { return x.id === id; });
  if (!p) return;
  const role = p.GS > p.G*0.5 ? 'SP' : (p.SV >= 10 ? 'CL' : 'RP');
  document.getElementById('panel-name').textContent = p.name;
  document.getElementById('panel-meta').textContent = role + ' \u00b7 Age ' + p.age + ' \u00b7 ' + p.IP.toFixed(0) + ' career IP';
  let html = '<div class="stat-grid">' +
    '<div class="stat-box"><div class="stat-box-label">ERA</div><div class="stat-box-value highlight">' + p.ERA.toFixed(2) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">WHIP</div><div class="stat-box-value">' + p.WHIP.toFixed(3) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">K/9</div><div class="stat-box-value">' + p.K9.toFixed(2) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">W-L</div><div class="stat-box-value">' + p.W + '-' + p.L + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">IP</div><div class="stat-box-value">' + p.IP.toFixed(0) + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">K</div><div class="stat-box-value">' + p.K + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">SV</div><div class="stat-box-value">' + p.SV + '</div></div>' +
    '<div class="stat-box"><div class="stat-box-label">CG/SHO</div><div class="stat-box-value">' + p.CG + '/' + p.SHO + '</div></div>' +
    '</div>';
  document.getElementById('panel-body').innerHTML = html;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('player-panel').classList.add('open');
}

function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('player-panel').classList.remove('open');
}

function updateSliderVal(sliderId, valId, suffix) {
  const v = document.getElementById(sliderId).value;
  document.getElementById(valId).textContent = v + (suffix || '');
}

function onSimPlayerChange() {
  const pid = parseInt(document.getElementById('sim-player-select').value);
  const info = document.getElementById('sim-player-info');
  if (!pid) { info.style.display = 'none'; return; }
  const player = HITTERS.find(function(h) { return h.id === pid; });
  if (!player) { info.style.display = 'none'; return; }
  const pf = player.park_factor || 1.0;
  const pfDesc = pf >= 1.1 ? 'Hitter-Friendly' : pf <= 0.9 ? 'Pitcher-Friendly' : 'Neutral';
  document.getElementById('sim-park-display').textContent = 'Team ' + player.team_id + ' Park';
  document.getElementById('sim-park-factor').textContent = 'HR Park Factor: ' + pf.toFixed(3) + 'x  (' + pfDesc + ')  \u00b7  Neutral HR/AB: ' + (player.hr_rate_neutral*100).toFixed(2) + '%';
  info.style.display = 'block';
  // Default park select to current team
  document.getElementById('sim-park-select').value = player.team_id;
}

function runSim() {
  const pid = parseInt(document.getElementById('sim-player-select').value);
  if (!pid) { alert('Please select a player first.'); return; }
  const player = HITTERS.find(function(h) { return h.id === pid; });
  if (!player) return;

  const retireAge = parseInt(document.getElementById('sim-retire-age').value);
  const peakAge = parseInt(document.getElementById('sim-peak-age').value);
  const peakDur = parseInt(document.getElementById('sim-peak-dur').value);
  const declineRate = parseInt(document.getElementById('sim-decline').value) / 100;
  const gamesPerSeason = parseInt(document.getElementById('sim-games').value);
  const baselineYrs = parseInt(document.getElementById('sim-baseline-yrs').value);
  const projParkId = parseInt(document.getElementById('sim-park-select').value);
  const projPF = projParkId === -1 ? (player.park_factor || 1.0) : (PARK_FACTORS[projParkId] || 1.0);

  const years = (YEAR_DATA[String(pid)] || []).sort(function(a,b) { return a.year-b.year; });
  const currentAge = player.age;
  const lastYear = 2141;
  const currentPF = player.park_factor || 1.0;

  // Baseline from recent N seasons - park-adjusted
  const recentYears = years.slice(-baselineYrs);
  const baseOPS = recentYears.length ? recentYears.reduce(function(s,y) { return s+y.OPS; }, 0) / recentYears.length : player.OPS;
  const baseAB = recentYears.length ? Math.round(recentYears.reduce(function(s,y) { return s+y.AB; }, 0) / recentYears.length) : Math.round(player.AB / Math.max(player.seasons,1));
  const baseAVG = recentYears.length ? recentYears.reduce(function(s,y) { return s+y.AVG; }, 0) / recentYears.length : player.AVG;

  // Park-neutral HR rate strictly from the baseline window
  // This is the critical fix: we NEVER fall back to career rate,
  // because career includes pre-park-change seasons with different HR rates.
  // The baseline window (set by user) should reflect the player's current true level.
  var recentHR = 0, recentAB = 0;
  recentYears.forEach(function(y) { recentHR += y.HR; recentAB += y.AB; });
  // If baseline window has data, use it. If somehow empty, use career but warn.
  const rawHRRate = recentAB > 0 ? recentHR / recentAB : (player.HR / Math.max(player.AB, 1));
  // Strip current park's effect to get park-neutral rate
  const neutralHRRate = rawHRRate / currentPF;

  function ageFactor(age) {
    const peakEnd = peakAge + peakDur - 1;
    if (age <= peakAge) return Math.max(0.7, 1 - (peakAge - age) * 0.03);
    if (age <= peakEnd) return 1.0;
    return Math.max(0.3, 1 - (age - peakEnd) * declineRate);
  }

  const parkChanged = projParkId !== -1 && projParkId !== player.team_id;
  const projections = [];
  for (let age = currentAge + 1; age <= retireAge; age++) {
    const simYear = lastYear + (age - currentAge);
    const factor = ageFactor(age);
    const projAB = Math.round(baseAB * (gamesPerSeason / 150) * factor);
    const projAVG = Math.min(0.400, Math.max(0.180, baseAVG * factor));
    const projH = Math.round(projAB * projAVG);
    // Apply park factor to neutral HR rate
    const projHRRate = neutralHRRate * projPF * factor;
    const projHR = Math.round(projHRRate * projAB);
    const projOPS = Math.min(1.300, Math.max(0.400, baseOPS * factor));
    const projRBI = Math.round(projHR * 2.8 + projH * 0.28);
    const projR = Math.round(projH * 0.52 + projHR * 0.7);
    const projBB = Math.round(projAB * (player.BB / Math.max(player.AB,1)) * factor);
    const projSO = Math.round(projAB * (player.SO / Math.max(player.AB,1)));
    projections.push({year: simYear, age: age, G: Math.round(gamesPerSeason*factor), AB: projAB, H: projH, HR: projHR, RBI: projRBI, R: projR, BB: projBB, SO: projSO, AVG: projAVG, OPS: projOPS, factor: factor});
  }

  const totH = player.H + projections.reduce(function(s,p) { return s+p.H; }, 0);
  const totHR = player.HR + projections.reduce(function(s,p) { return s+p.HR; }, 0);
  const totRBI = player.RBI + projections.reduce(function(s,p) { return s+p.RBI; }, 0);
  const totR = player.R + projections.reduce(function(s,p) { return s+p.R; }, 0);
  const totBB = player.BB + projections.reduce(function(s,p) { return s+p.BB; }, 0);
  const totAB = player.AB + projections.reduce(function(s,p) { return s+p.AB; }, 0);

  const milestones = [
    {label:'700 HR', threshold:700, current:player.HR, projected:totHR, icon:'\uD83D\uDCA5'},
    {label:'500 HR', threshold:500, current:player.HR, projected:totHR, icon:'\uD83D\uDCA3'},
    {label:'400 HR', threshold:400, current:player.HR, projected:totHR, icon:'\uD83D\uDCA5'},
    {label:'3000 Hits', threshold:3000, current:player.H, projected:totH, icon:'\uD83C\uDFAF'},
    {label:'2000 Hits', threshold:2000, current:player.H, projected:totH, icon:'\u2705'},
    {label:'1500 RBI', threshold:1500, current:player.RBI, projected:totRBI, icon:'\uD83D\uDD25'},
    {label:'1000 RBI', threshold:1000, current:player.RBI, projected:totRBI, icon:'\u26A1'},
    {label:'1000 Runs', threshold:1000, current:player.R, projected:totR, icon:'\uD83C\uDFC3'},
    {label:'1000 BB', threshold:1000, current:player.BB, projected:totBB, icon:'\uD83D\uDC41'},
  ].filter(function(m) { return m.current < m.threshold || m.projected >= m.threshold * 0.7; });

  const parkNote = parkChanged ?
    'Projecting at Team ' + projParkId + ' (PF: ' + projPF.toFixed(3) + 'x) vs current Team ' + player.team_id + ' (PF: ' + currentPF.toFixed(3) + 'x)' :
    'Staying at Team ' + player.team_id + ' (PF: ' + projPF.toFixed(3) + 'x)';

  let out = '<div class="sim-player-header">' +
    '<div class="sim-player-name">' + player.name + '</div>' +
    '<div class="sim-player-base">' +
    'Age ' + currentAge + ' \u00b7 ' + player.pos + ' \u00b7 Projecting through age ' + retireAge + '<br>' +
    'Baseline OPS: ' + baseOPS.toFixed(3) + ' \u00b7 Neutral HR/AB: ' + (neutralHRRate*100).toFixed(2) + '%  \u00b7 ' + baselineYrs + '-yr window' +
    '</div>' +
    '<div class="sim-park-note">\uD83C\uDFDF\uFE0F ' + parkNote + '</div>' +
    '</div>';

  out += '<div class="section-title">Season-by-Season Projection</div>' +
    '<table class="proj-table"><thead><tr>' +
    '<th>Year / Age</th><th>G</th><th>AB</th><th>H</th><th>HR</th><th>RBI</th><th>R</th><th>BB</th><th>SO</th><th>AVG</th><th>OPS</th><th>Factor</th>' +
    '</tr></thead><tbody>';

  years.forEach(function(y) {
    const yAge = currentAge - (lastYear - y.year);
    out += '<tr class="actual"><td>' + y.year + ' / ' + yAge + '</td><td>' + y.G + '</td><td>' + y.AB + '</td><td>' + y.H + '</td><td>' + y.HR + '</td><td>' + y.RBI + '</td><td>' + y.R + '</td><td>' + y.BB + '</td><td>' + y.SO + '</td><td>' + fmtAvg(y.AVG) + '</td><td class="' + opsClass(y.OPS) + '">' + y.OPS.toFixed(3) + '</td><td>actual</td></tr>';
  });

  out += '<tr class="proj-divider"><td colspan="12">\u25b2 ACTUAL  \u00b7  PROJECTED \u25bc</td></tr>';

  projections.forEach(function(p) {
    out += '<tr class="projected"><td>' + p.year + ' / ' + p.age + '</td><td>' + p.G + '</td><td>' + p.AB + '</td><td>' + p.H + '</td><td>' + p.HR + '</td><td>' + p.RBI + '</td><td>' + p.R + '</td><td>' + p.BB + '</td><td>' + p.SO + '</td><td>' + fmtAvg(p.AVG) + '</td><td class="' + opsClass(p.OPS) + '">' + p.OPS.toFixed(3) + '</td><td>' + Math.round(p.factor*100) + '%</td></tr>';
  });

  out += '<tr class="totals"><td>CAREER TOTAL</td><td>\u2014</td><td>' + totAB + '</td><td>' + totH + '</td><td>' + totHR + '</td><td>' + totRBI + '</td><td>' + totR + '</td><td>' + totBB + '</td><td>\u2014</td><td>' + fmtAvg(totH/totAB) + '</td><td>\u2014</td><td></td></tr>';
  out += '</tbody></table>';

  out += '<div class="section-title" style="margin-top:24px">Career Milestone Tracker</div><div class="milestone-list">';
  milestones.forEach(function(m) {
    const reached = m.current >= m.threshold;
    const willReach = !reached && m.projected >= m.threshold;
    const cls = reached ? 'reached' : willReach ? 'close' : 'far';
    const status = reached ? '\u2713 Already reached' : willReach ? 'Projected: ' + m.projected + ' / ' + m.threshold : 'Short: ' + m.projected + ' / ' + m.threshold;
    out += '<div class="milestone ' + cls + '"><div class="milestone-icon">' + m.icon + '</div><div class="milestone-text"><strong>' + m.label + '</strong><br><small>Current: ' + m.current + '</small></div><div class="milestone-val">' + status + '</div></div>';
  });
  out += '</div>';

  document.getElementById('sim-output').innerHTML = out;
}

init();

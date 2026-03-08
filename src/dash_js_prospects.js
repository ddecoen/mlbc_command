
// ── PROSPECTS ──
var LEVEL_ORDER = {3: 0, 6: 0.5, 2: 1, 1: 2, 7: -1};
var filteredProspects = [];
var prospectPage = 0;
var PROSPECT_PAGE_SIZE = 60;

function gradeFromOps(ops, isPitcher) {
  if (isPitcher) {
    // For pitchers: OPS-against, lower = better
    if (ops <= 0.650) return {grade: '80', label: 'ELITE'};
    if (ops <= 0.700) return {grade: '70', label: 'PLUS'};
    if (ops <= 0.750) return {grade: '60', label: 'SOLID'};
    return {grade: '50', label: 'ORG'};
  }
  if (ops >= 1.0) return {grade: '80', label: 'ELITE'};
  if (ops >= 0.93) return {grade: '70', label: 'PLUS'};
  if (ops >= 0.87) return {grade: '60', label: 'SOLID'};
  return {grade: '50', label: 'ORG'};
}

function initProspects() {
  filteredProspects = [...PROSPECTS];
  // Populate team filter
  const teams = [...new Set(PROSPECTS.map(function(p) { return p.team; }))].sort(function(a,b){return a-b;});
  const tsel = document.getElementById('pros-team');
  if (tsel) { teams.forEach(function(t) {
    const o = document.createElement('option');
    o.value = t; o.textContent = 'Team ' + t;
    tsel.appendChild(o);
  }); }
}

function filterProspects() {
  if (!document.getElementById('pros-search')) return;
  const q = document.getElementById('pros-search').value.toLowerCase();
  const pos = document.getElementById('pros-pos').value;
  const team = document.getElementById('pros-team').value;
  const minEta = parseInt(document.getElementById('pros-eta').value) || 0;
  const sortKey = document.getElementById('pros-sort').value;

  filteredProspects = PROSPECTS.filter(function(p) {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (pos === 'P' && p.pos !== 'P') return false;
    if (pos === 'H' && p.pos === 'P') return false;
    if (pos && pos !== 'P' && pos !== 'H' && p.pos !== pos) return false;
    if (team && p.team !== parseInt(team)) return false;
    if (minEta && p.eta_year > minEta) return false;
    return true;
  });

  if (sortKey === 'ops_card') filteredProspects.sort(function(a,b) { return b.ops_card-a.ops_card; });
  else if (sortKey === 'age') filteredProspects.sort(function(a,b) { return a.age-b.age; });
  else if (sortKey === 'eta') filteredProspects.sort(function(a,b) { return a.eta_year-b.eta_year; });
  else if (sortKey === 'mil_ops') filteredProspects.sort(function(a,b) { return (b.last_mil_ops||0)-(a.last_mil_ops||0); });
  else if (sortKey === 'level') filteredProspects.sort(function(a,b) { return (LEVEL_ORDER[b.level]||0)-(LEVEL_ORDER[a.level]||0); });

  document.getElementById('pros-count').textContent = filteredProspects.length + ' prospects';
  prospectPage = 0;
  renderProspects();
}

function renderProspects() {
  const grid = document.getElementById('prospect-grid');
  const start = prospectPage * PROSPECT_PAGE_SIZE;
  const slice = filteredProspects.slice(start, start + PROSPECT_PAGE_SIZE);

  grid.innerHTML = slice.map(function(p) {
    const isPitcher = p.pos === "P";
    const g = gradeFromOps(p.ops_card, isPitcher);
    const cardCls = isPitcher ? (p.ops_card <= 0.70 ? 'elite' : p.ops_card <= 0.80 ? 'good' : 'avg') : (p.ops_card >= 1.0 ? 'elite' : p.ops_card >= 0.90 ? 'good' : 'avg');
    const etaPct = Math.max(0, Math.min(100, Math.round((p.eta_year - 2141) / 8 * 100)));

    let statHtml = '';
    if (!isPitcher) {
      const milOps = p.last_mil_ops ? p.last_mil_ops.toFixed(3) : '---';
      const milCls = p.last_mil_ops && p.last_mil_ops >= 0.9 ? 'gold' : p.last_mil_ops && p.last_mil_ops >= 0.75 ? 'blue' : '';
      statHtml = '<div class="prospect-stat"><div class="prospect-stat-label">Card OPS</div><div class="prospect-stat-val gold">' + p.ops_card.toFixed(3) + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">MiLB OPS</div><div class="prospect-stat-val ' + milCls + '">' + milOps + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">Level</div><div class="prospect-stat-val">' + p.level_name + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">Age</div><div class="prospect-stat-val">' + p.age + '</div></div>';
    } else {
      const era = p.last_era != null ? p.last_era.toFixed(2) : '---';
      const eraCls = p.last_era != null && p.last_era < 3.5 ? 'gold' : p.last_era != null && p.last_era < 4.5 ? 'blue' : '';
      const ip = p.last_ip ? p.last_ip.toFixed(0) + ' IP' : '---';
      // Pitcher card OPS = OPS-against (lower = better): color green when low
      const opsCls = p.ops_card <= 0.65 ? 'gold' : p.ops_card <= 0.72 ? 'blue' : '';
      statHtml = '<div class="prospect-stat"><div class="prospect-stat-label">OPS-vs</div><div class="prospect-stat-val ' + opsCls + '">' + p.ops_card.toFixed(3) + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">ERA</div><div class="prospect-stat-val ' + eraCls + '">' + era + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">Level</div><div class="prospect-stat-val">' + p.level_name + '</div></div>' +
        '<div class="prospect-stat"><div class="prospect-stat-label">Age</div><div class="prospect-stat-val">' + p.age + '</div></div>';
    }

    return '<div class="prospect-card ' + cardCls + '" onclick="openProspectPanel(' + p.id + ')">' +
      '<div class="prospect-card-top">' +
      '<div>' +
      '<div class="prospect-name">' + p.name + '</div>' +
      '<div class="prospect-meta">T' + p.team + ' \u00b7 <span class="grade-badge grade-' + g.grade + '">' + g.label + '</span></div>' +
      '</div>' +
      '<div class="prospect-pos">' + p.pos + '</div>' +
      '</div>' +
      '<div class="prospect-stats">' + statHtml + '</div>' +
      '<div class="eta-bar">' +
      '<div class="eta-label"><span>ETA: ' + Math.round(p.eta_year) + ' (age ' + Math.round(p.eta_age) + ')</span><span>' + Math.round(p.eta_year - 2141) + ' yrs out</span></div>' +
      '<div class="eta-track"><div class="eta-fill" style="width:' + etaPct + '%"></div></div>' +
      '</div>' +
      '</div>';
  }).join('');

  renderPagination('pros', filteredProspects.length, prospectPage, function(pg) { prospectPage=pg; renderProspects(); });
}

function openProspectPanel(id) {
  const p = PROSPECTS.find(function(x) { return x.id === id; });
  if (!p) return;
  const isPitcher = p.pos === "P";
  const g = gradeFromOps(p.ops_card, isPitcher);
  document.getElementById('panel-name').textContent = p.name;
  document.getElementById('panel-meta').textContent = p.pos + ' \u00b7 Age ' + p.age + ' \u00b7 Team ' + p.team + ' \u00b7 ' + p.level_name + ' \u00b7 Grade: ' + g.label;

  let html = '<div class="stat-grid">';
  if (!isPitcher) {
    html += '<div class="stat-box"><div class="stat-box-label">Card OPS</div><div class="stat-box-value highlight">' + p.ops_card.toFixed(3) + '</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">MiLB OPS</div><div class="stat-box-value">' + (p.last_mil_ops ? p.last_mil_ops.toFixed(3) : '---') + '</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">MiLB AB</div><div class="stat-box-value">' + (p.last_mil_ab || '---') + '</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">MiLB HR</div><div class="stat-box-value">' + (p.hr_last || '---') + '</div></div>';
  } else {
    const opsPanelCls = p.ops_card <= 0.65 ? 'highlight' : '';
    html += '<div class="stat-box"><div class="stat-box-label">OPS-Against</div><div class="stat-box-value ' + opsPanelCls + '">' + p.ops_card.toFixed(3) + ' &#9660;</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">ERA</div><div class="stat-box-value">' + (p.last_era != null ? p.last_era.toFixed(2) : '---') + '</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">IP</div><div class="stat-box-value">' + (p.last_ip ? p.last_ip.toFixed(0) : '---') + '</div></div>';
    html += '<div class="stat-box"><div class="stat-box-label">WHIP</div><div class="stat-box-value">' + (p.last_whip != null ? p.last_whip.toFixed(3) : '---') + '</div></div>';
  }
  html += '</div>';

  // ETA breakdown
  const yrsOut = (p.eta_year - 2141).toFixed(1);
  const levelPath = p.level === 1 ? 'AAA \u2192 MLB' : p.level === 2 ? 'AA \u2192 AAA \u2192 MLB' : p.level === 3 ? 'A \u2192 AA \u2192 AAA \u2192 MLB' : 'Rookie \u2192 A \u2192 AA \u2192 MLB';
  html += '<div class="section-title" style="margin-top:4px">ETA Projection</div>';
  html += '<div style="background:var(--surface2);border-radius:6px;padding:14px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">' +
    '<div style="margin-bottom:8px;color:var(--accent);font-size:16px;font-weight:600;">MLB ETA: ~' + Math.round(p.eta_year) + ' (age ' + Math.round(p.eta_age) + ')</div>' +
    '<div style="color:var(--muted);font-size:10px;letter-spacing:1px;">PATH: ' + levelPath + '</div>' +
    '<div style="margin-top:8px;color:var(--text);">' + yrsOut + ' seasons projected to reach MLB</div>' +
    '</div>';

  // Context note
  const note = p.ops_card >= 1.0 ? 'Elite talent — could accelerate if dominating. Watch for MLB promotion within 2-3 years.' :
    p.ops_card >= 0.90 ? 'Plus prospect. Solid trajectory. Standard development timeline.' :
    p.ops_card >= 0.85 ? 'Solid org piece. Could be a contributor if development stays on track.' :
    'Organizational depth. Will need to perform well at each level.';
  html += '<div style="margin-top:16px;padding:12px;background:rgba(74,158,255,0.06);border:1px solid rgba(74,158,255,0.15);border-radius:6px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text);line-height:1.6;">' + note + '</div>';

  document.getElementById('panel-body').innerHTML = html;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('player-panel').classList.add('open');
}

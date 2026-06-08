/* =============================================
   TotÎnGară.ro — app.js
   Phase 1: localStorage-based (no Firebase)
   Firebase will replace storage layer in Phase 2
   ============================================= */

const REPORT_TTL_MS   = 60 * 60 * 1000;   // 1 hour — report validity
const COOLDOWN_MS     = 30 * 60 * 1000;   // 30 min — per-device cooldown
const HS_MAX          = 10;               // top 10 highscores kept

const COMPANIES = [
  "CFR Călători",
  "Transferoviar Călători (TFC)",
  "Regio Călători",
  "Astra Trans Carpatic",
  "Softrans",
  "Interregional Călători"
];

const GAUGE_ZONES = [
  { max: 10,   class: 'green',  angle: -150, msg: 'Trenurile merg. Miracol național.' },
  { max: 30,   class: 'yellow', angle:  -90, msg: 'Întârziere acceptabilă. Adică nu, dar ne-am obișnuit.' },
  { max: 60,   class: 'red',    angle:  -30, msg: 'Ia-ți o cafea. Bucură-te de viață! O să mai aștepți.' },
  { max: Infinity, class: 'black', angle: 20, msg: 'Dumnezeu a abandonat România. CFR a confirmat.' }
];

/* ---- STORAGE HELPERS ---- */
function loadReports() {
  try { return JSON.parse(localStorage.getItem('tig_reports') || '[]'); }
  catch { return []; }
}

function saveReports(reports) {
  localStorage.setItem('tig_reports', JSON.stringify(reports));
}

function loadHighscores() {
  try { return JSON.parse(localStorage.getItem('tig_highscores') || '[]'); }
  catch { return []; }
}

function saveHighscores(hs) {
  localStorage.setItem('tig_highscores', JSON.stringify(hs));
}

function getLastReport() {
  try { return parseInt(localStorage.getItem('tig_last_report') || '0', 10); }
  catch { return 0; }
}

function setLastReport() {
  localStorage.setItem('tig_last_report', Date.now().toString());
}

/* ---- ACTIVE REPORTS (within 1h) ---- */
function getActiveReports() {
  const now = Date.now();
  const all = loadReports();
  return all.filter(r => (now - r.ts) < REPORT_TTL_MS);
}

/* ---- GAUGE ---- */
function getAverageDelay(reports) {
  if (!reports.length) return 0;
  const total = reports.reduce((s, r) => s + r.minutes, 0);
  return total / reports.length;
}

function getTotalDelay(reports) {
  return reports.reduce((s, r) => s + r.minutes, 0);
}

function getZone(avgMin) {
  for (const z of GAUGE_ZONES) {
    if (avgMin <= z.max) return z;
  }
  return GAUGE_ZONES[GAUGE_ZONES.length - 1];
}

// Maps avg minutes → needle angle in SVG rotate degrees
// green centre ~-150, yellow ~-90, red ~-30, black ~+20
function minutesToAngle(avg) {
  if (avg === 0) return -160;
  if (avg <= 10) return -160 + (avg / 10) * 30;       // -160 → -130
  if (avg <= 30) return -130 + ((avg - 10) / 20) * 60; // -130 → -70
  if (avg <= 60) return -70 + ((avg - 30) / 30) * 60;  // -70  → -10
  const capped = Math.min(avg, 400);
  return -10 + ((capped - 60) / 340) * 30;             // -10  → +20
}

function updateNeedle(angle) {
  const needle = document.getElementById('needle');
  if (!needle) return;
  needle.style.transition = 'transform 1s cubic-bezier(0.34,1.56,0.64,1)';
  needle.setAttribute('transform', `rotate(${angle}, 200, 200)`);
}

function updateGauge() {
  const active = getActiveReports();
  const total  = getTotalDelay(active);
  const avg    = getAverageDelay(active);
  const zone   = getZone(avg);
  const angle  = minutesToAngle(avg);

  updateNeedle(angle);

  const msgEl = document.getElementById('gaugeMessage');
  if (msgEl) msgEl.textContent = zone.msg;

  const totalEl = document.getElementById('totalMinutesDisplay');
  if (totalEl) animateNumber(totalEl, parseInt(totalEl.textContent) || 0, total);

  const countEl = document.getElementById('reportCount');
  if (countEl) countEl.textContent = active.length;
}

function animateNumber(el, from, to) {
  const dur = 800;
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / dur, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    el.textContent = Math.round(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = to;
  }
  requestAnimationFrame(step);
}

/* ---- SHAME LIST ---- */
function updateShameList() {
  const active = getActiveReports();
  const el = document.getElementById('shameList');
  if (!el) return;

  if (!active.length) {
    el.innerHTML = `<div class="shame-empty"><span class="empty-icon">🚆</span><p>Niciun raport activ în acest moment.<br/>Fie trenurile merg la timp — fie nimeni nu a raportat încă.</p></div>`;
    return;
  }

  // Group by company
  const map = {};
  for (const r of active) {
    if (!map[r.company]) map[r.company] = { total: 0, count: 0 };
    map[r.company].total += r.minutes;
    map[r.company].count += 1;
  }

  const sorted = Object.entries(map)
    .map(([co, d]) => ({ company: co, total: d.total, avg: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => b.total - a.total);

  el.innerHTML = sorted.map((item, i) => `
    <div class="shame-item">
      <span class="shame-rank ${i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':''}">${i + 1}</span>
      <span class="shame-company">${escHtml(item.company)}</span>
      <span class="shame-total">
        <span class="shame-total-label">total</span>
        ${item.total} min
      </span>
      <span class="shame-avg">
        <span class="shame-avg-label">medie / raport</span>
        ~${item.avg} min
      </span>
    </div>
  `).join('');
}

/* ---- HIGHSCORES ---- */
function checkAndUpdateHighscores() {
  const active = getActiveReports();
  if (!active.length) return;

  // Group by company & today's date
  const today = formatDate(new Date());
  const map = {};
  for (const r of active) {
    const key = `${r.company}__${today}`;
    if (!map[key]) map[key] = { company: r.company, date: today, total: 0 };
    map[key].total += r.minutes;
  }

  let hs = loadHighscores();

  for (const entry of Object.values(map)) {
    hs.push({ date: entry.date, company: entry.company, total: entry.total });
  }

  // Deduplicate by date+company, keep max total
  const dedup = {};
  for (const h of hs) {
    const key = `${h.company}__${h.date}`;
    if (!dedup[key] || h.total > dedup[key].total) dedup[key] = h;
  }

  hs = Object.values(dedup).sort((a, b) => b.total - a.total).slice(0, HS_MAX);
  saveHighscores(hs);
  renderHighscores(hs);
}

function renderHighscores(hs) {
  const el = document.getElementById('highscoresList');
  if (!el) return;

  if (!hs.length) {
    el.innerHTML = `
      <div class="hs-header-row"><span>#</span><span>Data</span><span>Companie</span><span>Total min</span></div>
      <div class="hs-empty"><p>Niciun record înregistrat încă. Fie e un miracol, fie tocmai ai deschis website-ul.</p></div>
    `;
    return;
  }

  const rows = hs.map((h, i) => `
    <div class="hs-row">
      <span class="hs-pos ${i===0?'pos-1':i===1?'pos-2':i===2?'pos-3':''}">${i + 1}</span>
      <span class="hs-date">${escHtml(h.date)}</span>
      <span class="hs-company">${escHtml(h.company)}</span>
      <span class="hs-minutes">${h.total} min</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="hs-header-row"><span>#</span><span>Data</span><span>Companie</span><span>Total min</span></div>
    ${rows}
  `;
}

/* ---- MODAL ---- */
function openReport() {
  const last = getLastReport();
  const remaining = COOLDOWN_MS - (Date.now() - last);

  if (remaining > 0) {
    showCooldown(remaining);
    document.getElementById('reportModal').classList.add('open');
    return;
  }

  showStep(1);
  document.getElementById('reportModal').classList.add('open');
}

function closeReport() {
  document.getElementById('reportModal').classList.remove('open');
  resetForm();
}

function closeOnOverlay(e) {
  if (e.target === document.getElementById('reportModal')) closeReport();
}

function showStep(n) {
  ['step1','step2','step3','stepCooldown'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === `step${n}` ? 'block' : 'none';
  });
}

function showCooldown(remainingMs) {
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step3').style.display = 'none';
  document.getElementById('stepCooldown').style.display = 'block';

  const mins = Math.ceil(remainingMs / 60000);
  document.getElementById('cooldownMsg').textContent =
    `Poți trimite un nou raport peste aproximativ ${mins} minut${mins === 1 ? '' : 'e'}. Cooldown-ul există pentru a preveni rapoartele false.`;
}

function syncDelay(source) {
  const slider = document.getElementById('delaySlider');
  const number = document.getElementById('delayNumber');
  if (!slider || !number) return;
  if (source === 'slider') {
    number.value = slider.value;
  } else {
    let v = parseInt(number.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 400) v = 400;
    number.value = v;
    slider.value = v;
  }
}

function goToStep2() {
  const company = document.getElementById('companySelect').value.trim();
  const route   = document.getElementById('routeInput').value.trim().toUpperCase();
  const station = document.getElementById('stationSelect').value.trim();
  const minutes = parseInt(document.getElementById('delayNumber').value, 10);
  const errEl   = document.getElementById('formError');

  errEl.textContent = '';

  if (!company) { errEl.textContent = '⚠ Selectează compania feroviară.'; return; }
  if (!route)   { errEl.textContent = '⚠ Introdu numărul trenului / rutei.'; return; }
  if (route.length > 8) { errEl.textContent = '⚠ Ruta poate avea maximum 8 caractere.'; return; }
  if (!station) { errEl.textContent = '⚠ Selectează stația.'; return; }
  if (!minutes || minutes < 1) { errEl.textContent = '⚠ Introdu minutele de întârziere.'; return; }

  // Populate confirm card
  const now = new Date();
  document.getElementById('c_route').textContent   = route;
  document.getElementById('c_company').textContent = company;
  document.getElementById('c_delay').textContent   = `${minutes} minute`;
  document.getElementById('c_station').textContent = station;
  document.getElementById('c_date').textContent    = formatDate(now);
  document.getElementById('c_time').textContent    = formatTime(now);

  showStep(2);
}

function goToStep1() {
  showStep(1);
}

function submitReport() {
  const company = document.getElementById('companySelect').value.trim();
  const route   = document.getElementById('routeInput').value.trim().toUpperCase();
  const station = document.getElementById('stationSelect').value.trim();
  const minutes = parseInt(document.getElementById('delayNumber').value, 10);
  const now     = Date.now();

  const report = { company, route, station, minutes, ts: now };

  // Save report
  const all = loadReports();
  all.push(report);
  // Trim stale while saving
  const clean = all.filter(r => (now - r.ts) < REPORT_TTL_MS);
  saveReports(clean);
  setLastReport();

  // Update UI
  updateGauge();
  updateShameList();
  checkAndUpdateHighscores();

  showStep(3);
}

function resetForm() {
  const fields = ['companySelect','routeInput','stationSelect'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const slider = document.getElementById('delaySlider');
  const number = document.getElementById('delayNumber');
  if (slider) slider.value = 30;
  if (number) number.value = 30;
  const errEl = document.getElementById('formError');
  if (errEl) errEl.textContent = '';
}

/* ---- DEPARTURE BOARD ANIMATION ---- */
const CHARS = 'ABCDEFGHIJKLMNOPRSTUVWXYZĂÂÎȘȚ0123456789';

function scrambleHeader() {
  const chars = document.querySelectorAll('.board-char');
  chars.forEach((el, i) => {
    const final = el.dataset.final;
    if (final === ' ') return;
    let count = 0;
    const max  = Math.floor(Math.random() * 6) + 3;
    const interval = setInterval(() => {
      el.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
      count++;
      if (count >= max) {
        clearInterval(interval);
        el.textContent = final;
      }
    }, 60 + i * 15);
  });
}

/* ---- UTILS ---- */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
}

function formatTime(d) {
  const h = d.getHours().toString().padStart(2,'0');
  const m = d.getMinutes().toString().padStart(2,'0');
  return `${h}:${m}`;
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Run departure board animation
  setTimeout(scrambleHeader, 300);
  setInterval(scrambleHeader, 12000);

  // Initial UI render
  updateGauge();
  updateShameList();
  renderHighscores(loadHighscores());

  // Refresh every 2 minutes
  setInterval(() => {
    updateGauge();
    updateShameList();
    checkAndUpdateHighscores();
  }, 120 * 1000);
});

// ESC key closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeReport();
});

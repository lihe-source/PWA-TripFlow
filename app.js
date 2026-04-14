import { TripStore } from './modules/trip.js';
import { initTimelinePage } from './modules/timeline.js';
import { renderMapPage } from './modules/map.js';
import { renderSettingsPage, SettingsStore } from './modules/settings.js';
import { AuthService } from './modules/auth.js';

// ── Global helpers ──────────────────────────────────────────────
window.showToast = (msg, dur=2500) => {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), dur);
};

window.openModal = (html) => {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  overlay.style.display = 'flex';
  box.querySelector('input,textarea')?.focus();
};

window.closeModal = () => {
  document.getElementById('modal-overlay').style.display = 'none';
};

window.navigate = (hash) => { location.hash = hash; };

// ── Auto Update ──────────────────────────────────────────────────
const LOCAL_VERSION = '1.0';
window.checkUpdate = async (manual=false) => {
  const base = (window.UPDATE_CONFIG?.repoRawBase||'').replace(/\/$/,'');
  if (!base) { if(manual) window.showToast('未設定更新來源'); return; }
  try {
    const res = await fetch(`${base}/version.json?t=${Date.now()}`);
    const data = await res.json();
    if (data.version !== LOCAL_VERSION) {
      const ok = confirm(`發現新版本 ${data.version}，立即更新？`);
      if (ok) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
        location.reload(true);
      }
    } else if (manual) {
      window.showToast('已是最新版本 ✓');
    }
  } catch { if(manual) window.showToast('檢查更新失敗'); }
};

// ── SW Registration ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}

// ── GIS Script Load ──────────────────────────────────────────────
function loadGIS() {
  if (document.querySelector('script[src*="accounts.google.com/gsi"]')) return;
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = () => AuthService.init();
  document.head.appendChild(s);
}

// ── Router ───────────────────────────────────────────────────────
function route() {
  const hash = location.hash || '#/home';
  const app = document.getElementById('app');
  const nav = document.getElementById('bottom-nav');

  // Hide/show bottom nav
  const hideNav = hash.startsWith('#/new-trip') || /^#\/trip\/[^/]+$/.test(hash);
  nav.style.display = hideNav ? 'none' : 'flex';

  // Active nav tab
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (hash === '#/home' || hash === '') document.querySelector('[data-route="#/home"]')?.classList.add('active');
  else if (hash.startsWith('#/map')) document.querySelector('[data-route="#/map"]')?.classList.add('active');
  else if (hash.startsWith('#/settings')) document.querySelector('[data-route="#/settings"]')?.classList.add('active');

  window._refreshTimeline = null;

  if (hash === '#/home' || hash === '#/' || hash === '') return renderHome();
  if (hash === '#/new-trip') return renderNewTrip();
  if (hash === '#/map') return renderMapPage();
  if (hash === '#/settings') return renderSettingsPage();
  const tripMatch = hash.match(/^#\/trip\/([^/]+)$/);
  if (tripMatch) return initTimelinePage(tripMatch[1]);

  // fallback
  renderHome();
}

window.addEventListener('hashchange', route);

// ── Home Page ────────────────────────────────────────────────────
function renderHome() {
  const app = document.getElementById('app');
  const trips = TripStore.getAll();

  app.innerHTML = `
    <div class="home-header">
      <span class="home-logo">🧭</span>
      <span class="home-title">TripFlow</span>
    </div>
    <div class="home-new-btn-wrap">
      <button class="home-new-btn" onclick="window.navigate('#/new-trip')">
        <span>⛺</span>
        <span>新排程</span>
      </button>
    </div>
    <div class="home-trips-section">
      <h3 class="home-section-title">📋 已規劃行程</h3>
      ${trips.length === 0
        ? '<div class="home-empty">尚無行程，點擊「新排程」開始</div>'
        : trips.map(t => `
          <div class="trip-card" onclick="window.navigate('#/trip/${t.id}')">
            <div class="trip-card-icon">${t.country==='日本'?'🗾':t.country==='台灣'?'🇹🇼':'🌏'}</div>
            <div class="trip-card-info">
              <div class="trip-card-title">${t.title}</div>
              <div class="trip-card-dates">${t.dateRange.start} – ${t.dateRange.end}</div>
              <div class="trip-card-meta">${t.city||t.country||''} · ${t.spots?.length||0} 個景點</div>
            </div>
          </div>`).join('')}
    </div>`;
}

// ── New Trip Wizard ──────────────────────────────────────────────
function renderNewTrip() {
  const app = document.getElementById('app');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'/');

  app.innerHTML = `
    <div class="page-header">
      <button class="icon-btn back-btn" onclick="window.navigate('#/home')">‹</button>
      <span class="page-title">新排程</span>
    </div>
    <div class="new-trip-form">
      <div class="form-group">
        <label>🗓 開始日期</label>
        <input type="date" id="nt-start" value="${today.replace(/\//g,'-')}">
      </div>
      <div class="form-group">
        <label>🗓 結束日期</label>
        <input type="date" id="nt-end" value="${today.replace(/\//g,'-')}">
      </div>
      <div class="form-group">
        <label>🌏 國家</label>
        <input type="text" id="nt-country" placeholder="例：日本">
      </div>
      <div class="form-group">
        <label>🏙 城市</label>
        <input type="text" id="nt-city" placeholder="例：東京">
      </div>
      <div class="form-group">
        <label>✏️ 行程名稱</label>
        <input type="text" id="nt-title" placeholder="例：東京五日遊">
      </div>
      <button class="btn-primary btn-full" id="nt-create">建立行程 →</button>
    </div>`;

  document.getElementById('nt-city').addEventListener('input', () => {
    const city = document.getElementById('nt-city').value.trim();
    const country = document.getElementById('nt-country').value.trim();
    const titleEl = document.getElementById('nt-title');
    if (city && !titleEl.value) {
      const start = document.getElementById('nt-start').value;
      const end = document.getElementById('nt-end').value;
      const days = start && end ? Math.round((new Date(end)-new Date(start))/(86400000))+1 : '';
      titleEl.value = `${city}${days?days+'日遊':'之旅'}`;
    }
  });

  document.getElementById('nt-create').addEventListener('click', () => {
    const start = document.getElementById('nt-start').value.replace(/-/g,'/');
    const end = document.getElementById('nt-end').value.replace(/-/g,'/');
    const country = document.getElementById('nt-country').value.trim();
    const city = document.getElementById('nt-city').value.trim();
    let title = document.getElementById('nt-title').value.trim();
    if (!title) { window.showToast('請輸入行程名稱'); return; }
    if (!start || !end) { window.showToast('請選擇日期'); return; }
    if (end < start) { window.showToast('結束日期不能早於開始日期'); return; }
    const trip = TripStore.create({ title, dateRange:{start,end}, country, city });
    window.navigate(`#/trip/${trip.id}`);
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  // Apply saved theme
  const s = SettingsStore.get();
  if (s.theme === 'dark') document.body.classList.add('dark');

  // Modal overlay click-outside close
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') window.closeModal();
  });

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => window.navigate(item.dataset.route));
  });

  loadGIS();
  route();

  // Check update silently on load
  setTimeout(() => window.checkUpdate(false), 3000);
}

document.addEventListener('DOMContentLoaded', init);

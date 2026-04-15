import { TripStore } from './modules/trip.js';
import { initTimelinePage } from './modules/timeline.js';
import { renderMapPage } from './modules/map.js';
import { renderSettingsPage, SettingsStore } from './modules/settings.js';
import { AuthService } from './modules/auth.js';

// ── Category definitions ─────────────────────────────────────────
window.CATEGORIES = {
  '風景':   { en:'SCENERY',       color:'#2EC4B6' },
  '美食':   { en:'FOOD',          color:'#FF9F43' },
  '遊樂':   { en:'ACTIVITY',      color:'#E8604C' },
  '購物':   { en:'SHOPPING',      color:'#FF6B9D' },
  '文化':   { en:'CULTURE',       color:'#7B68EE' },
  '住宿':   { en:'LODGING',       color:'#9B59B6' },
  '交通樞紐':{ en:'TRANSPORT',    color:'#5DADE2' },
  '娛樂':   { en:'ENTERTAINMENT', color:'#27AE60' },
};

// ── Global helpers ───────────────────────────────────────────────
window.showToast = (msg, dur=2500) => {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), dur);
};

window.openModal = (html) => {
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
  box.querySelector('input,textarea')?.focus();
};

window.closeModal = () => {
  document.getElementById('modal-overlay').style.display = 'none';
};

window.navigate = (hash) => { location.hash = hash; };

window.openMapForSpot = (name, city) => {
  window.open(`https://maps.google.com/?q=${encodeURIComponent((name+' '+city).trim())}`, '_blank');
};

// ── Current trip tracking ────────────────────────────────────────
window.currentTripId = localStorage.getItem('tripflow_current_trip') || '';

function ensureCurrentTrip() {
  const trips = TripStore.getAll();
  if (!window.currentTripId || !TripStore.get(window.currentTripId)) {
    window.currentTripId = trips[0]?.id || '';
    localStorage.setItem('tripflow_current_trip', window.currentTripId);
  }
}

window.setCurrentTrip = (id) => {
  window.currentTripId = id;
  localStorage.setItem('tripflow_current_trip', id);
};

// ── Auto Update ──────────────────────────────────────────────────
const LOCAL_VERSION = '1.1';
window.checkUpdate = async (manual=false) => {
  const base = (window.UPDATE_CONFIG?.repoRawBase||'').replace(/\/$/,'');
  if (!base) { if (manual) window.showToast('未設定更新來源'); return; }
  try {
    const res = await fetch(`${base}/version.json?t=${Date.now()}`);
    const data = await res.json();
    if (data.version !== LOCAL_VERSION) {
      if (confirm(`發現新版本 ${data.version}，立即更新？`)) {
        await Promise.all((await caches.keys()).map(k => caches.delete(k)));
        location.reload(true);
      }
    } else if (manual) window.showToast('已是最新版本 ✓');
  } catch { if (manual) window.showToast('檢查更新失敗'); }
};

// ── SW ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});

// ── GIS ──────────────────────────────────────────────────────────
function loadGIS() {
  if (document.querySelector('script[src*="accounts.google"]')) return;
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = () => AuthService.init();
  document.head.appendChild(s);
}

// ── Router ───────────────────────────────────────────────────────
function route() {
  const hash = location.hash || '#/home';
  ensureCurrentTrip();

  // Active nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (hash === '#/home') document.querySelector('[data-route="#/home"]')?.classList.add('active');
  else if (hash === '#/itinerary') document.querySelector('[data-route="#/itinerary"]')?.classList.add('active');
  else if (hash === '#/map') document.querySelector('[data-route="#/map"]')?.classList.add('active');
  else if (hash === '#/settings') document.querySelector('[data-route="#/settings"]')?.classList.add('active');

  window._refreshTimeline = null;

  if (hash === '#/home') return renderHome();
  if (hash === '#/itinerary') {
    if (!window.currentTripId) return renderHome();
    return initTimelinePage(window.currentTripId);
  }
  if (hash === '#/map') return renderMapPage();
  if (hash === '#/settings') return renderSettingsPage();
  if (hash === '#/new-trip') return renderNewTrip();

  // Legacy trip route → set current + go to itinerary
  const tm = hash.match(/^#\/trip\/([^/]+)$/);
  if (tm) {
    window.setCurrentTrip(tm[1]);
    location.replace('#/itinerary');
    return;
  }

  renderHome();
}

window.addEventListener('hashchange', route);

// ── Weather ──────────────────────────────────────────────────────
const _weatherCache = {};

async function fetchWeather(city) {
  if (!city) return null;
  if (_weatherCache[city]) return _weatherCache[city];
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (!res.ok) return null;
    const data = await res.json();
    _weatherCache[city] = data;
    return data;
  } catch { return null; }
}

function weatherEmoji(code) {
  const c = Number(code);
  if (c <= 113) return '☀️';
  if (c <= 116) return '⛅';
  if (c <= 143) return '☁️';
  if (c <= 200) return '🌦';
  if (c <= 260) return '❄️';
  if (c <= 315) return '🌨';
  if (c <= 395) return '⛈';
  return '☁️';
}

// ── Home Page ────────────────────────────────────────────────────
function renderHome() {
  const app = document.getElementById('app');
  const trips = TripStore.getAll();

  if (trips.length === 0) {
    app.innerHTML = `
      <div class="home-empty-state">
        <div class="home-empty-icon">🧭</div>
        <div class="home-empty-title">TripFlow</div>
        <div class="home-empty-sub">開始規劃你的第一趟旅程吧</div>
        <button class="btn-primary" style="margin-top:8px;padding:14px 32px" onclick="window.navigate('#/new-trip')">
          ＋ 建立行程
        </button>
      </div>`;
    return;
  }

  ensureCurrentTrip();
  const trip = TripStore.get(window.currentTripId);
  if (!trip) return;

  // Days countdown
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(trip.dateRange.start.replace(/\//g,'-'));
  const end   = new Date(trip.dateRange.end.replace(/\//g,'-'));
  let daysNum = '', daysLabel = '';
  if (start > today) {
    daysNum = Math.ceil((start - today) / 86400000);
    daysLabel = 'DAYS TO GO';
  } else if (end >= today) {
    daysLabel = 'ONGOING';
  } else {
    daysLabel = 'COMPLETED';
  }

  // Next stop
  const nowStr = new Date().toISOString().slice(0,16).replace('T',' ');
  const sorted = [...trip.spots].sort((a,b)=>(a.datetime||'').localeCompare(b.datetime||''));
  const nextSpot = sorted.find(s=>!s.datetime || s.datetime >= nowStr) || sorted[sorted.length-1];

  const heroStyle = nextSpot?.photo
    ? `background-image:url(${nextSpot.photo});background-size:cover;background-position:center`
    : `background:linear-gradient(135deg,#2D2D2D,#505060)`;

  app.innerHTML = `
    <div class="home-wrap">
      <div class="home-top">
        <div>
          <h1 class="home-city">${trip.city || trip.country || trip.title}</h1>
          <p class="home-trip-name">${trip.title}</p>
        </div>
        <div class="home-countdown">
          ${daysNum ? `<span class="home-days-num">${daysNum}</span>` : ''}
          <span class="home-days-label">${daysLabel}</span>
        </div>
      </div>
      <hr class="home-divider">

      ${nextSpot ? `
        <div class="hero-card" style="${heroStyle}" onclick="window.navigate('#/itinerary')">
          <div class="hero-overlay">
            <div class="hero-badge">NEXT STOP</div>
            <div class="hero-spot-name">${nextSpot.name}</div>
            <div class="hero-link">View Timeline ›</div>
          </div>
          <button class="hero-nav-btn" onclick="event.stopPropagation();window.openMapForSpot('${nextSpot.name.replace(/'/g,"\\'")}','${(trip.city||trip.country||'').replace(/'/g,"\\'")}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>` : `
        <div class="hero-card-empty" onclick="window.navigate('#/itinerary')">
          尚無景點，前往行程表新增 ›
        </div>`}

      <div id="weather-wrap" style="display:none">
        <div class="section-label" id="weather-label">HOURLY FORECAST</div>
        <div class="weather-strip" id="weather-strip"></div>
      </div>

      <div class="section-label">QUICK ACCESS</div>
      <div class="quick-access">
        <button class="qa-btn" onclick="window.navigate('#/itinerary')">
          <span class="qa-icon">📅</span>Itinerary
        </button>
        <button class="qa-btn" onclick="window.navigate('#/map')">
          <span class="qa-icon">🗺</span>Map
        </button>
        <button class="qa-btn" onclick="openTripsModal()">
          <span class="qa-icon">✈️</span>Trips
        </button>
      </div>
    </div>`;

  // Async weather
  const city = trip.city || trip.country;
  if (city) {
    fetchWeather(city).then(data => {
      if (!data) return;
      const hourly = data.weather?.[0]?.hourly;
      if (!hourly?.length) return;
      const wrap = document.getElementById('weather-wrap');
      const strip = document.getElementById('weather-strip');
      const label = document.getElementById('weather-label');
      if (!wrap || !strip) return;
      label.textContent = `HOURLY FORECAST · ${city.toUpperCase()}`;
      strip.innerHTML = hourly.map(h => {
        const hr = Math.floor(parseInt(h.time)/100);
        return `<div class="weather-slot">
          <span class="w-time">${String(hr).padStart(2,'0')}:00</span>
          <span class="w-icon">${weatherEmoji(h.weatherCode)}</span>
          <span class="w-temp">${h.tempC}°</span>
        </div>`;
      }).join('');
      wrap.style.display = 'block';
    });
  }
}

// ── Trips modal (from quick access) ─────────────────────────────
function openTripsModal() {
  const trips = TripStore.getAll();
  const items = trips.map(t => `
    <div class="trip-mgmt-card">
      <div class="trip-mgmt-info">
        <div class="trip-mgmt-title">${t.title}
          ${t.id === window.currentTripId ? '<span class="trip-current-tag">目前</span>' : ''}
        </div>
        <div class="trip-mgmt-sub">${t.dateRange.start} – ${t.dateRange.end} · ${t.spots?.length||0}個景點</div>
      </div>
      <div class="trip-mgmt-actions">
        ${t.id !== window.currentTripId
          ? `<button class="btn-secondary" style="font-size:12px;padding:8px 12px" onclick="window.setCurrentTrip('${t.id}');window.closeModal();window.navigate('#/home')">設為主頁</button>`
          : ''}
        <button class="btn-secondary" style="font-size:12px;padding:8px 12px" onclick="window.navigate('#/trip/${t.id}');window.closeModal()">查看</button>
      </div>
    </div>`).join('');

  window.openModal(`
    <h3>行程管理</h3>
    ${items || '<div style="color:var(--text-sub);font-size:14px">尚無行程</div>'}
    <button class="btn-primary btn-full" style="margin-top:12px" onclick="window.closeModal();window.navigate('#/new-trip')">＋ 新增行程</button>
  `);
}
window.openTripsModal = openTripsModal;

// ── New Trip ─────────────────────────────────────────────────────
function renderNewTrip() {
  const app = document.getElementById('app');
  const td = new Date().toISOString().slice(0,10);

  app.innerHTML = `
    <div class="page-hdr">
      <button class="back-btn" onclick="history.back()">‹</button>
      <span class="page-hdr-title">新建行程</span>
    </div>
    <div class="new-trip-body">
      <div class="form-group">
        <label class="form-label">開始日期</label>
        <input type="date" id="nt-start" value="${td}">
      </div>
      <div class="form-group">
        <label class="form-label">結束日期</label>
        <input type="date" id="nt-end" value="${td}">
      </div>
      <div class="form-group">
        <label class="form-label">國家</label>
        <input type="text" id="nt-country" placeholder="例：日本">
      </div>
      <div class="form-group">
        <label class="form-label">城市</label>
        <input type="text" id="nt-city" placeholder="例：東京">
      </div>
      <div class="form-group">
        <label class="form-label">行程名稱</label>
        <input type="text" id="nt-title" placeholder="例：東京五日遊">
      </div>
      <button class="btn-primary btn-full" id="nt-create" style="margin-top:8px">建立行程 →</button>
    </div>`;

  document.getElementById('nt-city').addEventListener('input', () => {
    const city = document.getElementById('nt-city').value.trim();
    const titleEl = document.getElementById('nt-title');
    if (city && !titleEl.value) {
      const s = document.getElementById('nt-start').value;
      const e = document.getElementById('nt-end').value;
      const days = s && e ? Math.round((new Date(e)-new Date(s))/86400000)+1 : '';
      titleEl.value = `${city}${days ? days+'日遊' : '之旅'}`;
    }
  });

  document.getElementById('nt-create').addEventListener('click', () => {
    const start = document.getElementById('nt-start').value.replace(/-/g,'/');
    const end   = document.getElementById('nt-end').value.replace(/-/g,'/');
    const country = document.getElementById('nt-country').value.trim();
    const city  = document.getElementById('nt-city').value.trim();
    const title = document.getElementById('nt-title').value.trim();
    if (!title) { window.showToast('請輸入行程名稱'); return; }
    if (!start || !end) { window.showToast('請選擇日期'); return; }
    if (end < start) { window.showToast('結束日期不能早於開始日期'); return; }
    const trip = TripStore.create({ title, dateRange:{start,end}, country, city });
    window.setCurrentTrip(trip.id);
    window.navigate('#/itinerary');
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  const s = SettingsStore.get();
  if (s.theme === 'dark') document.body.classList.add('dark');

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') window.closeModal();
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => window.navigate(item.dataset.route));
  });

  loadGIS();
  route();
  setTimeout(() => window.checkUpdate(false), 3000);
}

document.addEventListener('DOMContentLoaded', init);

import { TripStore } from './trip.js';
import { TRANSPORT_MODES, openTransportModal } from './transport.js';
import { renderChecklistSection } from './checklist.js';

const WEEKDAYS = ['週日','週一','週二','週三','週四','週五','週六'];

function formatTime(datetime) {
  if (!datetime) return '';
  const t = datetime.split(' ')[1]; if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2,'0')}:${String(m||0).padStart(2,'0')} ${period}`;
}

function transportIcon(mode) {
  return TRANSPORT_MODES.find(m=>m.mode===mode)?.icon || '🚌';
}

// ── Spot detail bottom sheet ──────────────────────────────────────
window.openSpotDetail = (tripId, spotId) => {
  const trip = TripStore.get(tripId);
  const spot = trip?.spots.find(s=>s.id===spotId);
  if (!spot) return;

  const CAT = window.CATEGORIES?.[spot.category] || { en: spot.category||'', color:'#888' };
  const timeStr = formatTime(spot.datetime);
  const dateStr = spot.datetime?.split(' ')[0] || '';
  const tr = spot.transportToNext;

  window.openModal(`
    <div class="detail-hdr">
      <span class="detail-cat-badge" style="color:${CAT.color};background:${CAT.color}18">${CAT.en}</span>
      <button class="detail-close-btn" onclick="window.closeModal()">✕</button>
    </div>
    ${spot.photo ? `<img src="${spot.photo}" class="detail-photo">` : ''}
    <h2 class="detail-name">${spot.name}</h2>
    ${timeStr || dateStr ? `<div class="detail-time">🕐 ${timeStr}${dateStr?' · '+dateStr:''}</div>` : ''}
    ${spot.note ? `<div class="detail-note">${spot.note}</div>` : ''}
    ${tr ? `<div class="detail-transport-row">${transportIcon(tr.mode)} ${tr.duration}分鐘${tr.note?' · '+tr.note:''}</div>` : ''}
    <div class="detail-section-title">清單</div>
    <div id="detail-ck"></div>
    <div class="detail-actions">
      <button class="btn-secondary" onclick="window.closeModal();window._openTransportDetail('${tripId}','${spotId}')">🚌 交通</button>
      <button class="btn-secondary" onclick="window.closeModal();window._editSpotDetail('${tripId}','${spotId}')">✏️ 編輯</button>
      <button class="btn-danger" onclick="window._deleteSpotDetail('${tripId}','${spotId}')">🗑</button>
    </div>`);

  const ckWrap = document.getElementById('detail-ck');
  renderChecklistSection(tripId, spotId, spot.checklist, ckWrap);
};

window._openTransportDetail = (tripId, spotId) => {
  const trip = TripStore.get(tripId);
  const spot = trip?.spots.find(s=>s.id===spotId);
  openTransportModal(tripId, spotId, spot?.transportToNext||null);
};

window._editSpotDetail = (tripId, spotId) => {
  const trip = TripStore.get(tripId);
  openSpotModal(tripId, trip?.spots.find(s=>s.id===spotId)||null);
};

window._deleteSpotDetail = (tripId, spotId) => {
  const trip = TripStore.get(tripId);
  const spot = trip?.spots.find(s=>s.id===spotId);
  if (!spot) return;
  if (!confirm(`刪除「${spot.name}」？`)) return;
  TripStore.deleteSpot(tripId, spotId);
  window.closeModal();
  window._refreshTimeline?.();
};

// ── Spot create/edit modal ────────────────────────────────────────
function openSpotModal(tripId, spot) {
  const cats = Object.entries(window.CATEGORIES||{}).map(([k,v]) =>
    `<button class="cat-btn${(spot?.category||'風景')===k?' active':''}" data-cat="${k}">${k}</button>`
  ).join('');

  const existingPhoto = spot?.photo || '';
  window._tempSpotPhoto = existingPhoto;

  window.openModal(`
    <h3>${spot ? '編輯景點' : '新增景點'}</h3>
    <div class="spot-photo-upload-area" id="sp-photo-area">
      ${existingPhoto
        ? `<img src="${existingPhoto}" id="sp-photo-preview-img">`
        : `<div class="spot-photo-upload-label">📷<br><span style="font-size:11px">封面照片（選填）</span></div>`}
    </div>
    <input type="file" accept="image/*" id="sp-photo-file" style="display:none">
    <label class="form-label" style="margin-bottom:4px">名稱</label>
    <input type="text" id="sp-name" value="${spot?.name||''}" placeholder="景點名稱" style="margin-bottom:12px">
    <label class="form-label" style="margin-bottom:4px">日期時間</label>
    <input type="datetime-local" id="sp-dt" value="${spot?.datetime ? spot.datetime.slice(0,16).replace(' ','T') : ''}" style="margin-bottom:12px">
    <label class="form-label" style="margin-bottom:6px">類別</label>
    <div class="cat-grid" style="margin-bottom:12px">${cats}</div>
    <label class="form-label" style="margin-bottom:4px">備註</label>
    <textarea id="sp-note" rows="2" placeholder="自由備註" style="margin-bottom:12px">${spot?.note||''}</textarea>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="window.closeModal()">取消</button>
      <button class="btn-primary" id="sp-save-btn">儲存</button>
    </div>`);

  let selCat = spot?.category || '風景';
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); selCat = btn.dataset.cat;
    });
  });

  // Photo upload
  const photoArea = document.getElementById('sp-photo-area');
  const photoFile = document.getElementById('sp-photo-file');
  photoArea.addEventListener('click', () => photoFile.click());
  photoFile.addEventListener('change', async () => {
    const file = photoFile.files[0]; if (!file) return;
    const dataUrl = await compressPhoto(file);
    window._tempSpotPhoto = dataUrl;
    photoArea.innerHTML = `<img src="${dataUrl}" id="sp-photo-preview-img">`;
  });

  document.getElementById('sp-save-btn').addEventListener('click', () => {
    const name = document.getElementById('sp-name').value.trim();
    const dt   = document.getElementById('sp-dt').value.replace('T',' ');
    const note = document.getElementById('sp-note').value.trim();
    if (!name) { window.showToast('請輸入景點名稱'); return; }
    const patch = { name, datetime:dt, category:selCat, note, photo:window._tempSpotPhoto||'' };
    if (spot) {
      TripStore.updateSpot(tripId, spot.id, patch);
    } else {
      TripStore.addSpot(tripId, patch);
    }
    window.closeModal();
    window._refreshTimeline?.();
  });
}

async function compressPhoto(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 800;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h*max/w); w = max; }
        else { w = Math.round(w*max/h); h = max; }
      }
      const c = document.createElement('canvas');
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg',0.75));
    };
    img.src = url;
  });
}

// ── Date strip ───────────────────────────────────────────────────
function buildDateRange(trip) {
  if (!trip.dateRange?.start || !trip.dateRange?.end) return [];
  const start = new Date(trip.dateRange.start.replace(/\//g,'-'));
  const end   = new Date(trip.dateRange.end.replace(/\//g,'-'));
  const days = [];
  const d = new Date(start);
  while (d <= end && days.length < 60) {
    days.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate()+1);
  }
  return days;
}

function renderDateStrip(dates, selected, onSelect) {
  const today = new Date().toISOString().slice(0,10);
  return `<div class="date-strip-wrap"><div class="date-strip" id="date-strip">
    ${dates.map(d => {
      const dt = new Date(d+'T00:00:00');
      const isToday = d === today;
      return `<button class="date-pill${d===selected?' active':''}" data-date="${d}">
        <span class="dpw">${WEEKDAYS[dt.getDay()]}${isToday?' ●':''}</span>
        <span class="dpn">${dt.getDate()}</span>
      </button>`;
    }).join('')}
  </div></div>`;
}

// ── Main timeline page ────────────────────────────────────────────
let _currentSelectedDate = '';

export function initTimelinePage(tripId) {
  const trip = TripStore.get(tripId);
  if (!trip) { window.navigate('#/home'); return; }

  const dates = buildDateRange(trip);
  const today = new Date().toISOString().slice(0,10);

  // Init selected date
  if (!_currentSelectedDate || !dates.includes(_currentSelectedDate)) {
    _currentSelectedDate = dates.includes(today) ? today : (dates[0] || today);
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="tl-page-hdr">
      <span class="tl-page-title">行程表</span>
      <button class="tl-trip-switcher" onclick="window.openTripsModal?.()">
        ${trip.city || trip.title} ▾
      </button>
    </div>
    ${dates.length ? renderDateStrip(dates, _currentSelectedDate, () => {}) : ''}
    <div id="tl-spots-wrap"></div>
    <button class="tl-fab" id="tl-fab">＋</button>`;

  // Date strip click
  app.querySelectorAll('.date-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentSelectedDate = btn.dataset.date;
      app.querySelectorAll('.date-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderSpotsList(tripId, _currentSelectedDate);
      // Scroll active date into view
      btn.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
    });
  });

  // Scroll today into view
  const activeDate = app.querySelector('.date-pill.active');
  if (activeDate) setTimeout(() => activeDate.scrollIntoView({ block:'nearest', inline:'center' }), 100);

  document.getElementById('tl-fab').addEventListener('click', () => openSpotModal(tripId, null));

  window._refreshTimeline = () => {
    renderSpotsList(tripId, _currentSelectedDate);
    // also update header in case trip changed
    const freshTrip = TripStore.get(tripId);
    const sw = app.querySelector('.tl-trip-switcher');
    if (sw && freshTrip) sw.textContent = (freshTrip.city || freshTrip.title) + ' ▾';
  };

  renderSpotsList(tripId, _currentSelectedDate);
}

function renderSpotsList(tripId, selectedDate) {
  const wrap = document.getElementById('tl-spots-wrap');
  if (!wrap) return;
  const trip = TripStore.get(tripId);
  if (!trip) return;

  // Filter: spots on selected date OR spots with no datetime (always show)
  const all = [...trip.spots].sort((a,b)=>(a.datetime||'').localeCompare(b.datetime||''));
  const dated   = all.filter(s => s.datetime && s.datetime.split(' ')[0].replace(/\//g,'-') === selectedDate);
  const undated = all.filter(s => !s.datetime);

  if (dated.length === 0 && undated.length === 0) {
    wrap.innerHTML = `
      <div class="tl-empty">
        <div class="tl-empty-icon">📍</div>
        <div class="tl-empty-text">這天尚無景點</div>
      </div>`;
    return;
  }

  let html = '<div class="spots-list">';

  // Dated spots with transport between them
  dated.forEach((spot, idx) => {
    html += renderSpotCard(spot, trip);
    if (idx < dated.length - 1 && spot.transportToNext) {
      const tr = spot.transportToNext;
      html += `<div class="tl-transport-row">
        <div class="tl-transport-pill" onclick="window._openTransportDetail('${tripId}','${spot.id}')">
          ${transportIcon(tr.mode)} ${tr.duration}分鐘${tr.note?' · '+tr.note:''}
        </div>
      </div>`;
    } else if (idx < dated.length - 1) {
      html += `<div class="tl-transport-row">
        <div class="tl-transport-add" onclick="window._openTransportDetail('${tripId}','${spot.id}')">＋ 交通方式</div>
      </div>`;
    }
  });

  // Undated spots
  if (undated.length) {
    if (dated.length) html += `<div class="section-label" style="margin:8px 4px 4px">未指定時間</div>`;
    undated.forEach(spot => { html += renderSpotCard(spot, trip); });
  }

  html += '</div>';
  wrap.innerHTML = html;
}

function renderSpotCard(spot, trip) {
  const CAT = window.CATEGORIES?.[spot.category] || { en: spot.category||'', color:'#888' };
  const timeStr = formatTime(spot.datetime);
  const doneCount = spot.checklist.filter(c=>c.done).length;
  const total = spot.checklist.length;
  const ckBadge = total > 0 ? `<span class="ck-count">${doneCount}/${total}</span>` : '';

  const photoStyle = spot.photo
    ? `background-image:url(${spot.photo});background-size:cover;background-position:center`
    : `background:linear-gradient(135deg,${CAT.color}33,${CAT.color}11)`;

  const cityQ = (trip.city||trip.country||'').replace(/'/g,"\\'");
  const nameQ = spot.name.replace(/'/g,"\\'");

  return `<div class="spot-card" onclick="window.openSpotDetail('${trip.id}','${spot.id}')">
    <div class="spot-photo" style="${photoStyle}">
      ${!spot.photo ? `<div class="spot-photo-placeholder">${spot.category?.[0]||'📍'}</div>` : ''}
      <button class="spot-nav-btn" onclick="event.stopPropagation();window.openMapForSpot('${nameQ}','${cityQ}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <div class="spot-info">
      <div class="spot-meta-row">
        ${timeStr ? `<span class="spot-time-pill">${timeStr}</span>` : ''}
        <span class="spot-cat-badge" style="color:${CAT.color}">${CAT.en}</span>
        ${ckBadge}
      </div>
      <div class="spot-name">${spot.name}</div>
      <div class="spot-detail-hint">ⓘ 點擊查看詳情</div>
    </div>
  </div>`;
}

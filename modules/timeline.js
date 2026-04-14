import { TripStore } from './trip.js';
import { TRANSPORT_MODES, openTransportModal } from './transport.js';
import { renderChecklistSection } from './checklist.js';

const CAT_ICONS = {
  '風景':'🏔','美食':'🍜','遊樂':'🎢','購物':'🛍','文化':'🏛','住宿':'🏨','交通樞紐':'🚉'
};
const CATEGORIES = Object.keys(CAT_ICONS);

function transportIcon(mode) {
  return TRANSPORT_MODES.find(m=>m.mode===mode)?.icon || '🚌';
}

function openSpotModal(tripId, spot) {
  const cats = CATEGORIES.map(c =>
    `<button class="cat-btn${(spot?.category||'風景')===c?' active':''}" data-cat="${c}">${CAT_ICONS[c]} ${c}</button>`
  ).join('');

  window.openModal(`
    <h3>${spot ? '編輯景點' : '新增景點'}</h3>
    <label>名稱 <input type="text" id="sp-name" value="${spot?.name||''}" placeholder="景點名稱" style="width:100%;margin-top:6px"></label>
    <label style="margin-top:10px;display:block">日期時間
      <input type="datetime-local" id="sp-dt" value="${spot?.datetime ? spot.datetime.replace(' ','T') : ''}" style="width:100%;margin-top:6px">
    </label>
    <div style="margin-top:10px">
      <div style="margin-bottom:6px;font-size:13px;color:var(--text-sub)">類別</div>
      <div class="cat-grid">${cats}</div>
    </div>
    <label style="margin-top:10px;display:block">備註
      <textarea id="sp-note" rows="2" placeholder="自由備註" style="width:100%;margin-top:6px">${spot?.note||''}</textarea>
    </label>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="window.closeModal()">取消</button>
      <button class="btn-primary" id="sp-save-btn">儲存</button>
    </div>`);

  let selCat = spot?.category || '風景';
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selCat = btn.dataset.cat;
    });
  });

  document.getElementById('sp-save-btn').addEventListener('click', () => {
    const name = document.getElementById('sp-name').value.trim();
    const dt = document.getElementById('sp-dt').value.replace('T',' ');
    const note = document.getElementById('sp-note').value.trim();
    if (!name) { window.showToast('請輸入景點名稱'); return; }
    if (spot) {
      TripStore.updateSpot(tripId, spot.id, { name, datetime:dt, category:selCat, note });
    } else {
      TripStore.addSpot(tripId, { name, datetime:dt, category:selCat, note });
    }
    window.closeModal();
    if (window._refreshTimeline) window._refreshTimeline();
  });
}

export function initTimelinePage(tripId) {
  const trip = TripStore.get(tripId);
  if (!trip) { window.navigate('#/home'); return; }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="tl-header">
      <button class="icon-btn back-btn" onclick="window.navigate('#/home')">‹</button>
      <div class="tl-title">
        <span>${trip.title}</span>
        <span class="tl-dates">${trip.dateRange.start} – ${trip.dateRange.end}</span>
      </div>
      <button class="icon-btn" id="tl-menu-btn">⋯</button>
    </div>
    <div class="tl-scroll" id="tl-scroll">
      <div class="tl-content" id="tl-content"></div>
    </div>
    <button class="tl-add-btn" id="tl-add-spot">＋ 新增景點</button>`;

  document.getElementById('tl-add-spot').addEventListener('click', () => openSpotModal(tripId, null));

  document.getElementById('tl-menu-btn').addEventListener('click', () => {
    window.openModal(`
      <h3>行程操作</h3>
      <div class="modal-actions" style="flex-direction:column;gap:10px">
        <button class="btn-primary" onclick="window.closeModal();window.navigate('#/map')">🗺 地圖總覽</button>
        <button class="btn-secondary" id="tl-edit-trip">✏️ 編輯行程資訊</button>
        <button class="btn-danger" id="tl-del-trip">🗑 刪除行程</button>
        <button class="btn-secondary" onclick="window.closeModal()">取消</button>
      </div>`);
    document.getElementById('tl-del-trip').addEventListener('click', () => {
      if (confirm('確定刪除此行程？')) { TripStore.delete(tripId); window.closeModal(); window.navigate('#/home'); }
    });
    document.getElementById('tl-edit-trip').addEventListener('click', () => {
      window.closeModal();
      openEditTripModal(tripId);
    });
  });

  window._refreshTimeline = () => renderTimelineContent(tripId);
  renderTimelineContent(tripId);
}

function openEditTripModal(tripId) {
  const trip = TripStore.get(tripId);
  window.openModal(`
    <h3>編輯行程資訊</h3>
    <label>標題 <input type="text" id="et-title" value="${trip.title}" style="width:100%;margin-top:6px"></label>
    <label style="margin-top:10px;display:block">國家 <input type="text" id="et-country" value="${trip.country||''}" style="width:100%;margin-top:6px"></label>
    <label style="margin-top:10px;display:block">城市 <input type="text" id="et-city" value="${trip.city||''}" style="width:100%;margin-top:6px"></label>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="window.closeModal()">取消</button>
      <button class="btn-primary" id="et-save">儲存</button>
    </div>`);
  document.getElementById('et-save').addEventListener('click', () => {
    const title = document.getElementById('et-title').value.trim();
    if (!title) return;
    const t = TripStore.get(tripId);
    t.title = title;
    t.country = document.getElementById('et-country').value.trim();
    t.city = document.getElementById('et-city').value.trim();
    t.updatedAt = new Date().toISOString();
    TripStore.save(t);
    window.closeModal();
    window._refreshTimeline && window._refreshTimeline();
    // update header title
    const titleEl = document.querySelector('.tl-title span');
    if (titleEl) titleEl.textContent = title;
  });
}

function renderTimelineContent(tripId) {
  const trip = TripStore.get(tripId);
  if (!trip) return;
  const content = document.getElementById('tl-content');
  if (!content) return;

  // Sort ascending by datetime, then reverse for display (furthest=top, nearest=bottom)
  const spots = [...trip.spots].sort((a,b) => (a.datetime||'').localeCompare(b.datetime||''));
  const displayed = [...spots].reverse();

  content.innerHTML = '';

  if (displayed.length === 0) {
    content.innerHTML = '<div class="tl-empty">尚無景點，點擊下方 ＋ 開始規劃</div>';
    return;
  }

  displayed.forEach((spot, idx) => {
    // Spot card
    const card = document.createElement('div');
    card.className = 'tl-card';
    card.dataset.spotid = spot.id;

    const doneCount = spot.checklist.filter(c=>c.done).length;
    const totalCount = spot.checklist.length;
    const ckBadge = totalCount > 0 ? `<span class="ck-badge">${doneCount}/${totalCount}</span>` : '';

    card.innerHTML = `
      <div class="tl-card-header">
        <span class="tl-time">${spot.datetime ? spot.datetime.split(' ')[1]||'' : ''}</span>
        <span class="tl-date-label">${spot.datetime ? spot.datetime.split(' ')[0]||'' : ''}</span>
        <div class="tl-card-main">
          <span class="tl-cat-icon">${CAT_ICONS[spot.category]||'📍'}</span>
          <span class="tl-spot-name">${spot.name}</span>
          ${ckBadge}
        </div>
        <div class="tl-card-actions">
          <button class="icon-btn tl-edit-spot" data-spotid="${spot.id}" title="編輯">✏️</button>
          <button class="icon-btn tl-del-spot" data-spotid="${spot.id}" title="刪除">🗑</button>
          <button class="icon-btn tl-expand-btn" data-spotid="${spot.id}">▼</button>
        </div>
      </div>
      ${spot.note ? `<div class="tl-note">${spot.note}</div>` : ''}
      <div class="tl-checklist-wrap" id="ck-wrap-${spot.id}" style="display:none"></div>`;

    content.appendChild(card);

    // Transport pill between spots (after this card = before next in ascending order)
    // In reversed display: between card[idx] and card[idx+1], transport belongs to spots[spots.length-1-idx]
    const ascIdx = spots.length - 1 - idx;
    const srcSpot = spots[ascIdx]; // this spot in ascending order
    if (ascIdx > 0) {
      // transport from srcSpot leads to spots[ascIdx-1] (next in time = below in reversed display)
    }
    // Actually: in reversed display, card at position idx corresponds to ascending spot at (spots.length-1-idx)
    // The transport pill should appear BELOW the card (between this and the next chronological spot below)
    // = the transport of spots[ascIdx] (the spot one step earlier in time)
    const prevAscIdx = ascIdx - 1; // spot that is chronologically just before
    if (prevAscIdx >= 0) {
      const prevSpot = spots[prevAscIdx];
      // Show prevSpot's transportToNext (it travels TO srcSpot from prevSpot - but visually below srcSpot)
      // Actually the architecture says transportToNext = from this spot to the NEXT one
      // In the reversed display (top=far, bottom=near), between spot A (higher) and spot B (lower/earlier):
      // spot B's transportToNext leads to spot A. So we show spot B's transport BELOW spot A.
      // prevSpot = spots[ascIdx-1], srcSpot.transportToNext goes from srcSpot -> spots[ascIdx+1] (higher in display)
      // The pill we want below this card (srcSpot) is srcSpot.transportToNext going UP... 
      // Let me simplify: transport pill belongs to prevSpot.transportToNext, shown below this card
      if (prevSpot.transportToNext) {
        const t = prevSpot.transportToNext;
        const icon = transportIcon(t.mode);
        const pill = document.createElement('div');
        pill.className = 'tl-transport-pill';
        pill.dataset.spotid = prevSpot.id;
        pill.innerHTML = `<span>${icon}</span><span>${t.duration}分鐘</span>${t.note?`<span class="tr-note">${t.note}</span>`:''}`;
        pill.addEventListener('click', () => openTransportModal(tripId, prevSpot.id, prevSpot.transportToNext));
        content.appendChild(pill);
      } else {
        const addPill = document.createElement('div');
        addPill.className = 'tl-transport-add';
        addPill.dataset.spotid = prevSpot.id;
        addPill.innerHTML = '＋ 交通';
        addPill.addEventListener('click', () => openTransportModal(tripId, prevSpot.id, null));
        content.appendChild(addPill);
      }
    }

    // Expand/collapse
    card.querySelector('.tl-expand-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = document.getElementById(`ck-wrap-${spot.id}`);
      const btn = e.currentTarget;
      const isOpen = wrap.style.display !== 'none';
      if (isOpen) { wrap.style.display='none'; btn.textContent='▼'; }
      else {
        wrap.style.display='block'; btn.textContent='▲';
        const fresh = TripStore.get(tripId);
        const freshSpot = fresh.spots.find(s=>s.id===spot.id);
        renderChecklistSection(tripId, spot.id, freshSpot.checklist, wrap);
      }
    });

    card.querySelector('.tl-edit-spot').addEventListener('click', (e) => {
      e.stopPropagation();
      const fresh = TripStore.get(tripId);
      openSpotModal(tripId, fresh.spots.find(s=>s.id===spot.id));
    });

    card.querySelector('.tl-del-spot').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`刪除景點「${spot.name}」？`)) {
        TripStore.deleteSpot(tripId, spot.id);
        renderTimelineContent(tripId);
      }
    });
  });

  // Scroll to bottom on first render
  const scroll = document.getElementById('tl-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

import { TripStore } from './trip.js';

export const TRANSPORT_MODES = [
  { mode:'walk',   icon:'🚶', label:'步行' },
  { mode:'train',  icon:'🚃', label:'電車/捷運' },
  { mode:'bus',    icon:'🚌', label:'巴士' },
  { mode:'car',    icon:'🚗', label:'自駕' },
  { mode:'taxi',   icon:'🚕', label:'計程車' },
  { mode:'bike',   icon:'🚲', label:'自行車' },
  { mode:'flight', icon:'✈️', label:'飛機' },
  { mode:'ferry',  icon:'⛴', label:'渡輪' }
];

export function openTransportModal(tripId, spotId, current) {
  const cur = current || { mode:'train', duration:30, note:'' };
  const modeButtons = TRANSPORT_MODES.map(m =>
    `<button class="mode-btn${cur.mode===m.mode?' active':''}" data-mode="${m.mode}">${m.icon} ${m.label}</button>`
  ).join('');

  window.openModal(`
    <h3>設定交通方式</h3>
    <div class="mode-grid">${modeButtons}</div>
    <label>時間 (分鐘)
      <input type="number" id="tr-dur" value="${cur.duration}" min="1" max="9999" style="width:100%;margin-top:6px">
    </label>
    <label style="margin-top:12px;display:block">備註
      <input type="text" id="tr-note" value="${cur.note||''}" placeholder="例：銀座線→上野站" style="width:100%;margin-top:6px">
    </label>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="window.closeModal()">取消</button>
      <button class="btn-primary" id="save-transport-btn">儲存</button>
    </div>
  `);

  let selectedMode = cur.mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
    });
  });

  document.getElementById('save-transport-btn').addEventListener('click', () => {
    const duration = parseInt(document.getElementById('tr-dur').value) || 30;
    const note = document.getElementById('tr-note').value.trim();
    TripStore.setTransport(tripId, spotId, { mode:selectedMode, duration, note });
    window.closeModal();
    if (window._refreshTimeline) window._refreshTimeline();
  });
}

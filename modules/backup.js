const KEY = 'tripflow_backups';
const MAX_SLOTS = 5;

function loadBackups() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"slots":[]}'); } catch { return {slots:[]}; }
}
function saveBackups(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

export const BackupService = {
  create() {
    const data = loadBackups();
    const tripData = localStorage.getItem('tripflow_trips') || '{}';
    const settings = localStorage.getItem('tripflow_settings') || '{}';
    const slot = {
      id: 'bk_' + Date.now(),
      timestamp: new Date().toISOString(),
      trips: JSON.parse(tripData),
      settings: JSON.parse(settings)
    };
    data.slots.unshift(slot);
    if (data.slots.length > MAX_SLOTS) data.slots = data.slots.slice(0, MAX_SLOTS);
    saveBackups(data);
    return slot;
  },

  list() { return loadBackups().slots; },

  restore(id) {
    const data = loadBackups();
    const slot = data.slots.find(s=>s.id===id);
    if (!slot) return false;
    localStorage.setItem('tripflow_trips', JSON.stringify(slot.trips));
    localStorage.setItem('tripflow_settings', JSON.stringify(slot.settings));
    return true;
  },

  delete(id) {
    const data = loadBackups();
    data.slots = data.slots.filter(s=>s.id!==id);
    saveBackups(data);
  },

  export() {
    const data = {
      exportTime: new Date().toISOString(),
      trips: JSON.parse(localStorage.getItem('tripflow_trips') || '{}'),
      settings: JSON.parse(localStorage.getItem('tripflow_settings') || '{}')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TripFlow_export_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  import(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.trips) localStorage.setItem('tripflow_trips', JSON.stringify(data.trips));
      if (data.settings) localStorage.setItem('tripflow_settings', JSON.stringify(data.settings));
      return true;
    } catch { return false; }
  }
};

export function renderBackupUI(container) {
  const slots = BackupService.list();
  container.innerHTML = `
    <div class="backup-actions">
      <button class="btn-primary" id="bk-create">📦 立即備份</button>
      <button class="btn-secondary" id="bk-export">⬇️ 匯出 JSON</button>
      <label class="btn-secondary" style="cursor:pointer">
        ⬆️ 匯入 JSON
        <input type="file" accept=".json" id="bk-import-file" style="display:none">
      </label>
    </div>
    <div class="backup-list">
      ${slots.length === 0 ? '<div class="backup-empty">尚無備份</div>' : slots.map((s,i) => `
        <div class="backup-slot">
          <div class="backup-slot-info">
            <span class="backup-num">Slot ${i+1}</span>
            <span class="backup-time">${new Date(s.timestamp).toLocaleString('zh-TW')}</span>
          </div>
          <div class="backup-slot-actions">
            <button class="btn-secondary bk-restore" data-id="${s.id}">復原</button>
            <button class="btn-danger bk-del" data-id="${s.id}">刪除</button>
          </div>
        </div>`).join('')}
    </div>`;

  container.querySelector('#bk-create').addEventListener('click', () => {
    BackupService.create();
    renderBackupUI(container);
    window.showToast('備份完成');
  });

  container.querySelector('#bk-export').addEventListener('click', () => { BackupService.export(); });

  container.querySelector('#bk-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (BackupService.import(ev.target.result)) { window.showToast('匯入成功，請重新整理'); }
      else { window.showToast('匯入失敗，請確認檔案格式'); }
    };
    reader.readAsText(file);
  });

  container.querySelectorAll('.bk-restore').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('確定復原？目前資料將被覆蓋')) {
        if (BackupService.restore(btn.dataset.id)) { window.showToast('復原成功'); window.navigate('#/home'); }
        else window.showToast('復原失敗');
      }
    });
  });

  container.querySelectorAll('.bk-del').forEach(btn => {
    btn.addEventListener('click', () => {
      BackupService.delete(btn.dataset.id);
      renderBackupUI(container);
    });
  });
}

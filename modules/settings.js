import { AuthService } from './auth.js';
import { DriveService } from './drive.js';
import { renderBackupUI } from './backup.js';

const KEY = 'tripflow_settings';

export const SettingsStore = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { return {}; } },
  set(patch) {
    const s = SettingsStore.get();
    localStorage.setItem(KEY, JSON.stringify({...s,...patch}));
  }
};

export function renderSettingsPage() {
  const app = document.getElementById('app');
  const s = SettingsStore.get();
  const isDark = document.body.classList.contains('dark');

  app.innerHTML = `
    <div class="page-hdr">
      <span class="page-hdr-title">設定</span>
    </div>
    <div class="settings-body">

      <div class="settings-section">
        <div class="settings-section-title">行程管理</div>
        <div id="trip-mgmt-list"></div>
        <button class="btn-secondary btn-full" style="margin-top:8px" onclick="window.navigate('#/new-trip')">＋ 新增行程</button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">外觀</div>
        <div class="settings-row">
          <span>深色模式</span>
          <label class="toggle-sw">
            <input type="checkbox" id="theme-toggle" ${isDark?'checked':''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Google Drive</div>
        <div class="settings-row col">
          <span class="settings-col-label">Client ID</span>
          <input type="text" id="drive-client-id" value="${s.driveClientId||''}" placeholder="your-client-id.apps.googleusercontent.com">
        </div>
        <div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="save-client-id">儲存 Client ID</button>
        </div>
        <div class="settings-row" style="margin-top:10px">
          ${AuthService.isSignedIn()
            ? `<span class="signed-in">✅ 已登入</span><button class="btn-secondary" id="drive-signout">登出</button>`
            : `<button class="btn-primary" id="drive-signin">登入 Google Drive</button>`}
        </div>
        ${AuthService.isSignedIn() ? `<div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="drive-sync">☁️ 立即同步</button>
        </div>` : ''}
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Google Maps</div>
        <div class="settings-row col">
          <span class="settings-col-label">Maps API Key</span>
          <input type="text" id="maps-api-key" value="${s.mapsApiKey||''}" placeholder="AIza...">
        </div>
        <div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="save-maps-key">儲存 Key</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">備份與復原</div>
        <div id="backup-container"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">更新</div>
        <div class="settings-row">
          <button class="btn-secondary" id="check-update-btn">🔄 檢查更新</button>
        </div>
      </div>

    </div>`;

  // Trip management list
  _renderTripMgmt();

  document.getElementById('theme-toggle').addEventListener('change', e => {
    document.body.classList.toggle('dark', e.target.checked);
    SettingsStore.set({ theme: e.target.checked ? 'dark' : 'light' });
  });

  document.getElementById('save-client-id').addEventListener('click', () => {
    SettingsStore.set({ driveClientId: document.getElementById('drive-client-id').value.trim() });
    window.showToast('Client ID 已儲存');
  });

  document.getElementById('save-maps-key')?.addEventListener('click', () => {
    SettingsStore.set({ mapsApiKey: document.getElementById('maps-api-key').value.trim() });
    window.showToast('Maps API Key 已儲存');
  });

  document.getElementById('drive-signin')?.addEventListener('click', () => {
    AuthService.signIn(() => {
      SettingsStore.set({ googleAccount:'signed_in' });
      renderSettingsPage();
      window.showToast('已登入 Google Drive');
    });
  });

  document.getElementById('drive-signout')?.addEventListener('click', () => {
    AuthService.signOut();
    renderSettingsPage();
    window.showToast('已登出');
  });

  document.getElementById('drive-sync')?.addEventListener('click', async () => {
    window.showToast('同步中…');
    try {
      const { TripStore } = await import('./trip.js');
      await DriveService.syncAll(TripStore.getAll());
      window.showToast('同步完成');
    } catch(e) { window.showToast('同步失敗：'+e.message); }
  });

  document.getElementById('check-update-btn').addEventListener('click', () => window.checkUpdate(true));

  renderBackupUI(document.getElementById('backup-container'));
}

function _renderTripMgmt() {
  import('./trip.js').then(({ TripStore }) => {
    const trips = TripStore.getAll();
    const container = document.getElementById('trip-mgmt-list');
    if (!container) return;
    if (!trips.length) {
      container.innerHTML = '<div style="color:var(--text-sub);font-size:14px;margin-bottom:8px">尚無行程</div>';
      return;
    }
    container.innerHTML = trips.map(t => `
      <div class="trip-mgmt-card">
        <div class="trip-mgmt-info">
          <div class="trip-mgmt-title">${t.title} ${t.id===window.currentTripId?'<span class="trip-current-tag">目前</span>':''}</div>
          <div class="trip-mgmt-sub">${t.dateRange.start} – ${t.dateRange.end}</div>
        </div>
        <div class="trip-mgmt-actions">
          ${t.id!==window.currentTripId
            ? `<button class="btn-secondary" style="font-size:12px;padding:8px 10px" onclick="window.setCurrentTrip('${t.id}');window.navigate('#/home')">設主頁</button>` : ''}
          <button class="btn-danger" style="font-size:12px;padding:8px 10px" onclick="_deleteTripFromSettings('${t.id}')">🗑</button>
        </div>
      </div>`).join('');
  });
}

window._deleteTripFromSettings = (id) => {
  import('./trip.js').then(({ TripStore }) => {
    const trip = TripStore.get(id);
    if (!trip) return;
    if (!confirm(`刪除「${trip.title}」？`)) return;
    TripStore.delete(id);
    if (window.currentTripId === id) {
      const remaining = TripStore.getAll();
      window.currentTripId = remaining[0]?.id || '';
      localStorage.setItem('tripflow_current_trip', window.currentTripId);
    }
    renderSettingsPage();
  });
};

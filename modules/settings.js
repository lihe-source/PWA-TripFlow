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
    <div class="page-header">
      <span class="page-title">⚙️ 設定</span>
    </div>
    <div class="settings-body">

      <section class="settings-section">
        <h4>主題</h4>
        <div class="settings-row">
          <span>深色模式</span>
          <label class="toggle-switch">
            <input type="checkbox" id="theme-toggle" ${isDark?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h4>Google Drive</h4>
        <div class="settings-row col">
          <label>Client ID</label>
          <input type="text" id="drive-client-id" value="${s.driveClientId||''}" placeholder="your-client-id.apps.googleusercontent.com" class="settings-input">
        </div>
        <div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="save-client-id">儲存 Client ID</button>
        </div>
        <div class="settings-row" style="margin-top:10px">
          ${AuthService.isSignedIn()
            ? `<span class="signed-in-label">✅ 已登入</span><button class="btn-secondary" id="drive-signout">登出</button>`
            : `<button class="btn-primary" id="drive-signin">登入 Google Drive</button>`}
        </div>
        ${AuthService.isSignedIn() ? `<div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="drive-sync">☁️ 立即同步至 Drive</button>
        </div>` : ''}
      </section>

      <section class="settings-section">
        <h4>Google Maps</h4>
        <div class="settings-row col">
          <label>Maps API Key</label>
          <input type="text" id="maps-api-key" value="${s.mapsApiKey||''}" placeholder="AIza..." class="settings-input">
        </div>
        <div class="settings-row" style="margin-top:10px">
          <button class="btn-secondary" id="save-maps-key">儲存 API Key</button>
        </div>
      </section>

      <section class="settings-section">
        <h4>備份與復原</h4>
        <div id="backup-container"></div>
      </section>

      <section class="settings-section">
        <h4>應用程式更新</h4>
        <div class="settings-row">
          <button class="btn-secondary" id="check-update-btn">🔄 檢查更新</button>
        </div>
      </section>

    </div>`;

  renderBackupUI(document.getElementById('backup-container'));

  document.getElementById('theme-toggle').addEventListener('change', e => {
    const dark = e.target.checked;
    document.body.classList.toggle('dark', dark);
    SettingsStore.set({ theme: dark ? 'dark' : 'light' });
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
      SettingsStore.set({ googleAccount: 'signed_in' });
      renderSettingsPage();
      window.showToast('已成功登入 Google Drive');
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
}

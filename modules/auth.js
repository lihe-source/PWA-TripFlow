const TOKEN_KEY = 'tripflow_token';
const EXPIRY_KEY = 'tripflow_token_expiry';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let _token = null;
let _tokenClient = null;

export const AuthService = {
  getClientId() { return localStorage.getItem('tripflow_settings') ? JSON.parse(localStorage.getItem('tripflow_settings')).driveClientId || '' : ''; },

  init() {
    const clientId = AuthService.getClientId();
    if (!clientId || !window.google?.accounts?.oauth2) return false;
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          _token = resp.access_token;
          const expiry = Date.now() + (resp.expires_in || 3600) * 1000;
          localStorage.setItem(TOKEN_KEY, _token);
          localStorage.setItem(EXPIRY_KEY, String(expiry));
          if (window._onAuthSuccess) window._onAuthSuccess();
        }
      }
    });
    return true;
  },

  getToken() {
    if (_token && Date.now() < Number(localStorage.getItem(EXPIRY_KEY) || 0) - 60000) return _token;
    const stored = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);
    if (stored && Date.now() < expiry - 60000) { _token = stored; return _token; }
    return null;
  },

  signIn(callback) {
    if (!_tokenClient) { if (!AuthService.init()) { window.showToast('請先在設定頁輸入 Client ID'); return; } }
    window._onAuthSuccess = callback;
    _tokenClient.requestAccessToken({ prompt: '' });
  },

  signOut() {
    const t = AuthService.getToken();
    if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t);
    _token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    const s = JSON.parse(localStorage.getItem('tripflow_settings') || '{}');
    delete s.googleAccount;
    localStorage.setItem('tripflow_settings', JSON.stringify(s));
  },

  isSignedIn() { return !!AuthService.getToken(); }
};

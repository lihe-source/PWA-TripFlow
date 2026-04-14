import { AuthService } from './auth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

async function req(url, opts={}) {
  const token = AuthService.getToken();
  if (!token) throw new Error('未登入');
  const res = await fetch(url, { ...opts, headers: { 'Authorization':'Bearer '+token, ...(opts.headers||{}) } });
  if (!res.ok) throw new Error('Drive API error: ' + res.status);
  return res.json();
}

async function findOrCreate(name, mimeType, parentId) {
  const q = `name='${name}' and mimeType='${mimeType}' and '${parentId||'root'}' in parents and trashed=false`;
  const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
  if (r.files.length) return r.files[0].id;
  const body = { name, mimeType, parents: parentId ? [parentId] : [] };
  const created = await req(`${API}/files?fields=id`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  return created.id;
}

let _rootId = null, _tripsId = null;

export const DriveService = {
  async ensureStructure() {
    _rootId = await findOrCreate('TripFlow', 'application/vnd.google-apps.folder', null);
    _tripsId = await findOrCreate('trips', 'application/vnd.google-apps.folder', _rootId);
    return { rootId: _rootId, tripsId: _tripsId };
  },

  async saveTrip(trip) {
    if (!_tripsId) await DriveService.ensureStructure();
    const name = `${trip.id}.json`;
    const content = JSON.stringify(trip);
    const q = `name='${name}' and '${_tripsId}' in parents and trashed=false`;
    const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`);
    const blob = new Blob([content], {type:'application/json'});
    const meta = JSON.stringify({ name, parents: r.files.length ? undefined : [_tripsId] });
    const form = new FormData();
    form.append('metadata', new Blob([meta],{type:'application/json'}));
    form.append('file', blob);
    if (r.files.length) {
      return req(`${UPLOAD}/files/${r.files[0].id}?uploadType=multipart`, { method:'PATCH', body:form });
    } else {
      return req(`${UPLOAD}/files?uploadType=multipart`, { method:'POST', body:form });
    }
  },

  async loadTrips() {
    if (!_tripsId) await DriveService.ensureStructure();
    const q = `'${_tripsId}' in parents and trashed=false and mimeType='application/json'`;
    const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    const trips = [];
    for (const f of r.files) {
      const res = await fetch(`${API}/files/${f.id}?alt=media`, {
        headers: { 'Authorization':'Bearer '+AuthService.getToken() }
      });
      if (res.ok) trips.push(await res.json());
    }
    return trips;
  },

  async uploadPhoto(tripId, blob) {
    if (!_rootId) await DriveService.ensureStructure();
    const photoFolder = await findOrCreate(`${tripId}_photos`, 'application/vnd.google-apps.folder', _tripsId);
    const name = 'photo_' + Date.now() + '.jpg';
    const meta = JSON.stringify({ name, parents:[photoFolder] });
    const form = new FormData();
    form.append('metadata', new Blob([meta],{type:'application/json'}));
    form.append('file', blob);
    const r = await req(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method:'POST', body:form });
    return r.id;
  },

  photoUrl(fileId) { return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`; },

  async syncAll(localTrips) {
    await DriveService.ensureStructure();
    for (const t of localTrips) await DriveService.saveTrip(t);
  },

  async getRootId() {
    if (!_rootId) await DriveService.ensureStructure();
    return _rootId;
  }
};

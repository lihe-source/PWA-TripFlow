const KEY = 'tripflow_trips';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveAll(map) { localStorage.setItem(KEY, JSON.stringify(map)); }

export const TripStore = {
  getAll() { return Object.values(loadAll()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); },
  get(id) { return loadAll()[id] || null; },
  save(trip) { const m=loadAll(); m[trip.id]=trip; saveAll(m); return trip; },
  create({ title, dateRange, country, city }) {
    const id = 'trip_' + Date.now();
    const now = new Date().toISOString();
    return TripStore.save({ id, title, dateRange, country, city, createdAt:now, updatedAt:now, spots:[] });
  },
  delete(id) { const m=loadAll(); delete m[id]; saveAll(m); },
  touch(id) { const m=loadAll(); if(m[id]){m[id].updatedAt=new Date().toISOString(); saveAll(m);} },

  addSpot(tripId, spot) {
    const m=loadAll(); if(!m[tripId]) return;
    const id='sp_'+Date.now();
    m[tripId].spots.push({id,...spot,photo:spot.photo||"",checklist:[],transportToNext:null});
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m); return id;
  },
  updateSpot(tripId, spotId, patch) {
    const m=loadAll(); if(!m[tripId]) return;
    const i=m[tripId].spots.findIndex(s=>s.id===spotId);
    if(i<0) return;
    m[tripId].spots[i]={...m[tripId].spots[i],...patch};
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m);
  },
  deleteSpot(tripId, spotId) {
    const m=loadAll(); if(!m[tripId]) return;
    m[tripId].spots=m[tripId].spots.filter(s=>s.id!==spotId);
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m);
  },
  addChecklistItem(tripId, spotId, item) {
    const m=loadAll(); if(!m[tripId]) return;
    const spot=m[tripId].spots.find(s=>s.id===spotId); if(!spot) return;
    const id='ck_'+Date.now();
    spot.checklist.push({id,...item,done:false});
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m); return id;
  },
  toggleChecklist(tripId, spotId, ckId) {
    const m=loadAll(); if(!m[tripId]) return;
    const spot=m[tripId].spots.find(s=>s.id===spotId); if(!spot) return;
    const ck=spot.checklist.find(c=>c.id===ckId); if(!ck) return;
    ck.done=!ck.done;
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m);
  },
  deleteChecklistItem(tripId, spotId, ckId) {
    const m=loadAll(); if(!m[tripId]) return;
    const spot=m[tripId].spots.find(s=>s.id===spotId); if(!spot) return;
    spot.checklist=spot.checklist.filter(c=>c.id!==ckId);
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m);
  },
  setTransport(tripId, spotId, transport) {
    const m=loadAll(); if(!m[tripId]) return;
    const spot=m[tripId].spots.find(s=>s.id===spotId); if(!spot) return;
    spot.transportToNext=transport;
    m[tripId].updatedAt=new Date().toISOString();
    saveAll(m);
  }
};

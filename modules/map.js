import { TripStore } from './trip.js';

let _mapInstance = null;
let _mapsLoaded = false;

function loadMapsApi(apiKey) {
  return new Promise((resolve, reject) => {
    if (_mapsLoaded && window.google?.maps) { resolve(); return; }
    if (!apiKey) { reject(new Error('請先在設定頁輸入 Maps API Key')); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=_mapsReady`;
    s.async = true;
    window._mapsReady = () => { _mapsLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Maps API 載入失敗'));
    document.head.appendChild(s);
  });
}

export async function renderMapPage() {
  const app = document.getElementById('app');
  const trips = TripStore.getAll();

  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('tripflow_settings') || '{}'); } catch {}
  const apiKey = settings.mapsApiKey || '';

  app.innerHTML = `
    <div class="page-header">
      <span class="page-title">🗺 地圖總覽</span>
    </div>
    ${trips.length > 1 ? `<div class="map-trip-select">
      <select id="map-trip-sel">
        ${trips.map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}
      </select>
    </div>` : ''}
    <div id="gmap" style="flex:1;width:100%;min-height:300px;"></div>`;

  if (!apiKey) {
    document.getElementById('gmap').innerHTML = '<div class="map-no-key">請至設定頁輸入 Google Maps API Key</div>';
    return;
  }

  try {
    await loadMapsApi(apiKey);
  } catch(e) {
    document.getElementById('gmap').innerHTML = `<div class="map-no-key">${e.message}</div>`;
    return;
  }

  const tripId = trips[0]?.id;
  if (!tripId) { document.getElementById('gmap').innerHTML = '<div class="map-no-key">尚無行程資料</div>'; return; }

  function showTrip(id) {
    const trip = TripStore.get(id);
    if (!trip) return;
    const spots = [...trip.spots].filter(s=>s.lat&&s.lng)
      .sort((a,b)=>(a.datetime||'').localeCompare(b.datetime||''));

    if (!_mapInstance) {
      const center = spots.length ? {lat:spots[0].lat, lng:spots[0].lng} : {lat:25.033, lng:121.565};
      _mapInstance = new google.maps.Map(document.getElementById('gmap'), {
        center, zoom: 13, disableDefaultUI: true, zoomControl: true
      });
    }

    // Clear existing
    (_mapInstance._markers||[]).forEach(m=>m.setMap(null));
    if (_mapInstance._polyline) _mapInstance._polyline.setMap(null);
    _mapInstance._markers = [];

    if (!spots.length) return;

    const bounds = new google.maps.LatLngBounds();
    spots.forEach((s,i) => {
      const pos = {lat:s.lat, lng:s.lng};
      const marker = new google.maps.Marker({ position:pos, map:_mapInstance, label:String(i+1), title:s.name });
      marker.addListener('click', () => {
        new google.maps.InfoWindow({ content:`<b>${s.name}</b><br>${s.datetime||''}` }).open(_mapInstance, marker);
      });
      _mapInstance._markers.push(marker);
      bounds.extend(pos);
    });

    _mapInstance._polyline = new google.maps.Polyline({
      path: spots.map(s=>({lat:s.lat,lng:s.lng})),
      geodesic:true, strokeColor:'#FF6B35', strokeOpacity:0.8, strokeWeight:3
    });
    _mapInstance._polyline.setMap(_mapInstance);
    _mapInstance.fitBounds(bounds);
  }

  showTrip(tripId);
  const sel = document.getElementById('map-trip-sel');
  if (sel) sel.addEventListener('change', () => showTrip(sel.value));
}

import { TripStore } from './trip.js';
import { DriveService } from './drive.js';
import { AuthService } from './auth.js';

async function compressPhoto(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 400;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h*max/w); w = max; }
        else { w = Math.round(w*max/h); h = max; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = url;
  });
}

export function renderChecklistSection(tripId, spotId, checklist, container) {
  container.innerHTML = '';
  checklist.forEach(ck => {
    const item = document.createElement('div');
    item.className = 'ck-item' + (ck.done ? ' done' : '');
    item.dataset.id = ck.id;

    if (ck.type === 'photo') {
      const src = ck.dataUrl
        ? ck.dataUrl
        : (ck.driveFileId ? DriveService.photoUrl(ck.driveFileId) : '');
      item.innerHTML = `
        <button class="ck-check" data-ckid="${ck.id}" aria-label="toggle">${ck.done?'✅':'⬜'}</button>
        <div class="ck-body">
          ${src ? `<img src="${src}" class="ck-photo" alt="${ck.caption||''}">` : ''}
          <span class="ck-caption">${ck.caption||'照片'}</span>
        </div>
        <button class="ck-del" data-ckid="${ck.id}">🗑</button>`;
    } else {
      item.innerHTML = `
        <button class="ck-check" data-ckid="${ck.id}" aria-label="toggle">${ck.done?'✅':'⬜'}</button>
        <span class="ck-text">${ck.content||''}</span>
        <button class="ck-del" data-ckid="${ck.id}">🗑</button>`;
    }
    container.appendChild(item);
  });

  // Add buttons
  const addBar = document.createElement('div');
  addBar.className = 'ck-addbar';
  addBar.innerHTML = `
    <button class="ck-add-text" data-tripid="${tripId}" data-spotid="${spotId}">＋ 文字</button>
    <button class="ck-add-photo" data-tripid="${tripId}" data-spotid="${spotId}">＋ 照片</button>
    <input type="file" accept="image/*" capture="environment" class="ck-file-input" style="display:none">`;
  container.appendChild(addBar);

  // Events
  container.querySelectorAll('.ck-check').forEach(btn => {
    btn.addEventListener('click', () => {
      TripStore.toggleChecklist(tripId, spotId, btn.dataset.ckid);
      const trip = TripStore.get(tripId);
      const spot = trip.spots.find(s=>s.id===spotId);
      renderChecklistSection(tripId, spotId, spot.checklist, container);
    });
  });

  container.querySelectorAll('.ck-del').forEach(btn => {
    btn.addEventListener('click', () => {
      TripStore.deleteChecklistItem(tripId, spotId, btn.dataset.ckid);
      const trip = TripStore.get(tripId);
      const spot = trip.spots.find(s=>s.id===spotId);
      renderChecklistSection(tripId, spotId, spot.checklist, container);
    });
  });

  const fileInput = container.querySelector('.ck-file-input');

  container.querySelector('.ck-add-text').addEventListener('click', () => {
    window.openModal(`
      <h3>新增文字備註</h3>
      <input type="text" id="ck-new-text" placeholder="備註內容" style="width:100%;margin-top:8px">
      <div class="modal-actions">
        <button class="btn-secondary" onclick="window.closeModal()">取消</button>
        <button class="btn-primary" id="ck-save-text">新增</button>
      </div>`);
    document.getElementById('ck-save-text').addEventListener('click', () => {
      const val = document.getElementById('ck-new-text').value.trim();
      if (!val) return;
      TripStore.addChecklistItem(tripId, spotId, { type:'text', content:val });
      window.closeModal();
      const trip = TripStore.get(tripId);
      const spot = trip.spots.find(s=>s.id===spotId);
      renderChecklistSection(tripId, spotId, spot.checklist, container);
    });
  });

  container.querySelector('.ck-add-photo').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const dataUrl = await compressPhoto(file);
    let driveFileId = null;

    if (AuthService.isSignedIn()) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        driveFileId = await DriveService.uploadPhoto(tripId, blob);
      } catch(e) { window.showToast('照片上傳 Drive 失敗，儲存本地'); }
    }

    window.openModal(`
      <h3>照片說明</h3>
      <img src="${dataUrl}" style="width:100%;border-radius:8px;margin:8px 0">
      <input type="text" id="ck-caption" placeholder="說明文字" style="width:100%;margin-top:8px">
      <div class="modal-actions">
        <button class="btn-secondary" onclick="window.closeModal()">取消</button>
        <button class="btn-primary" id="ck-save-photo">新增</button>
      </div>`);
    document.getElementById('ck-save-photo').addEventListener('click', () => {
      const caption = document.getElementById('ck-caption').value.trim();
      TripStore.addChecklistItem(tripId, spotId, {
        type:'photo', caption, driveFileId, dataUrl: driveFileId ? null : dataUrl
      });
      window.closeModal();
      const trip = TripStore.get(tripId);
      const spot = trip.spots.find(s=>s.id===spotId);
      renderChecklistSection(tripId, spotId, spot.checklist, container);
    });
    fileInput.value = '';
  });
}

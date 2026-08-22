/**
 * admin.js — Panel de Control completo
 * Gestión de Banners y Clima via Google Apps Script
 */

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyIrGb5p9N9Ek7CVsrByscevLaafW_yGk59zRvsE6q5aynLEqauDIhbPKqxMO99qGk/exec';

// Credenciales en sesión (no se guardan en localStorage por seguridad)
let SESSION = { usuario: '', password: '' };

// ==========================================
//  INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Login form
  document.getElementById('formAuth').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Banner form
  document.getElementById('formBanner').addEventListener('submit', handleSaveBanner);

  // Clima form
  document.getElementById('formClima').addEventListener('submit', handleSaveClima);

  // Drag & Drop para Banners
  const dropZone = document.getElementById('dragDropZone');
  const fileInput = document.getElementById('bannerFile');
  if (dropZone && fileInput) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover'), false));
    dropZone.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        previewLocalImage(fileInput);
      }
    }, false);
  }

  // Si hay sesión guardada en la pestaña actual
  if (sessionStorage.getItem('admin_logged_in') === 'true') {
    SESSION.usuario  = sessionStorage.getItem('admin_u') || '';
    SESSION.password = sessionStorage.getItem('admin_p') || '';
    showDashboard();
  }
});

// ==========================================
//  TABS
// ==========================================
function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
  document.querySelectorAll('.admin-panel-section').forEach(s => s.classList.remove('admin-panel-section--active'));
  document.getElementById('tab' + capitalize(tab)).classList.add('admin-tab--active');
  document.getElementById('section' + capitalize(tab)).classList.add('admin-panel-section--active');
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ==========================================
//  LOGIN / LOGOUT
// ==========================================
async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value.trim();
  if (!user || !pass) return;

  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  document.getElementById('loginError').textContent = '';

  try {
    const data = await apiPost({ action: 'login', usuario: user, password: pass });
    if (data.ok) {
      SESSION = { usuario: user, password: pass };
      sessionStorage.setItem('admin_logged_in', 'true');
      sessionStorage.setItem('admin_u', user);
      sessionStorage.setItem('admin_p', pass);
      showDashboard();
    } else {
      showLoginError(data.error || 'Credenciales incorrectas');
    }
  } catch {
    showLoginError('Error de conexion. Verificá tu conexión a internet.');
  } finally {
    btn.textContent = 'Ingresar al Panel';
    btn.disabled = false;
  }
}

function handleLogout() {
  sessionStorage.clear();
  SESSION = { usuario: '', password: '' };
  document.getElementById('dashboard').classList.remove('admin-dashboard--visible');
  document.getElementById('loginForm').classList.remove('admin-login--hidden');
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
}

function showDashboard() {
  document.getElementById('loginForm').classList.add('admin-login--hidden');
  setTimeout(() => {
    document.getElementById('dashboard').classList.add('admin-dashboard--visible');
    cargarBanners();
    cargarClima();
  }, 300);
}

function showLoginError(msg) {
  const err = document.getElementById('loginError');
  err.textContent = msg;
  const form = document.getElementById('loginForm');
  ['-8px','8px','-5px','5px','0'].forEach((x, i) =>
    setTimeout(() => form.style.transform = `translateX(${x})`, i * 80)
  );
}

// ==========================================
//  PREVIEW DE IMAGEN
// ==========================================
function previewImage(url) {
  const img  = document.getElementById('imgPreview');
  const hint = document.getElementById('imgPreviewHint');
  const box  = document.getElementById('imgPreviewBox');
  if (url && url.startsWith('http')) {
    img.src = url;
    img.style.display = 'block';
    hint.style.display = 'none';
    box.style.borderColor = '#e30613';
    img.onerror = () => {
      img.style.display = 'none';
      hint.style.display = '';
      hint.textContent = '⚠️ No se pudo cargar la imagen. Verificá la URL.';
      box.style.borderColor = '#e30613';
    };
  } else {
    img.style.display = 'none';
    hint.style.display = '';
    hint.textContent = 'La imagen aparecerá aquí al pegar la URL';
    box.style.borderColor = '#2a2a2a';
  }
}

function previewLocalImage(input) {
  if (input.files && input.files[0]) {
    comprimirImagen(input.files[0]).then(base64 => {
      // Mostrar preview usando la versión comprimida
      const img  = document.getElementById('imgPreview');
      const hint = document.getElementById('imgPreviewHint');
      const box  = document.getElementById('imgPreviewBox');
      img.src = base64;
      img.style.display = 'block';
      hint.style.display = 'none';
      box.style.borderColor = '#e30613';
      document.getElementById('bannerImagen').value = '';
      // Actualizar el texto del dropzone
      const txt = document.getElementById('dragDropText');
      if (txt) txt.textContent = '✅ ' + input.files[0].name;
    });
  }
}

// Comprime una imagen a máximo 1000px ancho y calidad 0.75 usando Canvas
function comprimirImagen(file, maxWidth = 1000, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
//  BANNERS
// ==========================================
async function cargarBanners() {
  const list = document.getElementById('bannerList');
  list.innerHTML = '<p class="empty-state">Cargando...</p>';
  try {
    const data = await apiGet('getBanners');
    if (!data.ok || !data.banners || data.banners.length === 0) {
      list.innerHTML = '<p class="empty-state">No hay banners cargados aún.</p>';
      return;
    }
    renderBannerList(data.banners);
  } catch {
    list.innerHTML = '<p class="empty-state" style="color:#e30613">Error al cargar banners.</p>';
  }
}

function driveThumb(url) {
  if (!url) return '';
  const m = url.match(/id=([\w-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w400';
  return url;
}

function renderBannerList(banners) {
  const list = document.getElementById('bannerList');
  list.innerHTML = banners.map(b => `
    <div class="banner-item banner-item--tipo-${esc(b.tipo)}">
      <span class="banner-item__num">#${esc(b.posicion || '?')}</span>
      ${b.imagenUrl ? `<img class="banner-item__thumb" src="${esc(driveThumb(b.imagenUrl))}" alt="thumb" onerror="this.style.opacity=0.2">` : '<div class="banner-item__thumb"></div>'}
      <div class="banner-item__info">
        <div class="banner-item__title">${esc(b.titulo || 'Sin titulo')}</div>
        <div class="banner-item__meta">${esc(b.tipo || '')} - ${esc(b.ubicacion || '')} - ${b.enlaceUrl ? 'Con enlace' : 'Sin enlace'}</div>
      </div>
      <button class="banner-item__del" onclick="eliminarBanner('${esc(b.posicion)}')">Eliminar</button>
    </div>
  `).join('');
}

async function handleSaveBanner(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarBanner');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const fileInput = document.getElementById('bannerFile');
  let imagenBase64 = null;
  let filename = null;
  let mimeType = null;
  let imagenUrl = document.getElementById('bannerImagen').value.trim();

  // Si hay un archivo seleccionado, comprimirlo antes de enviar
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    filename = file.name.replace(/\.[^.]+$/, '.jpg'); // siempre jpg tras comprimir
    mimeType = 'image/jpeg';
    imagenBase64 = await comprimirImagen(file);
  }

  const payload = {
    action:    'saveBanner',
    usuario:   SESSION.usuario,
    password:  SESSION.password,
    posicion:  document.getElementById('bannerPos').value,
    titulo:    document.getElementById('bannerTitulo').value.trim(),
    imagenUrl: imagenUrl,
    imagenBase64: imagenBase64,
    filename: filename,
    mimeType: mimeType,
    enlaceUrl: document.getElementById('bannerEnlace').value.trim(),
    ubicacion: document.getElementById('bannerUbicacion').value.trim(),
    tipo:      document.getElementById('bannerTipo').value,
    active:    true
  };

  if (!payload.titulo) { showToast('El título es obligatorio.', 'error'); btn.disabled=false; btn.textContent='💾 Guardar Banner'; return; }
  if (!payload.imagenUrl && !payload.imagenBase64) { showToast('Debes proveer una URL o subir una imagen.', 'error'); btn.disabled=false; btn.textContent='💾 Guardar Banner'; return; }

  try {
    const data = await apiPost(payload);
    if (data.ok) {
      showToast('✅ Banner guardado correctamente.', 'success');
      limpiarFormBanner();
      cargarBanners();
    } else {
      showToast('❌ ' + (data.error || 'Error al guardar'), 'error');
    }
  } catch {
    showToast('❌ Error de conexion.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Banner';
  }
}

async function eliminarBanner(posicion) {
  if (!confirm(`¿Eliminar el Banner #${posicion}?`)) return;
  try {
    const data = await apiPost({ action: 'deleteBanner', usuario: SESSION.usuario, password: SESSION.password, posicion });
    if (data.ok) { showToast('🗑️ Banner eliminado.', 'success'); cargarBanners(); }
    else showToast('❌ ' + (data.error || 'Error'), 'error');
  } catch { showToast('❌ Error de conexion.', 'error'); }
}

function limpiarFormBanner() {
  document.getElementById('formBanner').reset();
  previewImage('');
}

// ==========================================
//  CLIMA
// ==========================================
async function cargarClima() {
  const list = document.getElementById('climaList');
  list.innerHTML = '<p class="empty-state">Cargando...</p>';
  try {
    const data = await apiGet('getClima');
    if (!data.ok || !data.clima || data.clima.length === 0) {
      list.innerHTML = '<p class="empty-state">No hay ciudades cargadas aún.</p>';
      return;
    }
    renderClimaList(data.clima);
  } catch {
    list.innerHTML = '<p class="empty-state" style="color:#e30613">Error al cargar ciudades.</p>';
  }
}

function renderClimaList(ciudades) {
  const list = document.getElementById('climaList');
  list.innerHTML = ciudades.map(c => `
    <div class="clima-item">
      <span class="clima-item__icon">🌤️</span>
      <div class="clima-item__info">
        <div class="clima-item__ciudad">📍 ${esc(c.ciudad)}</div>
        <div class="clima-item__data">Automático vía OpenWeatherMap</div>
      </div>
      <button class="clima-item__del" onclick="eliminarClima('${esc(c.ciudad)}')">🗑️</button>
    </div>
  `).join('');
}

async function handleSaveClima(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarClima');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const selectVal = document.getElementById('climaSelect').value;
  const parts = selectVal.split('|');
  const query = parts[0];
  const ciudad = parts[1];

  const payload = {
    action:    'saveClima',
    usuario:   SESSION.usuario,
    password:  SESSION.password,
    ciudad:    ciudad,
    query:     query,
    active:    true
  };

  if (!payload.ciudad) { showToast('Ocurrio un error al seleccionar.', 'error'); btn.disabled=false; btn.textContent='Agregar Ciudad'; return; }

  try {
    const data = await apiPost(payload);
    if (data.ok) {
      showToast('[OK] Ciudad agregada correctamente.', 'success');
      limpiarFormClima();
      cargarClima();
    } else {
      showToast('[Error] ' + (data.error || 'Error al guardar'), 'error');
    }
  } catch {
    showToast('[Error] Error de conexion.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Agregar Ciudad';
  }
}

async function eliminarClima(ciudad) {
  if (!confirm(`¿Eliminar "${ciudad}" del clima?`)) return;
  try {
    const data = await apiPost({ action: 'deleteClima', usuario: SESSION.usuario, password: SESSION.password, ciudad });
    if (data.ok) { showToast('[OK] Ciudad eliminada.', 'success'); cargarClima(); }
    else showToast('[Error] ' + (data.error || 'Error'), 'error');
  } catch { showToast('[Error] Error de conexion.', 'error'); }
}

function limpiarFormClima() {
  document.getElementById('formFormClima')?.reset() || document.getElementById('formClima').reset();
}

// ==========================================
//  API HELPERS
// ==========================================
async function apiPost(payload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain' }
  });
  return res.json();
}

async function apiGet(action) {
  const res = await fetch(`${ENDPOINT}?action=${action}`);
  return res.json();
}

// ==========================================
//  TOAST
// ==========================================
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `admin-toast admin-toast--${type} admin-toast--visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('admin-toast--visible'), 3500);
}

// ==========================================
//  ESCAPE HTML
// ==========================================
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
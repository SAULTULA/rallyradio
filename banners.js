/**
 * banners.js
 * MÃ³dulo para consumir Banners desde Google Apps Script (Backend)
 */

const BannersWidget = (() => {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyIrGb5p9N9Ek7CVsrByscevLaafW_yGk59zRvsE6q5aynLEqauDIhbPKqxMO99qGk/exec';

  async function init(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = `<div class="banners__loader">Cargando anuncios...</div>`;

    try {
      const res = await fetch(`${ENDPOINT}?action=getBanners`);
      if (!res.ok) throw new Error('Error de red');
      const data = await res.json();
      
      if (!data.ok || !data.banners || data.banners.length === 0) {
        container.innerHTML = `<div class="banners__loader">Espacio publicitario disponible.</div>`;
        return;
      }

      const html = data.banners.map(b => {
        const isDestacado = String(b.tipo).toLowerCase() === 'destacado';
        const modifier = isDestacado ? 'banner--destacado' : 'banner--normal';
        const url = b.enlaceUrl || '#';
        
        let imgHtml = '';
        if (b.imagenUrl) {
          imgHtml = `<img src="${esc(driveThumb(b.imagenUrl))}" class="banner__img" alt="Publicidad">`;
        }

        return `
          <a href="${esc(url)}" class="banner ${modifier}" target="_blank" rel="noopener" style="text-decoration:none; display:block; text-align:center;">
            ${imgHtml}
            <div class="banner__clean-title" style="padding: 8px; font-size: 0.9rem; color: #fff; background: rgba(0,0,0,0.5); border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
              ${esc(b.titulo || 'Anuncio')}
              ${b.enlaceUrl ? '<br><small style="color:#e30613; font-weight:bold;">Visitar Web &rarr;</small>' : ''}
            </div>
          </a>
        `;
      }).join('');

      container.innerHTML = `<div class="banners">${html}</div>`;

    } catch (err) {
      console.error('[Banners] Error:', err);
      container.innerHTML = `<div class="banners__loader" style="color:#ef4444;">No se pudieron cargar los anuncios.</div>`;
    }
  }

  
  function driveThumb(url) {
    if (!url) return '';
    const m = url.match(/id=([\w-]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w400';
    return url;
  }

  function esc(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init };
})();

// InicializaciÃ³n automÃ¡tica
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('banners-container')) {
    BannersWidget.init('#banners-container');
  }
});


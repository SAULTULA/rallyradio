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

        const imgHtml = b.imagenUrl
          ? `<div class="banner__media">
               <img src="${esc(driveThumb(b.imagenUrl))}" class="banner__img" alt="${esc(b.titulo || 'Publicidad')}">
             </div>`
          : '';

        const captionHtml = `
          <div class="banner__caption">
            <span class="banner__caption-title">${esc(b.titulo || 'Anuncio')}</span>
            ${b.enlaceUrl
              ? `<span class="banner__caption-url">${esc(b.enlaceUrl)}</span>`
              : ''}
          </div>`;

        return `
          <a href="${esc(url)}" class="banner ${modifier}" target="_blank" rel="noopener">
            ${imgHtml}
            ${captionHtml}
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


/**
 * video-feed.js
 * Módulo de Video Feed — Panella Producciones
 * Consume el endpoint de Google Apps Script y renderiza video cards.
 * Se refresca automáticamente cada 30 minutos para mostrar novedades.
 *
 * USO:
 *   VideoFeed.init('rally', '#fb-rally-videos', { limit: 9 });
 *   VideoFeed.init('power', '#fb-power-videos', { limit: 9 });
 */

const VideoFeed = (() => {

  // ============================================================
  //  ENDPOINT — Proxy de Vercel
  // ============================================================
  const ENDPOINT = '/api/script';

  // Intervalo de refresco automático (ms). 30 minutos.
  const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

  // Registro de timers activos por selector
  const _timers = new Map();

  // ============================================================
  //  INIT — Punto de entrada público
  // ============================================================
  async function init(pageLabel, containerSelector, options = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const limit = options.limit || 9;
    const refresh = options.refresh !== false; // true por defecto

    // Primera carga
    await _load(pageLabel, container, limit);

    // Auto-refresco cada 30 minutos
    if (refresh) {
      if (_timers.has(containerSelector)) {
        clearInterval(_timers.get(containerSelector));
      }
      const timer = setInterval(() => _load(pageLabel, container, limit), REFRESH_INTERVAL_MS);
      _timers.set(containerSelector, timer);
    }
  }

  // ============================================================
  //  CARGA INTERNA
  // ============================================================
  async function _load(pageLabel, container, limit) {
    // Mostrar loader solo si el contenedor no tiene cards aún
    if (!container.querySelector('.video-feed')) {
      container.innerHTML = `
        <div class="video-feed--loader">
          <div class="video-feed__spinner"></div>
          Cargando videos...
        </div>`;
    }

    try {
      const videos = await fetchVideos(pageLabel, limit);

      if (!videos || videos.length === 0) {
        container.innerHTML = _renderEmpty(pageLabel);
        return;
      }

      container.innerHTML = `<div class="video-feed">${videos.map(_renderCard).join('')}</div>`;

      // Adjuntar eventos de clic
      container.querySelectorAll('.video-card').forEach((card, idx) => {
        card.addEventListener('click', () => _openModal(videos[idx]));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') _openModal(videos[idx]);
        });
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Ver video: ${videos[idx].title}`);
      });

    } catch (err) {
      console.error('[VideoFeed] Error:', err);
      // Solo mostrar error si no había contenido previo
      if (!container.querySelector('.video-feed')) {
        container.innerHTML = _renderError();
      }
    }
  }

  // ============================================================
  //  FETCH — siempre datos frescos (sin caché del navegador)
  // ============================================================
  async function fetchVideos(pageLabel, limit) {
    const ts = Date.now();
    const url = `${ENDPOINT}?action=getVideos&page=${encodeURIComponent(pageLabel)}&limit=${limit}&_t=${ts}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Respuesta inválida del servidor');

    return data.videos;
  }

  // ============================================================
  //  RENDER CARD
  // ============================================================
  function _renderCard(video) {
    const thumb = video.thumbnail
      ? `<img src="${_esc(video.thumbnail)}" alt="${_esc(video.title)}" loading="lazy" onerror="this.parentElement.classList.add('video-card__thumb--no-img'); this.remove();">`
      : '';

    const thumbClass = video.thumbnail
      ? 'video-card__thumb'
      : 'video-card__thumb video-card__thumb--no-img';

    const date = video.publishedAt ? _formatDate(video.publishedAt) : '';

    return `
      <article class="video-card">
        <div class="${thumbClass}">
          ${thumb}
          <div class="video-card__play">
            <div class="video-card__play-icon">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="video-card__info">
          <span class="video-card__source">${_esc(video.displayName || video.page)}</span>
          <h3 class="video-card__title">${_esc(video.title)}</h3>
          ${date ? `<span class="video-card__date">${date}</span>` : ''}
        </div>
      </article>`;
  }

  // ============================================================
  //  MODAL
  // ============================================================
  function _openModal(video) {
    const existing = document.getElementById('vf-modal-overlay');
    if (existing) existing.remove();

    const hasEmbed = video.embedUrl && video.embedUrl.length > 0;
    const embedHtml = hasEmbed
      ? `<iframe src="${_esc(video.embedUrl)}" allowfullscreen scrolling="no" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`
      : `<div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#0a0a0a;flex-direction:column;gap:12px;">
           <p style="color:#aaa;font-size:0.9rem;text-align:center;padding:0 20px;">No hay preview disponible.</p>
           <a href="${_esc(video.videoUrl)}" target="_blank" rel="noopener" style="background:#e30613;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Ver en Facebook ↗</a>
         </div>`;

    const overlay = document.createElement('div');
    overlay.id = 'vf-modal-overlay';
    overlay.className = 'video-modal-overlay';
    overlay.innerHTML = `
      <div class="video-modal" role="dialog" aria-modal="true" aria-label="${_esc(video.title)}">
        <button class="video-modal__close" id="vf-modal-close" aria-label="Cerrar">✕</button>
        ${embedHtml}
        <div class="video-modal__title">${_esc(video.title)}</div>
      </div>`;

    document.body.appendChild(overlay);
    document.getElementById('vf-modal-close').addEventListener('click', _closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });
    document.addEventListener('keydown', _escHandler);
  }

  function _closeModal() {
    const overlay = document.getElementById('vf-modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _escHandler);
  }

  function _escHandler(e) {
    if (e.key === 'Escape') _closeModal();
  }

  // ============================================================
  //  ESTADOS VACÍO / ERROR
  // ============================================================
  function _renderEmpty(page) {
    return `<p style="color:#888;text-align:center;padding:30px 0;font-size:0.9rem;">
      ¡Pronto habrá videos de ${_esc(page)}! Volvé más tarde.
    </p>`;
  }

  function _renderError() {
    return `<p style="color:#ff6b6b;text-align:center;padding:30px 0;font-size:0.9rem;">
      No se pudieron cargar los videos. Intentá de nuevo más tarde.
    </p>`;
  }

  // ============================================================
  //  UTILS
  // ============================================================
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _formatDate(iso) {
    try {
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric'
      }).format(new Date(iso));
    } catch { return ''; }
  }

  // API pública
  return { init, fetchVideos };

})();

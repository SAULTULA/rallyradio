document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('playBtn');
  const icon = document.getElementById('playIcon');
  const audio = document.getElementById('stream');
  const box = document.getElementById('playerBox');
  const vol = document.getElementById('volume');
  const now = document.getElementById('nowPlaying');

  if (audio) {
    audio.volume = 0.8;
  
    if (btn) {
      btn.addEventListener('click', () => {
        if (audio.paused) {
          audio.play().then(() => {
            icon.innerHTML = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
            if (box) box.classList.remove('is-paused');
            if (now) now.textContent = 'Transmisión en vivo';
          }).catch(() => {
            if (now) now.textContent = 'No se pudo conectar al streaming';
          });
        } else {
          audio.pause();
          icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
          if (box) box.classList.add('is-paused');
        }
      });
    }
  
    if (vol) {
      vol.addEventListener('input', () => {
        audio.volume = vol.value;
      });
    }
  }

  // Cargar Reels de Facebook
  fetchReels();
});

// URL DE TU APLICACIÓN WEB DE GOOGLE APPS SCRIPT
const GAS_API_URL = 'https://script.google.com/macros/s/TU_WEB_APP_ID/exec'; 

async function fetchReels() {
  const container = document.getElementById('facebook-reels-container');
  if (!container) return;

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) throw new Error('Error en red');
    const data = await response.json();

    if (!data || data.length === 0 || data.error) {
      container.innerHTML = `<p class="reels__empty">Aún no hay videos o falta configurar la URL en script.js</p>`;
      return;
    }

    container.innerHTML = ''; // Limpiar loader

    data.slice(0, 3).forEach(reel => {
      const card = document.createElement('a');
      card.className = 'reel-card';
      card.href = reel.link;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      
      const thumb = reel.image ? `<img src="${reel.image}" class="reel-card__thumb" alt="${reel.title}">` : `<div class="reel-card__placeholder">🎥</div>`;
      
      const dateStr = new Date(reel.date).toLocaleDateString('es-AR', {day: 'numeric', month: 'short'});

      card.innerHTML = `
        ${thumb}
        <div class="reel-card__content">
          <h3 class="reel-card__title">${reel.title}</h3>
          <span class="reel-card__date">${dateStr}</span>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    console.error('Error cargando Reels:', error);
    container.innerHTML = `<p class="reels__error">No se pudieron cargar los videos.</p>`;
  }
}
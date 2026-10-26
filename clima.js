/**
 * clima.js
 * Modulo Hibrido: Obtiene ciudades del Backend (Sheets) y clima en tiempo real de OpenWeatherMap.
 */

const ClimaWidget = (() => {
  const ENDPOINT = '/api/script';

  async function init(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    // OWM_API_KEY debe estar declarada en el HTML principal
    if (typeof OWM_API_KEY === 'undefined') {
      console.error('[Clima] OWM_API_KEY no definida.');
      return;
    }

    container.innerHTML = `<div class="weather__loader">Sincronizando clima...</div>`;

    try {
      // 1. Obtener lista de ciudades activas desde Google Sheets
      const res = await fetch(`${ENDPOINT}?action=getClima`);
      if (!res.ok) throw new Error('Error de red');
      const data = await res.json();
      
      if (!data.ok || !data.clima || data.clima.length === 0) {
        container.innerHTML = `<div class="weather__loader">No hay ciudades configuradas en el Panel de Admin.</div>`;
        return;
      }

      // 2. Consultar el clima real a OpenWeatherMap para cada ciudad
      const weatherPromises = data.clima.map(async (item) => {
        try {
          const query = item.query || item.ciudad;
          if (!OWM_API_KEY) {
            console.error('[Clima] OWM_API_KEY no está definida o está vacía.');
            return null;
          }
          const owmRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&lang=es&appid=${OWM_API_KEY}`);
          if (!owmRes.ok) {
            console.error(`[Clima] Error al obtener clima para ${query}:`, owmRes.status, owmRes.statusText);
            return null;
          }
          
          const wData = await owmRes.json();
          return {
            ciudad: item.ciudad,
            temp: Math.round(wData.main.temp) + '°',
            sensa: Math.round(wData.main.feels_like) + '°',
            desc: capitalize(wData.weather[0].description),
            viento: Math.round(wData.wind.speed * 3.6) + ' km/h',
            humedad: wData.main.humidity + '%',
            icono: getWeatherEmoji(wData.weather[0].icon)
          };
        } catch (e) {
          return null; // si una ciudad falla, se omite
        }
      });

      const results = await Promise.all(weatherPromises);
      const validResults = results.filter(r => r !== null);

      if (validResults.length === 0) {
        container.innerHTML = `<div class="weather__loader" style="color:#ef4444;">Error de comunicacion con OpenWeatherMap.</div>`;
        return;
      }

      // 3. Renderizar resultados
      const html = validResults.map(item => `
        <article class="weather-card">
          <header class="weather-card__header">
            <span class="weather-card__icon-pin">📍</span>
            ${esc(item.ciudad)}
          </header>
          
          <div class="weather-card__main">
            <span class="weather-card__emoji">${getWeatherEmoji(item.icono)}</span>
            <span class="weather-card__temp">${esc(item.temp)}</span>
          </div>
          
          <div class="weather-card__desc">${esc(item.desc)}</div>
          
          <footer class="weather-card__footer">
            <div class="weather-card__stat">Hum: ${esc(item.humedad)}</div>
            <div class="weather-card__stat">Viento: ${esc(item.viento)}</div>
            <div class="weather-card__stat">Sensa ${esc(item.sensa)}</div>
          </footer>
        </article>
      `).join('');

      container.innerHTML = `<div class="weather">${html}</div>`;

    } catch (err) {
      console.error('[Clima] Error general:', err);
      container.innerHTML = `<div class="weather__loader" style="color:#ef4444;">No se pudo cargar el clima.</div>`;
    }
  }

  // Funciones auxiliares
  function esc(str) { return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
  function getWeatherEmoji(iconCode) {
    const map = {
      '01d': '☀️', '01n': '🌙', '02d': '🌤', '02n': '🌤',
      '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌦️',
      '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return map[iconCode] || '🌦️';
  }

  return { init };
})();

// Inicializacion automática
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('clima-container')) {
    ClimaWidget.init('#clima-container');
  }
});

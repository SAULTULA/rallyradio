/**
 * clima.js
 * Modulo Hibrido: Obtiene ciudades del Backend (Sheets) y clima en tiempo real via /api/clima (proxy de OpenWeatherMap).
 */

const ClimaWidget = (() => {
  const ENDPOINT = '/proxy-script';

  async function init(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = `<div class="weather__loader">Sincronizando clima...</div>`;

    try {
      // 1. Ciudades activas desde Google Sheets
      const res = await fetch(`${ENDPOINT}?action=getClima`);
      if (!res.ok) throw new Error('Error de red');
      const data = await res.json();

      const ciudades = (data.clima || []).filter(c =>
        c.active !== false && String(c.active).toUpperCase() !== 'FALSE'
      );

      if (!data.ok || ciudades.length === 0) {
        container.innerHTML = `<div class="weather__loader">No hay ciudades configuradas en el Panel de Admin.</div>`;
        return;
      }

      // 2. Clima real de OpenWeatherMap para cada ciudad
      const results = await Promise.all(ciudades.map(async (item) => {
        const wData = await fetchWeather(item);
        if (!wData) return null;
        return {
          ciudad: item.ciudad,
          temp: Math.round(wData.main.temp) + '°',
          sensa: Math.round(wData.main.feels_like) + '°',
          desc: capitalize(wData.weather[0].description),
          viento: Math.round(wData.wind.speed * 3.6) + ' km/h',
          humedad: wData.main.humidity + '%',
          emoji: getWeatherEmoji(wData.weather[0].icon)
        };
      }));
      const validResults = results.filter(r => r !== null);

      if (validResults.length === 0) {
        container.innerHTML = `<div class="weather__loader" style="color:#ef4444;">Error de comunicacion con OpenWeatherMap.</div>`;
        return;
      }

      // 3. Render
      const html = validResults.map(item => `
        <article class="weather-card">
          <header class="weather-card__header">
            <span class="weather-card__icon-pin">📍</span>
            ${esc(item.ciudad)}
          </header>

          <div class="weather-card__main">
            <span class="weather-card__emoji">${item.emoji}</span>
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

  // Prueba lat/lon (si están en la hoja) y después variantes del nombre
  async function fetchWeather(item) {
    const base = '/api/clima?'; // la key vive en el servidor (Vercel)
    const urls = [];

    if (item.lat && item.lon) urls.push(`${base}lat=${encodeURIComponent(item.lat)}&lon=${encodeURIComponent(item.lon)}`);
    buildQueries(item).forEach(q => urls.push(`${base}q=${encodeURIComponent(q)}`));

    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
        if (r.status === 401 || r.status === 429) break; // key inválida o límite: no seguir probando
      } catch (e) { /* probar el siguiente */ }
    }
    console.warn(`[Clima] Sin datos para "${item.ciudad}". Revisá la columna query o agregá lat/lon.`);
    return null;
  }

  // "Cura Brochero,Cordoba,AR" -> ["Cura Brochero,Cordoba,AR", "Cura Brochero,AR"]
  function buildQueries(item) {
    const q = String(item.query || item.ciudad || '').trim();
    const city = (q.split(',')[0] || item.ciudad || '').trim();
    const list = [q, `${city},AR`, `${stripAccents(city)},AR`];
    return [...new Set(list.filter(Boolean))];
  }

  // Funciones auxiliares
  function stripAccents(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
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

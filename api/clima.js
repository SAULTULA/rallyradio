// api/clima.js — Vercel Serverless Function
// Proxy a OpenWeather: la API key vive en la variable de entorno OWM_API_KEY
// y nunca llega al navegador.

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const key = process.env.OWM_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Falta OWM_API_KEY en las variables de entorno' });
  }

  const { lat, lon, q } = req.query;
  const params = new URLSearchParams({ appid: key, units: 'metric', lang: 'es' });

  if (lat && lon) {
    if (isNaN(Number(lat)) || isNaN(Number(lon))) {
      return res.status(400).json({ error: 'lat/lon inválidos' });
    }
    params.set('lat', lat);
    params.set('lon', lon);
  } else if (q && String(q).length <= 100) {
    params.set('q', q);
  } else {
    return res.status(400).json({ error: 'Pasá lat y lon, o q (ciudad)' });
  }

  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    if (r.ok) res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo consultar OpenWeather' });
  }
}

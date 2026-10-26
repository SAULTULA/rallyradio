module.exports = async (req, res) => {
  const SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbyIrGb5p9N9Ek7CVsrByscevLaafW_yGk59zRvsE6q5aynLEqauDIhbPKqxMO99qGk/exec';

  const qs = new URLSearchParams(req.query).toString();

  try {
    const r = await fetch(`${SCRIPT_URL}?${qs}`, { redirect: 'follow' });
    const text = await r.text();

    // Si Google devolvió HTML (login/403) en vez de JSON, lo reportamos claro
    try {
      JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: 'Apps Script no devolvió JSON',
        status: r.status,
        preview: text.substring(0, 200)
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
};

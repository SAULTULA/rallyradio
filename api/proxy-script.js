export const config = {
  runtime: 'nodejs',
};

const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyIrGb5p9N9Ek7CVsrByscevLaafW_yGk59zRvsE6q5aynLEqauDIhbPKqxMO99qGk/exec';

export default async function handler(req, res) {
  const qs = new URLSearchParams(req.query).toString();

  try {
    const r = await fetch(`${SCRIPT_URL}?${qs}`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RallyRadioBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    });
    const text = await r.text();

    try {
      JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: 'Apps Script no devolvió JSON',
        status: r.status,
        preview: text.substring(0, 300),
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}

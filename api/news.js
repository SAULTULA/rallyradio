// api/news.js — Vercel Serverless Function
// Proxy de RSS: el servidor parsea el XML y devuelve JSON limpio.
// No hay restricciones CORS porque la petición la hace el servidor, no el navegador.

export const config = {
  runtime: 'nodejs',
};

/**
 * Extrae el texto de un nodo XML dado su tag name.
 * Soporta CDATA y texto plano.
 * @param {string} xml
 * @param {string} tag
 * @returns {string}
 */
function extractTag(xml, tag) {
  // Intenta con CDATA primero
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Texto plano
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const plainMatch = xml.match(plainRe);
  if (plainMatch) return plainMatch[1].replace(/<[^>]+>/g, '').trim();

  return '';
}

/**
 * Extrae el valor de un atributo dentro de un tag de apertura.
 * @param {string} tag — el string completo del tag de apertura, ej: <enclosure url="..." type="image/jpeg">
 * @param {string} attr
 * @returns {string}
 */
function extractAttr(tag, attr) {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const match = tag.match(re);
  return match ? match[1] : '';
}

/**
 * Parsea una cadena RSS/Atom XML y devuelve un array de items.
 * @param {string} xml
 * @returns {Array}
 */
function parseRSS(xml) {
  const items = [];

  // Aislar cada <item> o <entry> (Atom)
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1] || match[2];

    // Título
    const title = extractTag(block, 'title') || 'Sin título';

    // Link — puede estar en <link href="..."/> (Atom) o <link>...</link> (RSS)
    let link = '';
    const atomLinkMatch = block.match(/<link\s[^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (atomLinkMatch) {
      link = atomLinkMatch[1] || atomLinkMatch[2];
    } else {
      link = extractTag(block, 'link');
    }

    // Fecha de publicación
    const pubDate = extractTag(block, 'pubDate') ||
                    extractTag(block, 'published') ||
                    extractTag(block, 'updated') || '';

    // Descripción / contenido
    const description = extractTag(block, 'description') ||
                        extractTag(block, 'content:encoded') ||
                        extractTag(block, 'content') || '';

    // Thumbnail — buscar en enclosure, media:content o media:thumbnail
    let thumbnail = '';
    const enclosureMatch = block.match(/<enclosure([^>]+)>/i);
    if (enclosureMatch) {
      const type = extractAttr(enclosureMatch[1], 'type');
      if (type.startsWith('image')) {
        thumbnail = extractAttr(enclosureMatch[1], 'url');
      }
    }
    if (!thumbnail) {
      const mediaContentMatch = block.match(/<media:content([^>]+)>/i);
      if (mediaContentMatch) {
        thumbnail = extractAttr(mediaContentMatch[1], 'url');
      }
    }
    if (!thumbnail) {
      const mediaThumbnailMatch = block.match(/<media:thumbnail([^>]+)>/i);
      if (mediaThumbnailMatch) {
        thumbnail = extractAttr(mediaThumbnailMatch[1], 'url');
      }
    }
    // Último recurso: buscar primera <img> en la descripción
    if (!thumbnail) {
      const imgInDesc = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgInDesc) thumbnail = imgInDesc[1];
    }

    items.push({ title, link, pubDate, description, thumbnail });
  }

  return items;
}

export default async function handler(req, res) {
  // Habilitar CORS para el propio dominio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // Cache en Vercel Edge por 5 min

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ status: 'error', message: 'Falta el parámetro ?url=' });
  }

  // Validar que la URL sea https (seguridad básica)
  let feedUrl;
  try {
    feedUrl = new URL(url);
    if (!['http:', 'https:'].includes(feedUrl.protocol)) {
      throw new Error('Protocolo inválido');
    }
  } catch {
    return res.status(400).json({ status: 'error', message: 'URL inválida' });
  }

  try {
    const response = await fetch(feedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RallyRadioBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(502).json({
        status: 'error',
        message: `El feed respondió con status ${response.status}`,
      });
    }

    const xml = await response.text();
    const items = parseRSS(xml);

    if (items.length === 0) {
      return res.status(200).json({ status: 'ok', items: [], message: 'El feed no contiene items' });
    }

    return res.status(200).json({ status: 'ok', items });

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(502).json({
      status: 'error',
      message: isTimeout ? 'Timeout al leer el feed' : `Error al obtener el feed: ${err.message}`,
    });
  }
}

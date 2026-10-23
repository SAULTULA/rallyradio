/**
 * =========================================================
 *  PANELLA PRODUCCIONES — Backend Integrado
 *  Google Apps Script + Google Sheets
 *  
 *  FIX: rss.app devuelve 402 desde IPs de Google (plan free solo
 *  permite acceso desde browsers). Solución: rss2json.com como proxy.
 * =========================================================
 */
// ============================================================
//  CONFIG
// ============================================================
const CONFIG = {
  pages: [
    { label: 'rally', rssUrl: 'https://fetchrss.com/feed/1x03vQ4tE0QO1x03vuCWK8Hr.rss', displayName: 'Radio Rally' },
    { label: 'power', rssUrl: 'https://fetchrss.com/feed/1x03vQ4tE0QO1x03uoCF25XW.rss', displayName: 'Radio Power 104.1' }
  ],
  sheetName:  'Videos',
  maxPerPage: 9  // Conservar solo las últimas 9 publicaciones por página
};
// rss2json.com acepta requests server-side (Apps Script) y sirve de proxy para rss.app
// Clave gratuita con 10.000 req/mes — más que suficiente para un trigger horario
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
// ============================================================
//  ENDPOINT GET
// ============================================================
function doGet(e) {
  const params     = e.parameter;
  const action     = params.action || 'getVideos';
  try {
    if (action === 'getVideos') {
      const pageFilter = params.page  || 'all';
      const limit      = Math.min(parseInt(params.limit) || CONFIG.maxPerPage, CONFIG.maxPerPage);
      const sheet      = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
      if (!sheet) return jsonResponse({ ok: false, error: 'Sheet no encontrada' });
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse({ ok: true, page: pageFilter, videos: [] });
      let videos = data.slice(1)
        .filter(row => row[8] === true || row[8] === 'TRUE')
        .filter(row => pageFilter === 'all' || row[1] === pageFilter)
        .map(row => ({
          id:          String(row[0]),
          page:        row[1],
          displayName: row[2],
          title:       row[3],
          description: String(row[4]).substring(0, 200),
          videoUrl:    row[5],
          embedUrl:    row[6],
          thumbnail:   row[7],
          publishedAt: row[9] ? new Date(row[9]).toISOString() : ''
        }))
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, limit);
      return jsonResponse({ ok: true, page: pageFilter, count: videos.length, videos });
    } else if (action === 'getBanners') {
      return jsonResponse({ ok: true, banners: getGenericSheetData('Banners') });
    } else if (action === 'getClima') {
      return jsonResponse({ ok: true, clima: getGenericSheetData('ClimaCiudades') });
    } else {
      return jsonResponse({ ok: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}
// ============================================================
//  ENDPOINT POST
// ============================================================
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    if (action === 'login') {
      return checkAdminAuth(data.usuario, data.password)
        ? jsonResponse({ ok: true,  message: 'Autenticado' })
        : jsonResponse({ ok: false, error:   'Credenciales inválidas' });
    }
    if (!checkAdminAuth(data.usuario, data.password))
      return jsonResponse({ ok: false, error: 'No autorizado' });
    if (action === 'saveBanner') {
      if (data.imagenBase64) {
        try { data.imagenUrl = saveImageToDrive(data.imagenBase64, data.filename, data.mimeType); }
        catch (e) { return jsonResponse({ ok: false, error: e.message }); }
      }
      return handleSaveGeneric('Banners', data, 'posicion',
        ['posicion', 'tipo', 'titulo', 'imagenUrl', 'enlaceUrl', 'ubicacion', 'active']);
    }
    if (action === 'deleteBanner') return handleDeleteGeneric('Banners',      data.posicion, 0);
    if (action === 'saveClima')   return handleSaveGeneric('ClimaCiudades', data, 'ciudad', ['ciudad', 'query', 'active']);
    if (action === 'deleteClima') return handleDeleteGeneric('ClimaCiudades', data.ciudad,   0);
    return jsonResponse({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}
// ============================================================
//  AUTENTICACIÓN ADMIN
// ============================================================
function checkAdminAuth(user, pass) {
  if (!user || !pass) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Admin');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user && String(data[i][1]) === String(pass)) return true;
  }
  return false;
}
// ============================================================
//  SCRAPER PRINCIPAL  ←  LEE DIRECTAMENTE DESDE FETCHRSS
// ============================================================
function updateAllPages() {
  Logger.log('=== Actualizando feeds de video ===');
  CONFIG.pages.forEach(page => {
    try {
      fetchVideosFromRSS(page);
    } catch (err) {
      Logger.log(`✗ Error en ${page.displayName}: ${err.message}`);
    }
  });
}

function fetchVideosFromRSS(pageConfig) {
  const response = UrlFetchApp.fetch(pageConfig.rssUrl, { muteHttpExceptions: true });
  const code     = response.getResponseCode();
  if (code !== 200) throw new Error(`HTTP ${code}`);

  const doc     = XmlService.parse(response.getContentText());
  const root    = doc.getRootElement();
  const channel = root.getChild('channel');
  const items   = channel
    ? channel.getChildren('item')
    : root.getChildren('entry', root.getNamespace());

  const sheet       = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  const existingIds = getExistingIds(sheet);

  let added = 0;
  for (const item of items) {
    const parsed = parseRSSItem(item, pageConfig);
    if (!parsed || !parsed.videoUrl || existingIds.has(parsed.id)) continue;

    sheet.appendRow([
      parsed.id, parsed.page, parsed.displayName, parsed.title,
      parsed.description, parsed.videoUrl, parsed.embedUrl, parsed.thumbnail,
      true, parsed.publishedAt
    ]);
    existingIds.add(parsed.id);
    added++;
  }

  Logger.log(`${pageConfig.displayName}: +${added} videos nuevos.`);
  purgeOldRows(sheet, pageConfig.label);
}

// ============================================================
//  PARSER RSS
// ============================================================
function parseRSSItem(item, pageConfig) {
  try {
    const title   = getChildText(item, 'title')   || 'Sin título';
    const link    = getChildText(item, 'link')    || getChildText(item, 'url') || '';
    const pubDate = getChildText(item, 'pubDate') || getChildText(item, 'published') || new Date().toISOString();
    const guid    = getChildText(item, 'guid')    || link;

    const isVideoPost = link.includes('/videos/') || link.includes('watch') || link.includes('reel');
    const isPermalink = link.includes('permalink.php') || link.includes('/posts/');
    if (!isVideoPost && !isPermalink) return null;

    const embedUrl = isVideoPost
      ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(link)}&show_text=false&width=560&height=315&appId=`
      : `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(link)}&show_text=true&width=350`;

    let thumbnail = '';
    try {
      const mediaNs = XmlService.getNamespace('http://search.yahoo.com/mrss/');
      const mediaEl = item.getChild('content', mediaNs);
      if (mediaEl) thumbnail = mediaEl.getAttribute('url').getValue();
    } catch (me) {}

    const id = guid.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

    return {
      id, page: pageConfig.label, displayName: pageConfig.displayName,
      title, description: '', videoUrl: link, embedUrl, thumbnail,
      publishedAt: new Date(pubDate).toISOString()
    };
  } catch (err) { return null; }
}

function getChildText(el, name) {
  const child = el.getChild(name);
  return child ? child.getText() : null;
}

/**
 * Elimina de la hoja las filas más antiguas de una página,
 * conservando solo las últimas CONFIG.maxPerPage.
 */
function purgeOldRows(sheet, pageLabel) {
  const data     = sheet.getDataRange().getValues();
  const pageRows = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === pageLabel.toLowerCase()) {
      pageRows.push({
        rowIndex:    i + 1,
        publishedAt: data[i][9] ? new Date(data[i][9]) : new Date(0)
      });
    }
  }
  if (pageRows.length <= CONFIG.maxPerPage) return;
  // Más nuevas primero → las que sobran están al final
  pageRows.sort((a, b) => b.publishedAt - a.publishedAt);
  const toDelete = pageRows.slice(CONFIG.maxPerPage);
  // Eliminar de abajo hacia arriba para no desalinear índices
  toDelete
    .map(r => r.rowIndex)
    .sort((a, b) => b - a)
    .forEach(rowIdx => sheet.deleteRow(rowIdx));
  Logger.log(`[${pageLabel}] Purgadas ${toDelete.length} filas antiguas. Quedan: ${CONFIG.maxPerPage}`);
}
// ============================================================
//  TRIGGER  ←  Re-crear como time-based (cada hora)
// ============================================================
function setupTrigger() {
  // Eliminar TODOS los triggers existentes de updateAllPages
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'updateAllPages') ScriptApp.deleteTrigger(t);
  });
  // Crear trigger basado en tiempo, cada 1 hora
  ScriptApp.newTrigger('updateAllPages')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('✅ Trigger horario creado para updateAllPages');
}
// ============================================================
//  UTILIDADES
// ============================================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function getExistingIds(sheet) {
  const data = sheet.getDataRange().getValues();
  const ids  = new Set();
  data.slice(1).forEach(row => { if (row[0]) ids.add(String(row[0])); });
  return ids;
}
function getGenericSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, j) => { if (h) obj[h] = row[j]; });
    return obj;
  });
}
// ============================================================
//  GUARDADO / ELIMINADO GENÉRICO
// ============================================================
function handleSaveGeneric(sheetName, data, keyField, columns) {
  const sheet    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Hoja no encontrada: ' + sheetName });
  const values   = sheet.getDataRange().getValues();
  const keyValue = String(data[keyField]);
  let rowIndex   = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === keyValue) { rowIndex = i + 1; break; }
  }
  const rowData = columns.map(col => data[col] !== undefined ? data[col] : '');
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    if (values.length === 0 || (values.length === 1 && String(values[0][0]) === '')) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    }
    sheet.appendRow(rowData);
  }
  return jsonResponse({ ok: true, message: 'Guardado correctamente' });
}
function handleDeleteGeneric(sheetName, keyValue, keyColIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Hoja no encontrada' });
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ ok: true, message: 'Eliminado correctamente' });
    }
  }
  return jsonResponse({ ok: false, error: 'No encontrado para eliminar' });
}
// ============================================================
//  GOOGLE DRIVE — Subida de imágenes
// ============================================================
function saveImageToDrive(base64Data, filename, mimeType) {
  try {
    const base64str = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const blob      = Utilities.newBlob(
      Utilities.base64Decode(base64str), mimeType || 'image/png', filename || 'banner.png'
    );
    const folders   = DriveApp.getFoldersByName('RallyRadio_Banners');
    const folder    = folders.hasNext() ? folders.next() : DriveApp.createFolder('RallyRadio_Banners');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const file      = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?id=' + file.getId();
  } catch (e) {
    throw new Error('Error Drive: ' + e.message);
  }
}
function testDrive() {
  const blob    = Utilities.newBlob('test', 'text/plain', 'test.txt');
  const folders = DriveApp.getFoldersByName('RallyRadio_Banners');
  const folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder('RallyRadio_Banners');
  const file    = folder.createFile(blob);
  Logger.log('OK: ' + file.getId());
}

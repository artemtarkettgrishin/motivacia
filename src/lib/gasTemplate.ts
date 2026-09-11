/**
 * Шаблон Apps Script бэкенда (ES5, один файл). Плейсхолдер __DATA__ заменяется JSON-ом
 * строк по листам — setupMotivaciya() создаёт и заполняет 5 листов.
 */
export const GAS_TEMPLATE = `/**
 * Мотивация · Apps Script бэкенд (один файл на всё). Версия 7 — 5 листов.
 * v7: пишет только изменённые листы, без autoResize (в разы быстрее), чтение под блокировкой,
 *     при занятой таблице отвечает code:'busy' — приложение повторяет само.
 * 1) Расширения → Apps Script → вставить этот код → сохранить.
 * 2) Выбрать функцию setupMotivaciya → Выполнить (один раз, создаст 5 листов).
 * 3) Развернуть → Новое развёртывание → Веб-приложение:
 *    выполнять как «Я», доступ «Все» → скопировать URL …/exec в appConfig.gasUrl.
 * ВАЖНО: после любой правки кода — Управление развёртываниями → Новая версия,
 * иначе по старому URL работает старый код.
 *
 * Старая таблица (10 листов, Товары с колонкой «Градации») читается автоматически;
 * после первого сохранения из приложения лист «Товары» переписывается в новый формат,
 * листы Прайс_*, Привязка_прайсов и Цены_по_группам больше не нужны — их можно удалить.
 */
var GAS_VERSION = 7;

var SHEETS = ['Товары', 'Магазины', 'Акции', 'Категории', 'Настройки'];

var HEADERS = {
  'Товары': ['Категория', 'Подкатегория', 'Название', 'Магазины', 'Базовый', 'Стандартный', 'Высокий', 'Красный', 'Статус'],
  'Магазины': ['Название', 'Пароль', 'Прайс-группа', 'Доп.условия'],
  'Акции': ['Начало', 'Конец', 'Категория', 'Товар', 'Цена', 'Бонус', 'Комментарий', 'Градации'],
  'Категории': ['Название', 'Иконка', 'Порядок'],
  'Настройки': ['Параметр', 'Значение']
};

var GROUP_LABEL = { base: 'Базовый', standard: 'Стандартный', high: 'Высокий' };
var GROUPS = ['base', 'standard', 'high'];

/** Стартовые данные для setupMotivaciya() (строки по листам). */
var DATA = __DATA__;

/* ------------------------------------------------------------------ */
/*  Первичная настройка                                                */
/* ------------------------------------------------------------------ */
function setupMotivaciya() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var first = ss.getSheets()[0];
  for (var i = 0; i < SHEETS.length; i++) {
    var name = SHEETS[i];
    writeSheet(ss, name, HEADERS[name], DATA[name] || []);
    autoResize(ss.getSheetByName(name), HEADERS[name].length);
  }
  try {
    if (first && SHEETS.indexOf(first.getName()) === -1 && first.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(first);
    }
  } catch (e) {}
  ss.toast('Готово: 5 листов созданы и заполнены. Теперь разверните веб-приложение.', 'Мотивация', 10);
}

function autoResize(sh, n) {
  if (!sh) return;
  for (var k = 1; k <= n; k++) {
    try { sh.autoResizeColumn(k); } catch (e) {}
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP                                                               */
/* ------------------------------------------------------------------ */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  var out;
  try {
    if (action === 'ping') {
      out = { status: 'ok', gasVersion: GAS_VERSION, time: new Date().toISOString() };
    } else if (action === 'shops') {
      var d = withReadLock(getData);
      out = [];
      for (var i = 0; i < d.shops.length; i++) out.push({ name: d.shops[i].name, group: d.shops[i].group });
    } else {
      out = withReadLock(getData);
    }
  } catch (err) {
    out = errOut(err);
  }
  return jsonOut(out);
}

function doPost(e) {
  var out, saveId = '';
  try {
    var body = {};
    try {
      body = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    } catch (pe) {
      body = {};
    }
    saveId = body.saveId ? String(body.saveId) : '';
    if (body.action === 'sendReport') {
      MailApp.sendEmail({ to: String(body.to || ''), subject: String(body.subject || 'Мотивация'), htmlBody: String(body.htmlBody || '') });
      out = { status: 'ok', gasVersion: GAS_VERSION, saveId: saveId };
    } else if (body.action === 'saveData') {
      var res = saveData(body.data);
      out = { status: 'ok', gasVersion: GAS_VERSION, saveId: saveId, counts: res.counts, written: res.written, ms: res.ms };
    } else {
      out = { status: 'error', code: 'unknown', error: 'unknown action', gasVersion: GAS_VERSION, saveId: saveId };
    }
  } catch (err) {
    out = errOut(err);
    out.saveId = saveId;
  }
  return jsonOut(out);
}

function jsonOut(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Ошибка в JSON. code 'busy' = таблица занята другой записью (приложение повторит само). */
function errOut(err) {
  var code = err && err.code ? String(err.code) : '';
  var msg = String(err);
  if (!code && /блокировк|lock/i.test(msg)) code = 'busy';
  return { status: 'error', code: code, error: msg, gasVersion: GAS_VERSION };
}

function busyError() {
  var e = new Error('busy: таблица занята другой записью');
  e.code = 'busy';
  return e;
}

/** Чтение под блокировкой — читатель никогда не увидит наполовину записанный лист. */
function withReadLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw busyError();
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Запись                                                             */
/* ------------------------------------------------------------------ */
function saveData(d) {
  if (!d || !d.products || !d.shops) throw new Error('bad payload');
  if (!d.products.length && !d.shops.length) throw new Error('empty payload: отказано, чтобы случайно не стереть таблицу');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw busyError();
  var t0 = Date.now();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var i, r, gradeRows = 0, written = [];

    var prod = [];
    for (i = 0; i < d.products.length; i++) {
      r = d.products[i];
      var g = r.grades || {};
      gradeRows += countRows(g.base) + countRows(g.standard) + countRows(g.high);
      prod.push([s(r.category), s(r.subcategory), s(r.name), (r.shops || []).join(', '),
        s(g.base), s(g.standard), s(g.high), r.isRed ? 'да' : '', r.active === false ? 'выключен' : 'активен']);
    }
    if (writeSheet(ss, 'Товары', HEADERS['Товары'], prod)) written.push('Товары');

    var shops = [];
    for (i = 0; i < d.shops.length; i++) {
      r = d.shops[i];
      shops.push([s(r.name), s(r.password), GROUP_LABEL[r.group] || 'Стандартный', encodeExtras(r.extras || [])]);
    }
    if (writeSheet(ss, 'Магазины', HEADERS['Магазины'], shops)) written.push('Магазины');

    var promos = [];
    for (i = 0; i < (d.promos || []).length; i++) {
      r = d.promos[i];
      promos.push([s(r.start), s(r.end), s(r.category), s(r.product), s(r.price), s(r.bonus), s(r.comment), s(r.grades)]);
    }
    if (writeSheet(ss, 'Акции', HEADERS['Акции'], promos)) written.push('Акции');

    var cats = (d.categories || []).slice().sort(function (a, b) { return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0); });
    var catRows = [];
    for (i = 0; i < cats.length; i++) catRows.push([s(cats[i].name), s(cats[i].icon) || 'box', String(i + 1)]);
    if (writeSheet(ss, 'Категории', HEADERS['Категории'], catRows)) written.push('Категории');

    if (writeSheet(ss, 'Настройки', HEADERS['Настройки'], [['Email для отчётов', d.settings ? s(d.settings.reportEmail) : '']])) written.push('Настройки');

    SpreadsheetApp.flush();
    return { counts: { products: prod.length, shops: shops.length, priceRows: gradeRows }, written: written, ms: Date.now() - t0 };
  } finally {
    lock.releaseLock();
  }
}

function countRows(v) {
  var str = s(v).trim();
  if (!str) return 0;
  var parts = str.split(';'), n = 0;
  for (var i = 0; i < parts.length; i++) if (parts[i].trim()) n++;
  return n;
}

/**
 * Быстрая запись листа: если содержимое не изменилось — ничего не трогаем (false).
 * Иначе пишем новые значения ПОВЕРХ старых и чистим только хвост — лист никогда не бывает пустым.
 */
function writeSheet(ss, name, header, rows) {
  var sh = ss.getSheetByName(name);
  var created = false;
  if (!sh) {
    sh = ss.insertSheet(name);
    created = true;
  }
  var nCols = header.length;
  var values = [header.slice()];
  for (var i = 0; i < rows.length; i++) {
    var r = [];
    for (var c = 0; c < nCols; c++) r.push(rows[i][c] === undefined || rows[i][c] === null ? '' : String(rows[i][c]));
    values.push(r);
  }
  var nRows = values.length;
  var lastRow = created ? 0 : sh.getLastRow();
  var lastCol = created ? 0 : sh.getLastColumn();
  if (!created && lastRow === nRows && lastCol === nCols) {
    var cur = sh.getRange(1, 1, nRows, nCols).getDisplayValues();
    if (sameValues(cur, values)) return false;
  }
  var range = sh.getRange(1, 1, nRows, nCols);
  range.setNumberFormat('@');
  range.setValues(values);
  if (lastRow > nRows) sh.getRange(nRows + 1, 1, lastRow - nRows, Math.max(lastCol, nCols)).clearContent();
  if (lastCol > nCols) sh.getRange(1, nCols + 1, Math.max(lastRow, nRows), lastCol - nCols).clearContent();
  var needHeader = created;
  if (!needHeader) {
    try { needHeader = String(sh.getRange(1, 1).getBackground()).toLowerCase() !== '#ffec32'; } catch (e) { needHeader = true; }
  }
  if (needHeader) sh.getRange(1, 1, 1, nCols).setBackground('#ffec32').setFontWeight('bold').setHorizontalAlignment('center');
  try { if (sh.getFrozenRows() !== 1) sh.setFrozenRows(1); } catch (e2) {}
  return true;
}

function sameValues(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (!a[i] || !b[i] || a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) {
      if (String(a[i][j]) !== String(b[i][j])) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Чтение                                                             */
/* ------------------------------------------------------------------ */
function readSheet(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var empty = true;
    for (var j = 0; j < vals[i].length; j++) if (String(vals[i][j]).trim() !== '') { empty = false; break; }
    if (!empty) out.push(vals[i]);
  }
  return out;
}

function s(v) { return v === undefined || v === null ? '' : String(v); }
function t(row, i) { return row[i] === undefined || row[i] === null ? '' : String(row[i]).trim(); }
function yes(v) { var x = s(v).trim().toLowerCase(); return x === 'да' || x === 'yes' || x === 'true' || x === '1'; }
function isActive(v) {
  var st = s(v).trim().toLowerCase();
  return !(st.indexOf('не') === 0 || st === '0' || st === 'выключен' || st === 'off' || st === 'false');
}
function groupId(v) {
  var x = s(v).trim().toLowerCase();
  if (x === 'базовый' || x === 'base' || x === 'базовая') return 'base';
  if (x === 'высокий' || x === 'high' || x === 'высокая') return 'high';
  return 'standard';
}
function splitList(v) {
  var parts = s(v).split(','), out = [];
  for (var i = 0; i < parts.length; i++) { var p = parts[i].trim(); if (p) out.push(p); }
  return out;
}

/** Плашки: 'Название|Значение|иконка|цвет;…' (до 10). */
function cleanPart(v) { return s(v).replace(/[|;]/g, '/').replace(/\s+/g, ' ').trim(); }
function encodeExtras(list) {
  var out = [];
  for (var i = 0; i < list.length && out.length < 10; i++) {
    var e = list[i] || {};
    var label = cleanPart(e.label), value = cleanPart(e.value);
    if (!label && !value) continue;
    var parts = [label, value];
    if (e.icon || e.color) { parts.push(s(e.icon)); parts.push(s(e.color)); }
    out.push(parts.join('|'));
  }
  return out.join(';');
}
function decodeExtras(raw) {
  var out = [], parts = s(raw).split(';');
  for (var i = 0; i < parts.length && out.length < 10; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    var f = p.split('|');
    var label = t(f, 0), value = t(f, 1);
    if (!label && !value) continue;
    out.push({ label: label, value: value, icon: t(f, 2), color: t(f, 3) });
  }
  return out;
}

function isLegacyLayout(ss) {
  var sh = ss.getSheetByName('Товары');
  if (!sh || sh.getLastColumn() < 6) return false;
  return String(sh.getRange(1, 6).getDisplayValue()).trim().toLowerCase() === 'градации';
}

function readShops() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Магазины');
  var legacyPairs = false;
  try {
    legacyPairs = !!sh && sh.getLastColumn() >= 4 && String(sh.getRange(1, 4).getDisplayValue()).trim().toLowerCase().indexOf('доп.1') === 0;
  } catch (e) {}
  var id = 1, i, r, shops = [], rows = readSheet('Магазины');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 0)) continue;
    var extras = [];
    if (legacyPairs) {
      var pairs = [[3, 4], [5, 6], [7, 8]];
      for (var pi = 0; pi < pairs.length; pi++) {
        var lab = t(r, pairs[pi][0]), val = t(r, pairs[pi][1]);
        if (lab || val) extras.push({ label: lab, value: val, icon: '', color: '' });
      }
    } else {
      extras = decodeExtras(t(r, 3));
    }
    shops.push({ id: id++, name: t(r, 0), password: t(r, 1), group: groupId(t(r, 2)), extras: extras });
  }
  return shops;
}

function readPromos() {
  var id = 1, i, r, promos = [], rows = readSheet('Акции');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 3) && !t(r, 0)) continue;
    promos.push({ id: id++, start: t(r, 0), end: t(r, 1), category: t(r, 2), product: t(r, 3), price: t(r, 4), bonus: t(r, 5), comment: t(r, 6), grades: t(r, 7) });
  }
  return promos;
}

function readCategories() {
  var id = 1, i, r, categories = [], rows = readSheet('Категории');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 0)) continue;
    var so = parseInt(t(r, 2), 10);
    categories.push({ id: id++, name: t(r, 0), icon: t(r, 1) || 'box', sortOrder: isNaN(so) ? i + 1 : so });
  }
  categories.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  return categories;
}

function readSettings() {
  var settings = { reportEmail: '' }, rows = readSheet('Настройки');
  for (var i = 0; i < rows.length; i++) {
    if (t(rows[i], 0).toLowerCase().indexOf('email') === 0) settings.reportEmail = t(rows[i], 1);
  }
  return settings;
}

function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (isLegacyLayout(ss)) return getDataLegacy();

  var id = 1, i, r;
  var products = [], rows = readSheet('Товары');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 2)) continue;
    products.push({
      id: id++, category: t(r, 0), subcategory: t(r, 1), name: t(r, 2), shops: splitList(t(r, 3)),
      grades: { base: t(r, 4), standard: t(r, 5), high: t(r, 6) },
      isRed: yes(t(r, 7)), active: isActive(t(r, 8))
    });
  }
  return {
    products: products, shops: readShops(), promos: readPromos(), categories: readCategories(), settings: readSettings(),
    updatedAt: new Date().toISOString(), gasVersion: GAS_VERSION
  };
}

/** Старая раскладка (10 листов). Приложение само переносит её в новый формат. */
function getDataLegacy() {
  var id = 1, i, r;
  var products = [], rows = readSheet('Товары');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 2)) continue;
    products.push({ id: id++, category: t(r, 0), subcategory: t(r, 1), name: t(r, 2), price: t(r, 3), bonus: t(r, 4), gradations: t(r, 5), active: isActive(t(r, 6)) });
  }
  var sheetOf = { base: 'Прайс_Базовый', standard: 'Прайс_Стандартный', high: 'Прайс_Высокий' };
  id = 1;
  var priceRows = [];
  for (var gi = 0; gi < GROUPS.length; gi++) {
    rows = readSheet(sheetOf[GROUPS[gi]]);
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!t(r, 0)) continue;
      priceRows.push({ id: id++, group: GROUPS[gi], name: t(r, 0), price: t(r, 1), bonus: t(r, 2), isRed: yes(t(r, 3)), sortOrder: i + 1 });
    }
  }
  var bindings = []; rows = readSheet('Привязка_прайсов');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 0)) continue;
    bindings.push({ group: groupId(t(r, 0)), enabled: yes(t(r, 1)), shops: splitList(t(r, 2)), collections: splitList(t(r, 3)) });
  }
  id = 1;
  var groupPrices = []; rows = readSheet('Цены_по_группам');
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!t(r, 1)) continue;
    groupPrices.push({ id: id++, group: groupId(t(r, 0)), collection: t(r, 1), price: t(r, 2) });
  }
  return {
    legacy: true, products: products, priceRows: priceRows, bindings: bindings, groupPrices: groupPrices,
    shops: readShops(), promos: readPromos(), categories: readCategories(), settings: readSettings(),
    updatedAt: new Date().toISOString(), gasVersion: GAS_VERSION
  };
}
`;

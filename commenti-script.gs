/* Script Google per i commenti del sito Apex Drawn.
   Va incollato in Estensioni > Apps Script di un Foglio Google (istruzioni nel README).
   I commenti si salvano nel foglio "commenti": per cancellarne uno basta eliminare la riga. */

var NOME_FOGLIO = 'commenti';
var MAX_NOME = 24;
var MAX_MSG = 280;
var SQUADRE = ['', 'NJ Racing', 'Royal Lion', 'Raptor Racing', 'Italia Eagle'];

function foglio_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NOME_FOGLIO);
  if (!sh) {
    sh = ss.insertSheet(NOME_FOGLIO);
    sh.appendRow(['data', 'nome', 'squadra', 'messaggio']);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// evita che il testo venga interpretato come formula nel foglio
function pulisci_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doGet() {
  var sh = foglio_();
  var last = sh.getLastRow();
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
  var out = rows.map(function (r) {
    var t = new Date(r[0]).getTime();
    return { t: isNaN(t) ? 0 : t, nome: String(r[1]), squadra: String(r[2]), msg: String(r[3]) };
  }).filter(function (c) { return c.nome && c.msg; }).reverse().slice(0, 100);
  return json_(out);
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, errore: 'dati non validi' }); }
  var nome = pulisci_(d.nome, MAX_NOME);
  var msg = pulisci_(d.msg, MAX_MSG);
  var squadra = SQUADRE.indexOf(d.squadra) >= 0 ? d.squadra : '';
  if (!nome || !msg) return json_({ ok: false, errore: 'manca nome o messaggio' });
  if (d.sito) return json_({ ok: true }); // campo trappola per i bot: finge di aver salvato
  if (/https?:\/\/|www\./i.test(msg) || /https?:\/\/|www\./i.test(nome)) return json_({ ok: false, errore: 'i link non sono ammessi' });
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    foglio_().appendRow([new Date(), nome, squadra, msg]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

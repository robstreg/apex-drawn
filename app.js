(function () {
'use strict';
const D = window.APEX;
const TOTAL = D.gare || D.calendario.length;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const team = id => D.squadre.find(t => t.id === id) || { id, nome: id, sigla: '?', colore: '#8e97aa', logo: '' };
const drv = nick => D.piloti.find(p => p.nick === nick);
const colorOf = nick => team((drv(nick) || {}).squadra).colore;
const teamNameOf = nick => team((drv(nick) || {}).squadra).nome;

/* ---------- tempi ---------- */
function parseT(s) {
  if (s == null || s === '') return null;
  const t = String(s).trim().replace(/^\+/, '').replace(',', '.');
  if (t.includes(':')) { const [m, sec] = t.split(':'); const v = (+m) * 60 + parseFloat(sec); return isNaN(v) ? null : v; }
  const v = parseFloat(t); return isNaN(v) ? null : v;
}
function fmtT(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return m + ':' + s.toFixed(3).padStart(6, '0').replace('.', ',');
}
function fmtGap(sec) { return '+' + sec.toFixed(3).replace('.', ','); }

/* ---------- calcolo ---------- */
function dropSet(vals) {
  const k = Math.max(0, vals.length - D.validi);
  const idx = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, k).map(x => x[1]);
  return new Set(idx);
}
function reverseGrid(finishOrder) {
  const full = finishOrder.slice().reverse();
  D.piloti.forEach(p => { if (!full.includes(p.nick)) full.push(p.nick); }); // chi non ha corso va in fondo
  return full;
}
function compute() {
  const warns = [];
  const rounds = Object.keys(D.risultati).map(Number)
    .filter(n => D.risultati[n] && D.risultati[n].arrivo && D.risultati[n].arrivo.length).sort((a, b) => a - b);
  const races = {};
  let prev = null;
  rounds.forEach(n => {
    const r = D.risultati[n];
    const order = r.arrivo.map(e => e[0]);
    if (n > TOTAL) warns.push('GP ' + n + ': il campionato ha ' + TOTAL + ' GP, controlla il numero.');
    if (new Set(order).size !== order.length) warns.push('GP ' + n + ': un pilota compare due volte nell\'arrivo.');
    if (!String(r.arrivo[0][1] || '').trim()) warns.push('GP ' + n + ': il vincitore deve avere il tempo di gara totale.');
    order.forEach(k => { if (!drv(k)) warns.push('GP ' + n + ': il pilota "' + k + '" non esiste nell\'elenco piloti (controlla il nickname).'); });
    const grid = prev ? reverseGrid(prev).filter(k => order.includes(k)) : null;
    const winT = parseT(r.arrivo[0][1]);
    const rows = r.arrivo.map((e, i) => {
      const dnf = e[2] === 'DNF';
      const raw = String(e[1] || '').trim();
      let gap = null, abs = null;
      if (i === 0) abs = winT;
      else if (raw.startsWith('+')) { gap = parseT(raw); abs = winT != null && gap != null ? winT + gap : null; }
      else { abs = parseT(raw); gap = abs != null && winT != null ? abs - winT : null; }
      return { nick: e[0], pos: i + 1, time: raw, dnf, gap, abs,
        pts: (!dnf && i < D.punti.length) ? D.punti[i] : 0,
        gridPos: grid ? grid.indexOf(e[0]) + 1 : null };
    });
    races[n] = { n, meta: D.calendario.find(c => c.n === n) || { n, nome: 'GP ' + n },
      rows, grid, pole: r.pole || (grid ? grid[0] : null), fl: r.giroVeloce || null };
    prev = order;
  });
  ((D.qualifiche && D.qualifiche.risultati) || []).forEach(e => { if (!drv(e[0])) warns.push('Qualifiche: il pilota "' + e[0] + '" non esiste nell\'elenco piloti.'); });
  const played = rounds.length;
  const lastRound = played ? rounds[played - 1] : 0;
  const nextRound = lastRound < TOTAL ? lastRound + 1 : null;
  const nextGrid = (nextRound && prev) ? reverseGrid(prev) : null;

  const pen = nick => (D.penalita || []).filter(x => x.pilota === nick).reduce((a, x) => a + (+x.punti || 0), 0);
  const finish = (arr) => arr;

  const drivers = D.piloti.map(p => {
    const per = rounds.map(n => {
      const row = races[n].rows.find(r => r.nick === p.nick);
      return { n, pts: row ? row.pts : 0, pos: row ? row.pos : null, dnf: row ? row.dnf : false, took: !!row };
    });
    const drop = dropSet(per.map(x => x.pts));
    const counts = Array(D.piloti.length + 2).fill(0);
    per.forEach(x => { if (x.took && !x.dnf) counts[x.pos]++; });
    const penalty = pen(p.nick);
    const total = per.reduce((a, x, i) => a + (drop.has(i) ? 0 : x.pts), 0) - penalty;
    return { nick: p.nick, squadra: p.squadra, per, drop, counts, penalty, total,
      wins: counts[1], podiums: counts[1] + counts[2] + counts[3],
      poles: rounds.filter(n => races[n].pole === p.nick).length,
      fls: rounds.filter(n => races[n].fl && races[n].fl.pilota === p.nick).length,
      starts: per.filter(x => x.took).length };
  });
  const cmp = (a, b, name) => b.total - a.total ||
    (() => { for (let i = 1; i < a.counts.length; i++) { if (b.counts[i] !== a.counts[i]) return b.counts[i] - a.counts[i]; } return 0; })() ||
    String(a[name]).localeCompare(String(b[name]));
  drivers.sort((a, b) => cmp(a, b, 'nick'));
  drivers.forEach((d, i) => d.rank = i + 1);

  const teams = D.squadre.map(t => {
    const mine = drivers.filter(d => d.squadra === t.id);
    const per = rounds.map((n, i) => ({ n, pts: mine.reduce((a, d) => a + d.per[i].pts, 0) }));
    const drop = dropSet(per.map(x => x.pts));
    const counts = Array(D.piloti.length + 2).fill(0);
    mine.forEach(d => d.counts.forEach((c, i) => counts[i] += c));
    const penalty = mine.reduce((a, d) => a + d.penalty, 0);
    const total = per.reduce((a, x, i) => a + (drop.has(i) ? 0 : x.pts), 0) - penalty;
    return { id: t.id, def: t, mine, per, drop, counts, penalty, total,
      wins: counts[1], podiums: counts[1] + counts[2] + counts[3],
      poles: mine.reduce((a, d) => a + d.poles, 0), fls: mine.reduce((a, d) => a + d.fls, 0) };
  });
  teams.sort((a, b) => cmp(a, b, 'id'));
  teams.forEach((t, i) => t.rank = i + 1);

  return { warns, rounds, races, played, lastRound, nextRound, nextGrid, drivers, teams };
}
const S = compute();

/* ---------- componenti ---------- */
const VERSION = '2026-11-05';
const EXTS = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG', 'webp'];
function cands(base, explicit) { return explicit ? [explicit] : EXTS.map(e => base + '.' + e); }
function gpFoto(n) { const c = D.calendario.find(x => x.n === n) || {}; return cands('foto/gp-' + n, c.foto); }
function imgTag(list, alt, kind) {
  return '<img src="' + esc(list[0]) + '" data-c="' + esc(JSON.stringify(list)) + '" data-i="0" data-k="' + kind + '" alt="' + esc(alt) + '"' +
    (kind === 'banner' ? ' loading="lazy"' : '') + ' onload="__ld(this)" onerror="__try(this)">';
}
function banner(n) { return '<figure class="banner">' + imgTag(gpFoto(n), 'Foto del GP ' + n, 'banner') + '</figure>'; }
window.__ld = img => { const a = img.parentNode; if (a && a.tagName === 'A') a.href = img.src; };
window.__try = img => {
  const l = JSON.parse(img.dataset.c), i = +img.dataset.i + 1;
  if (i < l.length) { img.dataset.i = i; img.src = l[i]; return; }
  if (img.dataset.k === 'banner') { img.closest('figure').remove(); return; }
  const p = document.createElement('p'); p.className = 'empty';
  p.textContent = 'Non trovo l\'immagine ' + l[0] + (l.length > 1 ? ' (ho provato anche .JPG, .jpeg, .png e .webp)' : '') +
    '. Controlla che il file sia nella cartella giusta e che il nome sia identico, maiuscole comprese. Per un controllo completo apri la pagina #/diagnosi.';
  img.parentNode.replaceWith(p);
};
function logo(t, size) {
  const s = size || 56;
  const img = t.logo ? '<img src="' + esc(t.logo) + '" alt="" data-c="' + t.colore + '" data-i="' + esc(t.sigla) + '" onerror="__lf(this)">' :
    '<span class="mono" style="--c:' + t.colore + '">' + esc(t.sigla) + '</span>';
  return '<span class="logo" style="--s:' + s + 'px">' + img + '</span>';
}
window.__lf = img => {
  const s = document.createElement('span'); s.className = 'mono';
  s.style.setProperty('--c', img.dataset.c); s.textContent = img.dataset.i; img.replaceWith(s);
};
function row(pos, c, name, sub, val, i) {
  return '<div class="tr" style="--c:' + c + ';--i:' + (i || 0) + '"><span class="pos">' + pos + '</span>' +
    '<span class="nm">' + esc(name) + '</span><span class="sub">' + esc(sub) + '</span><span class="val">' + (val == null ? '' : val) + '</span></div>';
}
const pts = n => n + '<small>pt</small>';
function raceTitle(r) { return r.meta.nome + (r.meta.circuito ? ', ' + r.meta.circuito : ''); }
function fmtDate(s) {
  if (!s) return 'Data da definire';
  const d = new Date(s + 'T12:00:00'); if (isNaN(d)) return s;
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
function gridList(grid) {
  return '<div class="tower">' + grid.map((k, i) => row(i + 1, colorOf(k), k, teamNameOf(k), '', i)).join('') + '</div>';
}
function head(title, lede) { return '<h1 class="h1">' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : ''); }
function warnBox() {
  return S.warns.length ? '<div class="warn"><b>Controlla data.js</b>' + S.warns.map(w => '<p>' + esc(w) + '</p>').join('') + '</div>' : '';
}

/* ---------- pagine ---------- */
const pages = {};

pages.home = function () {
  const lead = S.drivers[0];
  const prog = Array.from({ length: TOTAL }, (_, i) => {
    const n = i + 1; return '<i class="' + (S.rounds.includes(n) ? 'done' : n === S.nextRound ? 'next' : '') + '"></i>';
  }).join('');
  const hero = S.played ? (
    '<div><p class="lead-k">In testa al mondiale dopo il ' + esc(S.races[S.lastRound].meta.nome) + '</p>' +
    '<h1 class="lead-name" style="--c:' + colorOf(lead.nick) + '">' + esc(lead.nick) + '</h1>' +
    '<p class="lead-sub">' + esc(teamNameOf(lead.nick)) + ', ' + lead.total + ' punti</p>' +
    '<div class="prog" aria-hidden="true">' + prog + '</div><p class="prog-l">' + S.played + ' Gran Premi disputati su ' + TOTAL + '</p></div>'
  ) : (
    '<div><h1 class="lead-name" style="--c:#eef0f5">Si parte</h1><p class="lead-sub">Il campionato inizia con il GP 1.</p>' +
    '<div class="prog" aria-hidden="true">' + prog + '</div><p class="prog-l">' + TOTAL + ' Gran Premi in calendario</p></div>'
  );
  const tower = '<div><div class="tower">' + S.drivers.map((d, i) => row(i + 1, colorOf(d.nick), d.nick, teamNameOf(d.nick), pts(d.total), i)).join('') +
    '</div><p class="note"><a href="#/driver-standings">Classifica piloti completa</a></p></div>';

  let last = '';
  if (S.played) {
    const r = S.races[S.lastRound];
    last = '<section class="panel">' + banner(r.n) + '<h2 class="h2">' + esc(r.meta.nome) + '</h2>' +
      (r.meta.circuito ? '<p class="muted" style="margin:-8px 0 14px">' + esc(r.meta.circuito) + '</p>' : '') +
      '<div class="tower">' + r.rows.slice(0, 3).map((x, i) => row(x.pos, colorOf(x.nick), x.nick, i === 0 ? x.time : x.time, pts(x.pts), i)).join('') + '</div>' +
      '<p class="note"><a href="#/race-results/' + r.n + '">Risultato completo</a></p></section>';
  } else last = '<section class="panel"><h2 class="h2">Ultimo GP</h2><p class="empty">Nessun GP disputato.</p></section>';

  const cons = '<section class="panel"><h2 class="h2">Costruttori</h2><div class="tower">' +
    S.teams.map((t, i) => row(i + 1, t.def.colore, t.def.nome, t.mine.map(m => m.nick).join(' e '), pts(t.total), i)).join('') +
    '</div><p class="note"><a href="#/constructor-standings">Classifica costruttori completa</a></p></section>';

  const nextName = S.nextRound ? (D.calendario.find(c => c.n === S.nextRound) || {}).nome || 'GP ' + S.nextRound : '';
  const grid = '<section class="panel"><h2 class="h2">' + (S.nextRound ? 'Griglia ' + esc(nextName) : 'Griglia') + '</h2>' +
    (S.nextGrid ? gridList(S.nextGrid) + '<p class="note">Inversa rispetto all\'arrivo del GP precedente: l\'ultimo parte in pole.</p>' :
      '<p class="empty">' + (S.nextRound ? 'La griglia del primo GP viene decisa prima della gara.' : 'Campionato concluso.') + '</p>') + '</section>';

  return '<div class="home">' + warnBox() + '<div class="hero">' + hero + tower + '</div><div class="grid3 sec">' + last + cons + grid + '</div></div>';
};

function perCells(per, drop) {
  let h = '';
  for (let n = 1; n <= TOTAL; n++) {
    const i = per.findIndex(x => x.n === n);
    if (i < 0) { h += '<td class="zero">&nbsp;</td>'; continue; }
    const x = per[i];
    const t = x.took === false ? '-' : x.pts;
    h += '<td class="' + (drop.has(i) ? 'drop' : x.pts === 0 ? 'zero' : '') + '">' + t + '</td>';
  }
  return h;
}
function perHeads() {
  let h = '';
  for (let n = 1; n <= TOTAL; n++) {
    const c = D.calendario.find(c => c.n === n) || {};
    h += '<th title="' + esc(c.circuito || '') + '">GP' + n + '</th>';
  }
  return h;
}

pages['driver-standings'] = function () {
  const body = S.drivers.map(d => '<tr style="--c:' + colorOf(d.nick) + '"><td>' + d.rank + '</td>' +
    '<td><span class="who">' + esc(d.nick) + '</span><span class="team">' + esc(teamNameOf(d.nick)) + '</span></td>' +
    perCells(d.per, d.drop) + '<td class="tot">' + d.total + '</td></tr>').join('');
  return warnBox() + head('Driver standings', 'Classifica dei ' + D.piloti.length + ' piloti. Contano i migliori ' + D.validi + ' risultati.') +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Pilota</th>' + perHeads() + '<th class="tot">Punti</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="note">I risultati scartati sono barrati. Il trattino indica un GP senza partecipazione.</p>';
};

pages['constructor-standings'] = function () {
  const body = S.teams.map(t => '<tr style="--c:' + t.def.colore + '"><td>' + t.rank + '</td>' +
    '<td><span class="who">' + esc(t.def.nome) + '</span><span class="team">' + esc(t.mine.map(m => m.nick).join(' e ')) + '</span></td>' +
    perCells(t.per.map(x => Object.assign({ took: true }, x)), t.drop) + '<td class="tot">' + t.total + '</td></tr>').join('');
  return warnBox() + head('Constructor standings', 'Classifica delle ' + D.squadre.length + ' scuderie. Ogni GP vale la somma dei punti dei due piloti, contano i migliori ' + D.validi + '.') +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Scuderia</th>' + perHeads() + '<th class="tot">Punti</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="note">I punteggi scartati sono barrati.</p>';
};

pages.teams = function () {
  const order = S.teams;
  return warnBox() + head('Teams', 'Le quattro scuderie e i loro piloti.') + '<div class="grid2">' + order.map(t =>
    '<article class="tcard" style="--c:' + t.def.colore + '"><div class="thead">' + logo(t.def, 72) +
    '<div><h3>' + esc(t.def.nome) + '</h3><p>' + t.rank + '° nei costruttori, ' + t.total + ' punti</p></div></div>' +
    '<div class="tower">' + t.mine.slice().sort((a, b) => a.rank - b.rank).map((d, i) => row(d.rank, t.def.colore, d.nick, d.rank + '° nei piloti', pts(d.total), i)).join('') + '</div>' +
    '<div class="tstats"><div><b>' + t.wins + '</b><span>Vittorie</span></div><div><b>' + t.podiums + '</b><span>Podi</span></div><div><b>' + t.poles + '</b><span>Pole</span></div></div></article>'
  ).join('') + '</div>' + commentsBox();
};

/* commenti: salvati in un Foglio Google tramite uno script (vedi README) */
const CK = 'apex_comment_user', CT = 'apex_comment_time';
function cUrl() { const u = D.commenti && D.commenti.url; return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u || '') ? u : ''; }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function commentsBox() {
  if (!cUrl()) return '';
  return '<section class="sec comments" aria-label="Commenti"><h2 class="h2">Commenti</h2><div class="panel">' +
    '<form id="cform" class="cform" autocomplete="off">' +
    '<div class="crow"><div><label for="cn">Nome</label><input id="cn" maxlength="24" required></div>' +
    '<div><label for="cs">Riguarda</label><select id="cs"><option value="">Tutte le squadre</option>' + D.squadre.map(t => '<option>' + esc(t.nome) + '</option>').join('') + '</select></div></div>' +
    '<label for="cm">Messaggio</label><textarea id="cm" maxlength="280" rows="3" required></textarea>' +
    '<input id="csito" name="sito" tabindex="-1" aria-hidden="true" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px">' +
    '<div class="cact"><button class="btn" type="submit" id="cbtn">Pubblica commento</button><span id="cmsg" class="cstat" role="status"></span></div></form>' +
    '<div id="clist" aria-live="polite"><p class="empty">Carico i commenti...</p></div></div></section>';
}
function renderComments(list) {
  const box = $('#clist'); if (!box) return;
  if (!list.length) { box.innerHTML = '<p class="empty">Nessun commento per ora. Scrivi il primo.</p>'; return; }
  box.innerHTML = list.map(c => {
    const t = D.squadre.find(x => x.nome === c.squadra);
    const when = c.t ? new Date(c.t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return '<article class="cmt" style="--c:' + (t ? t.colore : 'var(--line)') + '"><div class="chead"><b>' + esc(c.nome) + '</b>' +
      (t ? '<span class="ctag">' + esc(t.nome) + '</span>' : '') + (when ? '<time>' + esc(when) + '</time>' : '') + '</div><p>' + esc(c.msg) + '</p></article>';
  }).join('');
}
function fetchComments() {
  return fetch(cUrl()).then(r => r.json()).then(list => { renderComments(Array.isArray(list) ? list : []); })
    .catch(() => { const b = $('#clist'); if (b) b.innerHTML = '<p class="empty">Non riesco a caricare i commenti. Riprova tra poco.</p>'; });
}
function loadComments() {
  const f = $('#cform'); if (!f) return;
  const saved = store(CK); if (saved) $('#cn').value = saved;
  const say = (t, bad) => { const m = $('#cmsg'); m.textContent = t; m.className = 'cstat' + (bad ? ' bad' : ''); };
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const nome = $('#cn').value.trim(), msg = $('#cm').value.trim(), sq = $('#cs').value;
    if (!nome || !msg) { say('Scrivi nome e messaggio.', true); return; }
    if (/https?:\/\/|www\./i.test(nome + ' ' + msg)) { say('I link non sono ammessi nei commenti.', true); return; }
    const last = +store(CT) || 0, wait = Math.ceil((last + 30000 - Date.now()) / 1000);
    if (wait > 0) { say('Aspetta ancora ' + wait + ' secondi prima di scrivere un altro commento.', true); return; }
    const btn = $('#cbtn'); btn.disabled = true; say('Invio in corso...');
    fetch(cUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ nome, msg, squadra: sq, sito: $('#csito').value }) })
      .then(r => r.json()).then(r => {
        if (!r.ok) throw new Error(r.errore || 'errore');
        store(CK, nome); store(CT, String(Date.now())); $('#cm').value = ''; say('Commento pubblicato.'); return fetchComments();
      }).catch(() => say('Non sono riuscito a pubblicare il commento. Riprova.', true))
      .then(() => { btn.disabled = false; });
  });
  fetchComments();
}

pages.qualifiche = function () {
  const Q = D.qualifiche || {}, list = Q.risultati || [];
  const intro = 'Le qualifiche disputate prima del campionato, da cui sono nate le quattro scuderie.';
  if (!list.length) return warnBox() + head('Qualifiche mondiale', intro) + '<div class="panel"><p class="empty">I risultati delle qualifiche non sono ancora stati inseriti.</p></div>';
  const meta = (Q.circuito || Q.data) ? '<div class="meta">' +
    (Q.circuito ? '<div><span>Circuito</span><b>' + esc(Q.circuito) + '</b></div>' : '') +
    (Q.data ? '<div><span>Data</span><b>' + esc(fmtDate(Q.data)) + '</b></div>' : '') + '</div>' : '';
  const body = list.map((e, i) => {
    const t = team((drv(e[0]) || {}).squadra);
    const mate = D.piloti.find(p => p.squadra === t.id && p.nick !== e[0]);
    return '<tr style="--c:' + t.colore + '"><td>' + (i + 1) + '</td><td><span class="who">' + esc(e[0]) + '</span></td><td>' + esc(e[1] || '-') + '</td>' +
      '<td class="tm"><span class="tmw">' + logo(t, 28) + esc(t.nome) + '</span></td><td class="tm"><span class="who">' + esc(mate ? mate.nick : '-') + '</span></td></tr>';
  }).join('');
  return warnBox() + head('Qualifiche mondiale', intro) + meta +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Pilota</th><th>Tempo</th><th class="l">Scuderia</th><th class="l">Compagno</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    (Q.nota ? '<p class="note">' + esc(Q.nota) + '</p>' : '');
};

pages.giornale = function (sel) {
  const G = (D.giornale || []).slice().sort((a, b) => a.n - b.n);
  const intro = 'Il quotidiano ufficiale del campionato mondiale Apex Drawn.';
  if (!G.length) return head('Safe Sport', intro) + '<div class="panel"><p class="empty">Il primo numero non è ancora uscito.</p></div>';
  const cur = G.find(g => g.n === +sel) || G[G.length - 1];
  const list = cands('giornale/safe-sport-' + cur.n, cur.file);
  const tabs = G.length > 1 ? '<nav class="tabs" aria-label="Numeri del giornale">' + G.map(g =>
    '<a href="#/giornale/' + g.n + '"' + (g.n === cur.n ? ' aria-current="true"' : '') + '>N. ' + g.n + '</a>').join('') + '</nav>' : '';
  const meta = '<div class="meta"><div><span>Numero</span><b>' + cur.n + '</b></div>' +
    (cur.data ? '<div><span>Data</span><b>' + esc(fmtDate(cur.data)) + '</b></div>' : '') +
    (cur.titolo ? '<div><span>In prima pagina</span><b>' + esc(cur.titolo) + '</b></div>' : '') + '</div>';
  return head('Safe Sport', intro) + tabs + meta +
    '<figure class="paper"><a href="' + esc(list[0]) + '" target="_blank" rel="noopener">' + imgTag(list, 'Prima pagina del numero ' + cur.n + ' di Safe Sport', 'paper') + '</a></figure>' +
    '<p class="note">Tocca l\'immagine per aprirla a grandezza intera.</p>';
};

pages['race-results'] = function (sel) {
  let n = +sel; if (!S.rounds.includes(n)) n = S.lastRound;
  const tabs = '<nav class="tabs" aria-label="Gran Premi">' + Array.from({ length: TOTAL }, (_, i) => {
    const k = i + 1, on = S.rounds.includes(k);
    return '<a href="#/race-results/' + k + '" class="' + (on ? '' : 'off') + '"' + (k === n ? ' aria-current="true"' : '') + '>GP ' + k + '</a>';
  }).join('') + '</nav>';
  if (!n) return head('Race results') + tabs + '<p class="empty">Nessun GP disputato per ora.</p>';
  const r = S.races[n];
  const hasGrid = !!r.grid;
  const body = r.rows.map(x => {
    const ch = x.gridPos ? x.gridPos - x.pos : null;
    const chT = ch == null || x.dnf ? '-' : ch > 0 ? '<span class="up">+' + ch + '</span>' : ch < 0 ? '<span class="dn">' + ch + '</span>' : '=';
    const time = x.dnf ? 'DNF' : (x.pos === 1 ? esc(x.time) : esc(x.time));
    return '<tr style="--c:' + colorOf(x.nick) + '"><td>' + x.pos + '</td><td><span class="who">' + esc(x.nick) + '</span><span class="team">' + esc(teamNameOf(x.nick)) + '</span></td>' +
      '<td>' + time + '</td><td class="tot">' + x.pts + '</td>' + (hasGrid ? '<td class="gap">' + (x.gridPos || '-') + '</td><td>' + chT + '</td>' : '') + '</tr>';
  }).join('');
  const meta = '<div class="meta"><div><span>Circuito</span><b>' + esc(r.meta.circuito || 'Da definire') + '</b></div>' +
    '<div><span>Data</span><b>' + esc(fmtDate(r.meta.data)) + '</b></div>' +
    '<div><span>Pole position</span><b>' + (r.pole ? esc(r.pole) : '-') + '</b></div>' +
    '<div><span>Giro veloce</span><b>' + (r.fl && r.fl.pilota ? esc(r.fl.pilota) + (r.fl.tempo ? ' ' + esc(r.fl.tempo) : '') : '-') + '</b></div></div>';
  return warnBox() + head('Race results') + tabs + banner(n) + meta +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Pilota</th><th>Tempo</th><th class="tot">Punti</th>' + (hasGrid ? '<th>Griglia</th><th>+/-</th>' : '') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    (hasGrid ? '<p class="note">+/- è il numero di posizioni guadagnate (+) o perse (-) rispetto alla griglia di partenza.</p>' : '');
};

function bars(title, key) {
  const list = S.drivers.slice().sort((a, b) => b[key] - a[key] || a.rank - b.rank);
  const max = Math.max(1, list[0] ? list[0][key] : 1);
  return '<section class="panel"><h2 class="h2">' + title + '</h2><div class="bars">' + list.map(d =>
    '<div class="b" style="--c:' + colorOf(d.nick) + '"><span class="l">' + esc(d.nick) + '</span><span class="t"><span class="f" style="display:block;width:' + (d[key] / max * 100) + '%"></span></span><span class="n">' + d[key] + '</span></div>').join('') + '</div></section>';
}
function recCard(label, value, nick, detail) {
  return '<div class="rec"' + (nick ? ' style="--c:' + colorOf(nick) + '"' : '') + '><span>' + label + '</span><b>' + (value || '-') + '</b><small>' + (nick ? esc(nick) + (detail ? ', ' + esc(detail) : '') : 'Non ancora disponibile') + '</small></div>';
}
pages.statistics = function () {
  const rs = S.rounds.map(n => S.races[n]);
  let fl = null, best = null, wide = null, narrow = null, cb = null;
  rs.forEach(r => {
    if (r.fl && r.fl.pilota && parseT(r.fl.tempo) != null) { const t = parseT(r.fl.tempo); if (!fl || t < fl.t) fl = { t, nick: r.fl.pilota, r }; }
    const w = r.rows[0]; if (w && w.abs != null && (!best || w.abs < best.t)) best = { t: w.abs, nick: w.nick, r };
    const s = r.rows[1]; if (s && s.gap != null && !s.dnf) {
      if (!wide || s.gap > wide.t) wide = { t: s.gap, nick: w.nick, r };
      if (!narrow || s.gap < narrow.t) narrow = { t: s.gap, nick: w.nick, r };
    }
    r.rows.forEach(x => { if (x.gridPos && !x.dnf) { const g = x.gridPos - x.pos; if (g > 0 && (!cb || g > cb.g)) cb = { g, nick: x.nick, r, from: x.gridPos, to: x.pos }; } });
  });
  const where = r => r.meta.nome + (r.meta.circuito ? ' ' + r.meta.circuito : '');
  const recs = '<div class="recs">' +
    recCard('Miglior giro', fl && fmtT(fl.t), fl && fl.nick, fl && where(fl.r)) +
    recCard('Miglior tempo di gara', best && fmtT(best.t), best && best.nick, best && where(best.r)) +
    recCard('Vittoria più larga', wide && fmtGap(wide.t), wide && wide.nick, wide && where(wide.r)) +
    recCard('Vittoria più risicata', narrow && fmtGap(narrow.t), narrow && narrow.nick, narrow && where(narrow.r)) +
    recCard('Miglior rimonta', cb && ('+' + cb.g + ' posizioni'), cb && cb.nick, cb && (where(cb.r) + ', dal ' + cb.from + '° al ' + cb.to + '°')) + '</div>';
  return warnBox() + head('Statistics', 'Dati calcolati sui ' + S.played + ' GP disputati.') +
    '<div class="grid2">' + bars('Vittorie', 'wins') + bars('Podi', 'podiums') + bars('Pole position', 'poles') + bars('Giri veloci', 'fls') + '</div>' +
    '<h2 class="h2 sec">Record</h2>' + recs;
};

pages.calendar = function () {
  const items = Array.from({ length: TOTAL }, (_, i) => {
    const n = i + 1, c = D.calendario.find(x => x.n === n) || { n, nome: 'GP ' + n, circuito: '', data: '' };
    const played = S.rounds.includes(n), next = n === S.nextRound;
    const st = played ? '<span class="chip" style="color:' + colorOf(S.races[n].rows[0].nick) + '">Vince ' + esc(S.races[n].rows[0].nick) + '</span>' :
      next ? '<span class="chip">Prossima gara</span>' : '<span class="chip mut">In programma</span>';
    const inner = '<span class="rd">' + n + '</span><div><h3>' + esc(c.nome) + '</h3><p>' + esc(c.circuito || 'Circuito da definire') + ', ' + esc(fmtDate(c.data)) + '</p></div>' + st;
    return played ? '<a class="ci" href="#/race-results/' + n + '">' + inner + '</a>' : '<div class="ci' + (next ? ' next' : '') + '">' + inner + '</div>';
  });
  const grid = S.nextGrid ? '<h2 class="h2 sec">Griglia del GP ' + S.nextRound + '</h2><div class="panel">' + gridList(S.nextGrid) + '</div>' : '';
  return warnBox() + head('Calendar', TOTAL + ' Gran Premi. Il nome di un GP disputato apre il risultato.') + '<div class="cal">' + items.join('') + '</div>' + grid;
};

pages.diagnosi = function () {
  return head('Diagnosi del sito', 'Controllo automatico di dati, giornale, foto, commenti e musica. Questa pagina non è nel menu.') +
    '<div class="dg" id="dg"><p class="empty">Controllo in corso...</p></div>';
};
function probeImg(list) {
  return list.reduce((p, u) => p.then(found => found || new Promise(res => { const im = new Image(); im.onload = () => res(u); im.onerror = () => res(null); im.src = u; })), Promise.resolve(null));
}
async function runDiag() {
  const box = $('#dg'); if (!box) return;
  const rows = [], NAMES = { ok: 'Ok', bad: 'Problema', info: 'Nota' };
  const add = (st, t, x) => { rows.push([st, t, x]); box.innerHTML = rows.map(r => '<div class="dgr ' + r[0] + '"><span class="dgs">' + NAMES[r[0]] + '</span><div><b>' + esc(r[1]) + '</b><p>' + esc(r[2]) + '</p></div></div>').join(''); };
  add('info', 'Versione del sito', 'app.js versione ' + VERSION + '. Se non è quella dell\'ultimo zip che ti ho mandato, il file app.js non è stato sostituito, oppure la pagina è in cache: ricarica forzando (Ctrl+F5; su telefono chiudi e riapri il browser).');
  add(S.warns.length ? 'bad' : 'ok', 'Risultati in data.js', S.played + ' GP inseriti su ' + TOTAL + '.' + (S.warns.length ? ' Problemi: ' + S.warns.join(' ') : ' Nessun errore nei nickname o nei tempi.'));

  if (!Array.isArray(D.giornale)) add('bad', 'Giornale', 'Nel data.js manca il blocco "giornale: [ ... ]". Probabilmente il data.js è di una versione precedente: incolla il blocco sopra la riga "risultati: {".');
  else if (!D.giornale.length) add('info', 'Giornale', 'Il blocco giornale è vuoto, quindi la pagina dice che il primo numero non è uscito. Attenzione: le righe che iniziano con // sono commenti e vengono ignorate. Togli le due barre e scrivi ad esempio: { n: 1, data: "2026-11-02", titolo: "Titolo" },');
  else for (const g of D.giornale) {
    const list = cands('giornale/safe-sport-' + g.n, g.file), f = await probeImg(list);
    if (f) add('ok', 'Giornale numero ' + g.n, 'Trovato il file ' + f + '.');
    else add('bad', 'Giornale numero ' + g.n, 'Non trovo il file ' + list[0] + (list.length > 1 ? ' (provato anche ' + list.slice(1).join(', ') + ')' : '') + '. Il file deve essere nella cartella "giornale" del sito, con questo nome e il numero uguale a n: ' + g.n + '.');
  }

  const fotos = [];
  for (const n of S.rounds) { const l = gpFoto(n), f = await probeImg(l); if (f) fotos.push('GP ' + n + ': ' + f); }
  add('info', 'Foto dei GP', fotos.length ? 'Trovate: ' + fotos.join('; ') + '.' : 'Nessuna foto trovata (è facoltativo). Per aggiungerle: foto/gp-1.jpg, foto/gp-2.jpg...');

  const cm = D.commenti;
  if (!cm) add('bad', 'Commenti', 'Nel data.js manca il blocco "commenti: { url: "" },". Probabilmente il data.js è di una versione precedente.');
  else if (!cm.url) add('info', 'Commenti', 'Non configurati: "url" è vuoto in data.js, quindi la sezione resta nascosta nella pagina Teams.' + (cm.disqus !== undefined ? ' Hai ancora il vecchio campo "disqus": sostituiscilo con url, come nel README.' : ' Per attivarli segui la sezione Commenti del README.'));
  else if (!cUrl()) add('bad', 'Commenti', 'L\'indirizzo in data.js non ha il formato giusto. Deve essere https://script.google.com/macros/s/.../exec e finire con /exec. Hai scritto: ' + cm.url);
  else {
    try {
      const r = await fetch(cm.url), t = await r.text(); let x = null; try { x = JSON.parse(t); } catch (e) {}
      if (Array.isArray(x)) add('ok', 'Commenti', 'Lo script Google risponde correttamente (' + x.length + ' commenti nel foglio).');
      else add('bad', 'Commenti', 'Lo script ha risposto, ma non con i commenti. Di solito il deployment non è impostato su "Chi ha accesso: Chiunque", oppure l\'indirizzo è di una versione vecchia del deployment.');
    } catch (e) { add('bad', 'Commenti', 'Non riesco a contattare lo script. Controlla l\'indirizzo e che il deployment sia "App web" con accesso "Chiunque".'); }
  }

  const ms = D.musica, src = musicSrc();
  if (!ms) add('bad', 'Musica', 'Nel data.js non trovo il blocco "musica: { file: "...", titolo: "..." },". Controlla che la riga sia scritta fuori da altri blocchi, subito sopra "risultati: {", con la virgola finale. Se hai appena salvato, aspetta 1-2 minuti e ricarica forzando.');
  else if (!String(ms.file || '').trim()) add('info', 'Musica', 'Il blocco musica c\'e\', ma "file" e\' vuoto, quindi il pulsante non compare. Scrivi ad esempio: musica: { file: "musica/sottofondo.mp3", titolo: "Nome del brano" },');
  else if (!src) add('bad', 'Musica', 'Il percorso "' + ms.file + '" non e\' valido. Usa un percorso come musica/sottofondo.mp3 oppure un indirizzo che inizia con https://.');
  else {
    const ok = await new Promise(res => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(true); a.onerror = () => res(false); setTimeout(() => res(false), 8000); a.src = src; });
    add(ok ? 'ok' : 'bad', 'Musica', ok ? 'Il file ' + ms.file + ' si carica. Il pulsante Musica compare in basso a destra (se non lo vedi, ricarica forzando).' : 'Il pulsante c\'e\', ma non riesco a caricare ' + ms.file + '. Controlla che il file sia nella cartella "musica" del sito e che il nome sia identico, maiuscole comprese.');
  }
}

pages.regolamento = function () {
  return head('Regolamento') + '<div class="rules">' + D.regolamento.map(s =>
    '<section class="panel"><h3>' + esc(s.titolo) + '</h3>' + s.righe.map(l => '<p>' + esc(l) + '</p>').join('') +
    (s.punti ? '<div class="pts">' + D.punti.map((p, i) => '<div><b>' + p + '</b><span>' + (i + 1) + '°</span></div>').join('') + '</div>' : '') + '</section>').join('') + '</div>';
};

/* ---------- router ---------- */
const NAV = [['home', 'Home'], ['driver-standings', 'Driver Standings'], ['constructor-standings', 'Constructor Standings'], ['teams', 'Teams'], ['qualifiche', 'Qualifiche mondiale'],
  ['race-results', 'Race Results'], ['statistics', 'Statistics'], ['calendar', 'Calendar'], ['giornale', 'Giornale'], ['regolamento', 'Regolamento']];
$('#nav').innerHTML = NAV.map(n => '<a href="#/' + n[0] + '" data-p="' + n[0] + '">' + n[1] + '</a>').join('');
$('#foot').textContent = S.played ? 'Dati aggiornati dopo il GP ' + S.lastRound + '. Le classifiche si calcolano in automatico dai risultati.' : 'Nessun GP ancora disputato.';
$('#foot').textContent += ' Versione del sito: ' + VERSION + '.';
let first = true;
function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = (NAV.some(n => n[0] === parts[0]) || parts[0] === 'diagnosi') ? parts[0] : 'home';
  $('#app').innerHTML = pages[page](parts[1]);
  document.querySelectorAll('#nav a').forEach(a => {
    if (a.dataset.p === page) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); } else a.removeAttribute('aria-current');
  });
  document.title = (page === 'home' ? 'Apex Drawn - Campionato mondiale' : (page === 'diagnosi' ? 'Diagnosi' : NAV.find(n => n[0] === page)[1]) + ' - Apex Drawn');
  if (!first) { window.scrollTo(0, 0); $('#app').focus({ preventScroll: true }); }
  first = false;
  if (page === 'teams') loadComments();
  if (page === 'diagnosi') runDiag();
}
/* percorso del brano: accetta nomi con spazi, accenti e parentesi; rifiuta solo schemi pericolosi */
function musicSrc() {
  const f = String((D.musica && D.musica.file) || '').trim();
  if (!f || /^(javascript|data|vbscript|file):/i.test(f) || /^http:\/\//i.test(f) || /^\/\//.test(f)) return '';
  return /^https:\/\//i.test(f) || /%[0-9A-Fa-f]{2}/.test(f) ? f : encodeURI(f);
}
function initMusic() {
  const m = D.musica, f = musicSrc();
  if (!f) return;
  const a = document.createElement('audio'); a.id = 'musAudio'; a.loop = true; a.preload = 'none'; a.volume = 0.4; a.hidden = true; a.src = f;
  const b = document.createElement('button'); b.id = 'mus'; b.type = 'button'; b.className = 'mus'; b.setAttribute('aria-pressed', 'false');
  b.title = m.titolo ? 'Sottofondo: ' + m.titolo : 'Musica di sottofondo';
  const set = (on, t) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span>' + t + '</span>'; };
  set(false, 'Musica');
  b.addEventListener('click', () => {
    if (a.paused) a.play().then(() => set(true, 'Musica on')).catch(() => set(false, 'Brano non trovato'));
    else { a.pause(); set(false, 'Musica'); }
  });
  a.addEventListener('error', () => set(false, 'Brano non trovato'));
  document.body.append(a, b); document.body.classList.add('has-music');
}
window.addEventListener('hashchange', render);
render();
initMusic();
window.__APEX_STATE = S;
})();

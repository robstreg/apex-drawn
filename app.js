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
    last = '<section class="panel"><h2 class="h2">' + esc(r.meta.nome) + '</h2>' +
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
  ).join('') + '</div>';
};

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
  return warnBox() + head('Race results') + tabs + meta +
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

pages.regolamento = function () {
  return head('Regolamento') + '<div class="rules">' + D.regolamento.map(s =>
    '<section class="panel"><h3>' + esc(s.titolo) + '</h3>' + s.righe.map(l => '<p>' + esc(l) + '</p>').join('') +
    (s.punti ? '<div class="pts">' + D.punti.map((p, i) => '<div><b>' + p + '</b><span>' + (i + 1) + '°</span></div>').join('') + '</div>' : '') + '</section>').join('') + '</div>';
};

/* ---------- router ---------- */
const NAV = [['home', 'Home'], ['driver-standings', 'Driver Standings'], ['constructor-standings', 'Constructor Standings'], ['teams', 'Teams'], ['qualifiche', 'Qualifiche mondiale'],
  ['race-results', 'Race Results'], ['statistics', 'Statistics'], ['calendar', 'Calendar'], ['regolamento', 'Regolamento']];
$('#nav').innerHTML = NAV.map(n => '<a href="#/' + n[0] + '" data-p="' + n[0] + '">' + n[1] + '</a>').join('');
$('#foot').textContent = S.played ? 'Dati aggiornati dopo il GP ' + S.lastRound + '. Le classifiche si calcolano in automatico dai risultati.' : 'Nessun GP ancora disputato.';
let first = true;
function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = NAV.some(n => n[0] === parts[0]) ? parts[0] : 'home';
  $('#app').innerHTML = pages[page](parts[1]);
  document.querySelectorAll('#nav a').forEach(a => {
    if (a.dataset.p === page) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); } else a.removeAttribute('aria-current');
  });
  document.title = (page === 'home' ? 'Apex Drawn - Campionato mondiale' : NAV.find(n => n[0] === page)[1] + ' - Apex Drawn');
  if (!first) { window.scrollTo(0, 0); $('#app').focus({ preventScroll: true }); }
  first = false;
}
window.addEventListener('hashchange', render);
render();
window.__APEX_STATE = S;
})();

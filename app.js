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

  /* --- classifica dopo ogni GP (per grafico, cronaca, cambi al vertice) --- */
  const emptyCounts = () => Array(D.piloti.length + 2).fill(0);
  const penaltyAt = (nick, k) => (D.penalita || []).filter(x => x.pilota === nick)
    .reduce((a, x) => a + ((x.gp ? x.gp <= rounds[k - 1] : k === played) ? (+x.punti || 0) : 0), 0);
  function tally(per, k, penalty) {
    const p = per.slice(0, k), drop = dropSet(p.map(x => x.pts)), counts = emptyCounts();
    p.forEach(x => { if (x.took && !x.dnf && x.pos) counts[x.pos]++; });
    return { total: p.reduce((a, x, i) => a + (drop.has(i) ? 0 : x.pts), 0) - penalty, counts };
  }
  const hist = rounds.map((n, i) => {
    const k = i + 1;
    const dr = drivers.map(d => { const t = tally(d.per, k, penaltyAt(d.nick, k)); return { nick: d.nick, squadra: d.squadra, total: t.total, counts: t.counts }; });
    dr.sort((a, b) => cmp(a, b, 'nick')); dr.forEach((x, j) => x.rank = j + 1);
    const tm = teams.map(t => {
      const per = t.per.slice(0, k), drop = dropSet(per.map(x => x.pts)), counts = emptyCounts();
      t.mine.forEach(m => tally(m.per, k, 0).counts.forEach((c, q) => counts[q] += c));
      const pen = t.mine.reduce((a, m) => a + penaltyAt(m.nick, k), 0);
      return { id: t.id, counts, total: per.reduce((a, x, q) => a + (drop.has(q) ? 0 : x.pts), 0) - pen };
    });
    tm.sort((a, b) => cmp(a, b, 'id')); tm.forEach((x, j) => x.rank = j + 1);
    return { n, dr, tm };
  });

  /* --- statistiche di ogni pilota --- */
  drivers.forEach(d => {
    const fin = d.per.filter(x => x.took && !x.dnf);
    d.avgPos = fin.length ? fin.reduce((a, x) => a + x.pos, 0) / fin.length : null;
    d.bestPos = fin.length ? Math.min.apply(null, fin.map(x => x.pos)) : null;
    d.dnfs = d.per.filter(x => x.dnf).length;
    d.absent = played - d.starts;
    d.seconds = d.counts[2];
    let gained = 0, bestCb = null;
    rounds.forEach(n => {
      const r = races[n].rows.find(x => x.nick === d.nick);
      if (r && r.gridPos && !r.dnf) { const g = r.gridPos - r.pos; if (g > 0) { gained += g; if (!bestCb || g > bestCb.g) bestCb = { g, n, from: r.gridPos, to: r.pos }; } }
    });
    d.gained = gained; d.bestCb = bestCb;
  });

  /* --- sfida tra compagni di squadra --- */
  teams.forEach(t => {
    t.duel = null;
    if (t.mine.length === 2) {
      const a = t.mine[0], b = t.mine[1]; let aw = 0, bw = 0, ties = 0, both = 0;
      rounds.forEach((n, i) => {
        const x = a.per[i], y = b.per[i]; if (!x.took || !y.took) return; both++;
        const px = x.dnf ? 99 : x.pos, py = y.dnf ? 99 : y.pos;
        if (px < py) aw++; else if (py < px) bw++; else ties++;
      });
      t.duel = { a: a.nick, b: b.nick, aw, bw, ties, both };
    }
  });

  /* --- premi assegnati in automatico --- */
  const awards = [];
  function award(titolo, descr, valFn, fmt, min) {
    const vals = drivers.map(d => [d, valFn(d)]).filter(x => x[1] != null);
    if (!vals.length) return;
    const mx = Math.max.apply(null, vals.map(x => x[1]));
    if (mx < (min == null ? 1 : min)) return;
    const win = vals.filter(x => x[1] === mx).map(x => x[0].nick);
    if (win.length > 3) return;
    awards.push({ titolo, descr, nicks: win, valore: fmt(mx) });
  }
  const plur = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  award('Il capitano', 'Il pilota con più vittorie.', d => d.wins, v => plur(v, 'vittoria', 'vittorie'));
  award('Re delle rimonte', 'Chi ha guadagnato più posizioni rispetto alla griglia di partenza.', d => d.gained, v => '+' + plur(v, 'posizione', 'posizioni'));
  award('Pole di consolazione', 'Più pole position. Con la griglia inversa si parte davanti arrivando ultimi.', d => d.poles, v => plur(v, 'pole', 'pole'));
  award('L\'eterno secondo', 'Chi ha chiuso più volte in seconda posizione.', d => d.seconds, v => plur(v, 'secondo posto', 'secondi posti'));
  award('Il più sfortunato', 'Più ritiri in gara.', d => d.dnfs, v => plur(v, 'ritiro', 'ritiri'));
  award('Specialista del giro veloce', 'Più giri veloci in gara.', d => d.fls, v => plur(v, 'giro veloce', 'giri veloci'));
  award('Il fantasma', 'Più Gran Premi saltati.', d => d.absent, v => plur(v, 'assenza', 'assenze'));
  if (played >= 2) {
    const fin = drivers.filter(d => d.per.filter(x => x.took && !x.dnf).length >= 2);
    if (fin.length) {
      const mn = Math.min.apply(null, fin.map(d => d.avgPos));
      awards.push({ titolo: 'Il metronomo', descr: 'La miglior posizione media di arrivo (minimo due gare concluse).',
        nicks: fin.filter(d => d.avgPos === mn).map(d => d.nick), valore: 'posizione media ' + mn.toFixed(1).replace('.', ',') });
    }
  }

  /* --- corsa al titolo --- */
  const remaining = Math.max(0, TOTAL - played);
  const potential = (per, perRaceMax, penalty) => per.map(x => x.pts).concat(Array(remaining).fill(perRaceMax)).sort((a, b) => b - a)
    .slice(0, D.validi).reduce((a, b) => a + b, 0) - penalty;
  const raceFor = (list, perRaceMax, idOf) => {
    if (!played) return null;
    const lead = list[0];
    const rows = list.map(x => { const max = potential(x.per, perRaceMax, x.penalty); return { id: idOf(x), total: x.total, gap: lead.total - x.total, max, alive: x === lead || max >= lead.total }; });
    const others = rows.slice(1);
    return { remaining, rows, decided: remaining === 0 || others.every(r => !r.alive) };
  };
  const title = played ? { drivers: raceFor(drivers, D.punti[0], x => x.nick), teams: raceFor(teams, D.punti[0] + (D.punti[1] || 0), x => x.id) } : null;

  /* --- pronostici --- */
  const PP = Object.assign({ vincitore: 5, secondo: 3, terzo: 3, nelPodio: 1, podioPerfetto: 5 }, D.pronosticiPunti || {});
  const pron = { PP, rounds: [], byRound: {}, ranking: [] };
  const predTotals = {};
  Object.keys(D.pronostici || {}).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b).forEach(n => {
    const src = D.pronostici[n] || {}, race = races[n], top = race ? race.rows.filter(r => !r.dnf).slice(0, 3).map(r => r.nick) : null;
    const entries = Object.keys(src).map(name => {
      const pick = (src[name] || []).slice(0, 3);
      if (pick.length !== 3 || new Set(pick).size !== 3) warns.push('Pronostici GP ' + n + ': il pronostico di "' + name + '" deve avere tre piloti diversi.');
      pick.forEach(k => { if (!drv(k)) warns.push('Pronostici GP ' + n + ': "' + k + '" (di ' + name + ') non esiste nell\'elenco piloti.'); });
      let score = null;
      if (top) {
        let p = 0; const det = pick.map((g, i) => g === top[i] ? 'exact' : (g && top.includes(g) ? 'podio' : 'no'));
        det.forEach((x, i) => { p += x === 'exact' ? [PP.vincitore, PP.secondo, PP.terzo][i] : x === 'podio' ? PP.nelPodio : 0; });
        const perfect = det.length === 3 && det.every(x => x === 'exact'); if (perfect) p += PP.podioPerfetto;
        score = { pts: p, det, perfect };
        const t = predTotals[name] || (predTotals[name] = { name, total: 0, gp: 0, wins: 0, perfect: 0 });
        t.total += p; t.gp++; if (det[0] === 'exact') t.wins++; if (perfect) t.perfect++;
      } else if (!predTotals[name]) predTotals[name] = { name, total: 0, gp: 0, wins: 0, perfect: 0 };
      return { name, pick, score };
    });
    entries.sort((a, b) => (b.score ? b.score.pts : 0) - (a.score ? a.score.pts : 0) || a.name.localeCompare(b.name));
    pron.rounds.push(n); pron.byRound[n] = { n, top, open: !race, entries };
  });
  pron.ranking = Object.keys(predTotals).map(k => predTotals[k])
    .sort((a, b) => b.total - a.total || b.perfect - a.perfect || b.wins - a.wins || a.name.localeCompare(b.name));
  pron.ranking.forEach((x, i) => x.rank = i + 1);
  if (pron.ranking.length && pron.ranking[0].gp > 0) {
    const mx = pron.ranking[0].total;
    if (mx > 0) awards.push({ titolo: 'Il mago dei pronostici', descr: 'Chi ha totalizzato più punti nei pronostici.',
      nicks: pron.ranking.filter(x => x.total === mx).map(x => x.name), valore: plur(mx, 'punto', 'punti') });
  }

  return { warns, rounds, races, played, lastRound, nextRound, nextGrid, drivers, teams, hist, awards, title, remaining, pron };
}
const S = compute();

/* ---------- componenti ---------- */
const VERSION = '2026-11-06';
const EXTS = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG', 'webp'];
function cands(base, explicit) { return explicit ? [explicit] : EXTS.map(e => base + '.' + e); }
function gpFoto(n) { const c = D.calendario.find(x => x.n === n) || {}; return cands('foto/gp-' + n, c.foto); }
function imgTag(list, alt, kind) {
  return '<img src="' + esc(list[0]) + '" data-c="' + esc(JSON.stringify(list)) + '" data-i="0" data-k="' + kind + '" alt="' + esc(alt) + '"' +
    (kind === 'banner' ? ' loading="lazy"' : '') + ' onload="__ld(this)" onerror="__try(this)">';
}
function banner(n, below) {
  const l = gpFoto(n), img = imgTag(l, 'Foto del GP ' + n, 'banner');
  return '<figure class="banner' + (below ? ' below' : '') + '">' + (below ? '<a href="' + esc(l[0]) + '" target="_blank" rel="noopener" aria-label="Apri la foto a grandezza intera">' + img + '</a>' : img) + '</figure>';
}
window.__ld = img => { const a = img.parentNode; if (a && a.tagName === 'A') a.href = img.src; };
window.__try = img => {
  const l = JSON.parse(img.dataset.c), i = +img.dataset.i + 1;
  if (i < l.length) { img.dataset.i = i; img.src = l[i]; return; }
  if (img.dataset.k === 'banner') { img.closest('figure').remove(); return; }
  if (img.dataset.k === 'avatar') { img.remove(); return; }
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
function nameHtml(name) { return drv(name) ? '<a class="dl" href="#/driver/' + encodeURIComponent(name) + '">' + esc(name) + '</a>' : esc(name); }
function row(pos, c, name, sub, val, i) {
  return '<div class="tr" style="--c:' + c + ';--i:' + (i || 0) + '"><span class="pos">' + pos + '</span>' +
    '<span class="nm">' + nameHtml(name) + '</span><span class="sub">' + esc(sub) + '</span><span class="val">' + (val == null ? '' : val) + '</span></div>';
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

  return '<div class="home">' + warnBox() + '<div class="hero">' + hero + tower + '</div>' + (S.played ? '<div class="sec">' + titleCard() + '</div>' : '') + '<div class="grid3 sec">' + last + cons + grid + '</div></div>';
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
    '<td><span class="who">' + nameHtml(d.nick) + '</span><span class="team">' + esc(teamNameOf(d.nick)) + '</span></td>' +
    perCells(d.per, d.drop) + '<td class="tot">' + d.total + '</td></tr>').join('');
  return warnBox() + head('Classifica piloti', 'Classifica dei ' + D.piloti.length + ' piloti. Contano i migliori ' + D.validi + ' risultati.') +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Pilota</th>' + perHeads() + '<th class="tot">Punti</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="note">I risultati scartati sono barrati. Il trattino indica un GP senza partecipazione.</p>';
};

pages['constructor-standings'] = function () {
  const body = S.teams.map(t => '<tr style="--c:' + t.def.colore + '"><td>' + t.rank + '</td>' +
    '<td><span class="who">' + esc(t.def.nome) + '</span><span class="team">' + esc(t.mine.map(m => m.nick).join(' e ')) + '</span></td>' +
    perCells(t.per.map(x => Object.assign({ took: true }, x)), t.drop) + '<td class="tot">' + t.total + '</td></tr>').join('');
  return warnBox() + head('Classifica costruttori', 'Classifica delle ' + D.squadre.length + ' scuderie. Ogni GP vale la somma dei punti dei due piloti, contano i migliori ' + D.validi + '.') +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Scuderia</th>' + perHeads() + '<th class="tot">Punti</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="note">I punteggi scartati sono barrati.</p>';
};

pages.teams = function () {
  const order = S.teams;
  return warnBox() + head('Teams', 'Le quattro scuderie e i loro piloti.') + '<div class="grid2">' + order.map(t =>
    '<article class="tcard" style="--c:' + t.def.colore + '"><div class="thead">' + logo(t.def, 72) +
    '<div><h3>' + esc(t.def.nome) + '</h3><p>' + t.rank + '° nei costruttori, ' + t.total + ' punti</p></div></div>' +
    '<div class="tower">' + t.mine.slice().sort((a, b) => a.rank - b.rank).map((d, i) => row(d.rank, t.def.colore, d.nick, d.rank + '° nei piloti', pts(d.total), i)).join('') + '</div>' +
    duelHtml(t) + '<div class="tstats"><div><b>' + t.wins + '</b><span>Vittorie</span></div><div><b>' + t.podiums + '</b><span>Podi</span></div><div><b>' + t.poles + '</b><span>Pole</span></div></div></article>'
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

/* ---------- grafico dell'andamento ---------- */
const SURF = '#161922', GRIDC = '#2b303c', INK = '#eef0f5', MUTC = '#8e97aa', SHAPES = ['circle', 'square', 'triangle', 'diamond'];
function markSvg(shape, cx, cy, fill, r) {
  r = r || 5; const st = ' fill="' + fill + '" stroke="' + SURF + '" stroke-width="2" stroke-linejoin="round"';
  if (shape === 'square') return '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '" rx="1"' + st + '/>';
  if (shape === 'triangle') return '<path d="M' + cx + ' ' + (cy - r - 1) + ' L' + (+cx + r + 1) + ' ' + (+cy + r) + ' L' + (cx - r - 1) + ' ' + (+cy + r) + ' Z"' + st + '/>';
  if (shape === 'diamond') return '<path d="M' + cx + ' ' + (cy - r - 2) + ' L' + (+cx + r + 2) + ' ' + cy + ' L' + cx + ' ' + (+cy + r + 2) + ' L' + (cx - r - 2) + ' ' + cy + ' Z"' + st + '/>';
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + st + '/>';
}
function chartSeries(mode) {
  const ti = id => Math.max(0, D.squadre.findIndex(t => t.id === id));
  if (mode === 'tm') return D.squadre.map(t => ({ id: t.id, name: t.nome, color: t.colore, dash: false, shape: SHAPES[ti(t.id) % 4],
    vals: S.hist.map(h => h.tm.find(x => x.id === t.id).total) }));
  const seen = {};
  return D.piloti.map(p => { seen[p.squadra] = (seen[p.squadra] || 0) + 1; const t = team(p.squadra);
    return { id: p.nick, name: p.nick, color: t.colore, dash: seen[p.squadra] > 1, shape: SHAPES[ti(p.squadra) % 4],
      vals: S.hist.map(h => h.dr.find(x => x.nick === p.nick).total) }; });
}
function chartBox() {
  if (!S.played) return '<section class="sec"><h2 class="h2">Andamento del campionato</h2><div class="panel"><p class="empty">Il grafico compare dopo il primo GP.</p></div></section>';
  return '<section class="sec" aria-label="Andamento del campionato"><h2 class="h2">Andamento del campionato</h2><div class="panel chartbox">' +
    '<div class="ctabs"><button type="button" class="ctab" data-m="dr" aria-pressed="true">Piloti</button><button type="button" class="ctab" data-m="tm" aria-pressed="false">Squadre</button></div>' +
    '<div class="cwrap" id="pchart"></div><ul class="legend" id="plegend"></ul>' +
    '<details class="tview"><summary>Vedi i dati in tabella</summary><div class="tw" id="ptable"></div></details></div></section>';
}
function initChart() {
  const wrap = $('#pchart'); if (!wrap) return;
  const st = { mode: 'dr', hidden: new Set(), focus: null, idx: null, geo: null };
  const n = S.hist.length;
  const tip = document.createElement('div'); tip.className = 'ctip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true');
  function legend() {
    const keySvg = s => '<svg width="38" height="14" viewBox="0 0 38 14" aria-hidden="true"><line x1="1" y1="7" x2="37" y2="7" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="7 5"' : '') + '/>' + markSvg(s.shape, 19, 7, s.color, 4) + '</svg>';
    $('#plegend').innerHTML = chartSeries(st.mode).map(s => '<li><button type="button" class="lg' + (st.hidden.has(s.id) ? ' off' : '') + '" data-id="' + esc(s.id) + '" aria-pressed="' + (!st.hidden.has(s.id)) + '">' + keySvg(s) + '<span>' + esc(s.name) + '</span></button></li>').join('');
  }
  function table() {
    const ss = chartSeries(st.mode);
    $('#ptable').innerHTML = '<table><thead><tr><th>GP</th>' + ss.map(s => '<th>' + esc(s.name) + '</th>').join('') + '</tr></thead><tbody>' +
      S.hist.map((h, i) => '<tr><td>' + h.n + '</td>' + ss.map(s => '<td>' + s.vals[i] + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function draw() {
    if (!wrap.isConnected) return;
    const W = Math.max(280, wrap.clientWidth), H = Math.round(Math.min(420, Math.max(250, W * 0.5)));
    const all = chartSeries(st.mode), vis = all.filter(s => !st.hidden.has(s.id));
    const labelsOn = st.mode === 'tm' && W >= 520;
    const ML = 34, MR = labelsOn ? 118 : 20, MT = 14, MB = 28, pw = W - ML - MR, ph = H - MT - MB;
    const top = Math.max(10, Math.max.apply(null, all.map(s => Math.max.apply(null, s.vals))));
    const step = [5, 10, 20, 25, 50, 100, 200].find(q => top / q <= 5) || 200, ymax = Math.ceil(top / step) * step;
    const X = i => ML + (n === 1 ? pw / 2 : i * pw / (n - 1)), Y = v => MT + ph - v / ymax * ph;
    st.geo = { W, H, ML, MR, MT, ph, X, Y, ymax };
    let g = '';
    for (let v = 0; v <= ymax; v += step) g += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + GRIDC + '" stroke-width="1"/><text x="' + (ML - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" fill="' + MUTC + '" font-size="12">' + v + '</text>';
    const every = n > 8 && W < 560 ? 2 : 1;
    S.hist.forEach((h, i) => { if (i % every === 0 || i === n - 1) g += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" fill="' + MUTC + '" font-size="12">' + (W >= 520 ? 'GP ' : '') + h.n + '</text>'; });
    const ends = [];
    vis.forEach(s => {
      const dim = st.focus && st.focus !== s.id ? ' opacity=".2"' : '';
      const pts = s.vals.map((v, i) => [X(i), Y(v)]);
      if (n > 1) g += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="7 5"' : '') + dim + '/>';
      const showAll = st.mode === 'tm' || st.focus === s.id;
      g += '<g' + dim + '>' + pts.map((p, i) => (showAll || i === n - 1) ? markSvg(s.shape, p[0].toFixed(1), p[1].toFixed(1), s.color, 5) : '').join('') + '</g>';
      ends.push({ s, x: pts[n - 1][0], y: pts[n - 1][1], ly: pts[n - 1][1] });
    });
    if (labelsOn) {
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 15) ends[i].ly = ends[i - 1].ly + 15;
      ends.forEach(e => {
        g += (Math.abs(e.ly - e.y) > 1 ? '<line x1="' + (e.x + 8) + '" y1="' + e.y + '" x2="' + (e.x + 14) + '" y2="' + e.ly + '" stroke="' + MUTC + '" stroke-width="1"/>' : '') +
          '<text x="' + (e.x + 17) + '" y="' + (e.ly + 4) + '" fill="' + INK + '" font-size="13" font-weight="600">' + esc(e.s.name) + '</text>';
      });
    }
    wrap.innerHTML = '<svg id="psvg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" tabindex="0" aria-label="Grafico dell\'andamento dei punti. Usa le frecce per scorrere i Gran Premi, oppure apri la tabella sotto.">' + g + '<g id="pxh"></g></svg>';
    wrap.appendChild(tip);
    const svg = $('#psvg');
    const at = ev => { const r = svg.getBoundingClientRect(), px = ev.clientX - r.left; let b = 0; for (let i = 1; i < n; i++) if (Math.abs(X(i) - px) < Math.abs(X(b) - px)) b = i; show(b); };
    svg.addEventListener('pointermove', at); svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hide(); });
    svg.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { show(Math.min(n - 1, (st.idx == null ? -1 : st.idx) + 1)); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { show(Math.max(0, (st.idx == null ? n : st.idx) - 1)); ev.preventDefault(); }
      else if (ev.key === 'Escape') hide();
    });
    svg.addEventListener('blur', hide);
    if (st.idx != null) show(st.idx);
  }
  function hide() { st.idx = null; const x = $('#pxh'); if (x) x.innerHTML = ''; tip.hidden = true; }
  function show(i) {
    st.idx = i; const G = st.geo, vis = chartSeries(st.mode).filter(s => !st.hidden.has(s.id)), x = G.X(i);
    $('#pxh').innerHTML = '<line x1="' + x + '" x2="' + x + '" y1="' + G.MT + '" y2="' + (G.MT + G.ph) + '" stroke="' + MUTC + '" stroke-width="1"/>' +
      vis.map(s => markSvg(s.shape, x, G.Y(s.vals[i]), s.color, 5)).join('');
    const h = S.hist[i], m = S.races[h.n].meta;
    tip.textContent = '';
    const hd = document.createElement('div'); hd.className = 'th'; hd.textContent = (m.nome || 'GP ' + h.n) + (m.circuito ? ', ' + m.circuito : ''); tip.appendChild(hd);
    vis.slice().sort((a, b) => b.vals[i] - a.vals[i]).forEach(s => {
      const r = document.createElement('div'); r.className = 'tr2';
      const k = document.createElement('span'); k.className = 'tk'; k.style.borderTopColor = s.color; k.style.borderTopStyle = s.dash ? 'dashed' : 'solid';
      const v = document.createElement('b'); v.textContent = s.vals[i];
      const nm = document.createElement('span'); nm.textContent = s.name;
      r.append(k, v, nm); tip.appendChild(r);
    });
    tip.hidden = false;
    const tw = tip.offsetWidth; tip.style.top = (G.MT + 4) + 'px';
    tip.style.left = (x + 14 + tw > G.W ? Math.max(4, x - tw - 14) : x + 14) + 'px';
  }
  legend(); table(); draw();
  document.querySelectorAll('.ctab').forEach(b => b.addEventListener('click', () => {
    st.mode = b.dataset.m; st.hidden.clear(); st.focus = null; st.idx = null;
    document.querySelectorAll('.ctab').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    legend(); table(); draw();
  }));
  const lg = $('#plegend');
  lg.addEventListener('click', ev => { const b = ev.target.closest('.lg'); if (!b) return; const id = b.dataset.id; st.hidden.has(id) ? st.hidden.delete(id) : st.hidden.add(id); legend(); draw(); });
  const foc = (ev, on) => { const b = ev.target.closest('.lg'); if (!b) return; st.focus = on ? b.dataset.id : null; draw(); };
  lg.addEventListener('mouseover', ev => foc(ev, true)); lg.addEventListener('mouseout', ev => foc(ev, false));
  if (typeof ResizeObserver !== 'undefined') { let w0 = wrap.clientWidth; new ResizeObserver(() => { if (wrap.clientWidth !== w0) { w0 = wrap.clientWidth; draw(); } }).observe(wrap); }
}

/* ---------- premi, cronaca, corsa al titolo, sfida in famiglia ---------- */
function awardsHtml() {
  if (!S.awards.length) return '';
  return '<h2 class="h2 sec">Premi</h2><div class="awards">' + S.awards.map(a => {
    const c = drv(a.nicks[0]) ? colorOf(a.nicks[0]) : 'var(--line)';
    return '<article class="award" style="--c:' + c + '"><h3>' + esc(a.titolo) + '</h3><p class="awin">' + a.nicks.map(nameHtml).join(' e ') + '</p><p class="aval">' + esc(a.valore) + '</p><p class="adesc">' + esc(a.descr) + '</p></article>';
  }).join('') + '</div>';
}
function recap(n) {
  const r = S.races[n], rows = r.rows, fin = rows.filter(x => !x.dnf), w = fin[0], out = [];
  if (!w) return out;
  const idx = S.rounds.indexOf(n), join = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0];
  const sec = x => x.toFixed(3).replace('.', ',');
  const verb = ['vince', 'si prende', 'conquista'][n % 3];
  let p1 = w.nick + ' (' + teamNameOf(w.nick) + ') ' + verb + ' il ' + r.meta.nome + (r.meta.circuito ? ' a ' + r.meta.circuito : '') + (w.time ? ' in ' + w.time : '') + '.';
  if (fin.length >= 2 && fin[1].gap != null) p1 += ' Secondo ' + fin[1].nick + ', a ' + sec(fin[1].gap) + ' secondi' + (fin[2] ? ', terzo ' + fin[2].nick : '') + '.';
  else if (fin.length >= 2) p1 += ' Secondo ' + fin[1].nick + (fin[2] ? ', terzo ' + fin[2].nick : '') + '.';
  out.push(p1);
  const b = [];
  const pr = r.grid && r.pole && rows.find(x => x.nick === r.pole);
  if (pr) b.push(pr.pos === 1 ? r.pole + ' fa tutto da pole position.' : pr.dnf ? r.pole + ', partito dalla pole, chiude con un ritiro.' : r.pole + ' partiva dalla pole position e chiude ' + pr.pos + '°.');
  let cb = null; fin.forEach(x => { if (x.gridPos && x.gridPos - x.pos >= 2 && (!cb || x.gridPos - x.pos > cb.gridPos - cb.pos)) cb = x; });
  if (cb) b.push(cb.nick + ' è il più in rimonta: partito ' + cb.gridPos + '°, arriva ' + cb.pos + '°.');
  const dn = rows.filter(x => x.dnf).map(x => x.nick); if (dn.length) b.push((dn.length > 1 ? 'Ritirati: ' : 'Ritirato: ') + join(dn) + '.');
  const ab = D.piloti.map(p => p.nick).filter(k => !rows.some(x => x.nick === k)); if (ab.length) b.push((ab.length > 1 ? 'Assenti: ' : 'Assente: ') + join(ab) + '.');
  if (r.fl && r.fl.pilota) b.push('Il giro veloce è di ' + r.fl.pilota + (r.fl.tempo ? ' (' + r.fl.tempo + ')' : '') + '.');
  if (b.length) out.push(b.join(' '));
  const h = S.hist[idx], pv = idx > 0 ? S.hist[idx - 1] : null, c = [];
  c.push('Nel mondiale piloti guida ' + h.dr[0].nick + ' con ' + h.dr[0].total + ' punti' + (h.dr[1] ? ', ' + (h.dr[0].total - h.dr[1].total) + ' su ' + h.dr[1].nick : '') + '.');
  if (pv && pv.dr[0].nick !== h.dr[0].nick) c.push('Cambio al vertice: ' + h.dr[0].nick + ' supera ' + pv.dr[0].nick + '.');
  const tn = id => team(id).nome;
  c.push('Tra i costruttori comanda ' + tn(h.tm[0].id) + ' con ' + h.tm[0].total + ' punti' + (pv && pv.tm[0].id !== h.tm[0].id ? ', superando ' + tn(pv.tm[0].id) : '') + '.');
  out.push(c.join(' '));
  return out;
}
function cronacaHtml(n) {
  const t = recap(n); if (!t.length) return '';
  return '<section class="cronaca"><h2 class="h2">La cronaca</h2>' + t.map(p => '<p>' + esc(p) + '</p>').join('') + '</section>';
}
function titleCard() {
  const T = S.title; if (!T) return '';
  const rem = S.remaining, D1 = T.drivers, T1 = T.teams, lead = D1.rows[0];
  const nAl = D1.rows.filter(r => r.alive).length, nAlT = T1.rows.filter(r => r.alive).length;
  const head1 = rem === 0 ? 'Campionato concluso: il campione è ' + lead.id + '.' :
    D1.decided ? lead.id + ' è matematicamente campione del mondo.' : 'Mancano ' + rem + ' GP. Possono ancora vincere il titolo ' + nAl + ' piloti su ' + D1.rows.length + '.';
  const head2 = rem === 0 ? 'Costruttori: ' + team(T1.rows[0].id).nome + ' campione.' : T1.decided ? team(T1.rows[0].id).nome + ' ha già vinto il titolo costruttori.' :
    'Titolo costruttori: ancora in corsa ' + nAlT + ' squadre su ' + T1.rows.length + '.';
  return '<section class="panel titlerace"><h2 class="h2">Corsa al titolo</h2><p class="muted" style="margin:-6px 0 12px">' + esc(head1) + '</p><div class="tower">' +
    D1.rows.map((x, i) => '<div class="' + (x.alive ? '' : 'out') + '">' + row(i + 1, colorOf(x.id), x.id, i === 0 ? 'in testa' : (x.alive ? x.gap + ' dal leader, max ' + x.max : 'fuori dalla lotta, max ' + x.max), pts(x.total), i) + '</div>').join('') +
    '</div><p class="note">' + esc(head2) + ' Il massimo possibile tiene conto degli scarti (migliori ' + D.validi + ' risultati), salvo penalità future.</p></section>';
}
function duelHtml(t) {
  const d = t.duel; if (!d || !d.both) return '';
  return '<div class="duel"><div class="dh"><b>Sfida in famiglia</b><small>' + d.both + ' GP con entrambi in gara</small></div>' +
    '<div class="dline"><span class="dnm">' + nameHtml(d.a) + '</span><span class="ds">' + d.aw + ' - ' + d.bw + '</span><span class="dnm r">' + nameHtml(d.b) + '</span></div>' +
    '<div class="dbar" aria-hidden="true"><i style="flex:' + d.aw + '"></i>' + (d.ties ? '<i class="tie" style="flex:' + d.ties + '"></i>' : '') + '<i class="b" style="flex:' + d.bw + '"></i></div>' +
    '<p class="dnote">Conta chi arriva davanti nelle gare in cui entrambi sono al via.' + (d.ties ? ' Pari: ' + d.ties + '.' : '') + '</p></div>';
}

/* ---------- scheda pilota ---------- */
pages.driver = function (sel) {
  const nick = decodeURIComponent(sel || ''), d = S.drivers.find(x => x.nick === nick);
  if (!d) return head('Pilota non trovato') + '<p class="empty">Non trovo questo pilota. <a href="#/driver-standings">Torna alla classifica</a>.</p>';
  const t = team(d.squadra), c = t.colore, tm = S.teams.find(x => x.id === d.squadra);
  const av = imgTag(cands('piloti/' + nick.toLowerCase()), nick, 'avatar');
  const stat = (k, v) => '<div class="rec" style="--c:' + c + '"><span>' + k + '</span><b>' + v + '</b></div>';
  const dec = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const hero = '<div class="dhero" style="--c:' + c + '"><div class="dav">' + av + '</div><div><h1 class="h1" style="margin:0">' + esc(nick) + '</h1>' +
    '<p class="lede" style="margin:4px 0 0">' + logo(t, 22) + ' <a href="#/teams">' + esc(t.nome) + '</a></p>' +
    '<p class="dpos">' + (S.played ? d.rank + '° nel mondiale, ' + d.total + ' punti' : 'Nessun GP ancora disputato') + '</p></div></div>';
  const stats = '<div class="recs">' + stat('Vittorie', d.wins) + stat('Podi', d.podiums) + stat('Pole', d.poles) + stat('Giri veloci', d.fls) +
    stat('GP disputati', d.starts) + stat('Posizione media', d.avgPos != null ? dec(d.avgPos) + '°' : '-') +
    stat('Miglior arrivo', d.bestPos ? d.bestPos + '°' : '-') + stat('Miglior rimonta', d.bestCb ? '+' + d.bestCb.g : '-') +
    stat('Ritiri', d.dnfs) + stat('Assenze', d.absent) + '</div>';
  const body = S.rounds.map((n, i) => {
    const r = S.races[n], x = r.rows.find(q => q.nick === nick), pr = d.per[i];
    if (!x) return '<tr><td><a href="#/race-results/' + n + '">GP ' + n + '</a></td><td>-</td><td>Assente</td><td class="tot">0</td><td>-</td></tr>';
    const ch = x.gridPos ? x.gridPos - x.pos : null;
    const chT = ch == null || x.dnf ? '-' : ch > 0 ? '<span class="up">+' + ch + '</span>' : ch < 0 ? '<span class="dn">' + ch + '</span>' : '=';
    return '<tr style="--c:' + c + '"><td><a href="#/race-results/' + n + '">GP ' + n + '</a></td><td>' + (x.gridPos || '-') + '</td><td>' + (x.dnf ? 'DNF' : x.pos + '°') + '</td><td class="tot' + (d.drop.has(i) ? ' drop' : '') + '">' + x.pts + '</td><td>' + chT + '</td></tr>';
  }).join('');
  const form = S.played ? '<div class="form" aria-label="Forma recente">' + d.per.slice(-5).map(p => '<span class="' + (!p.took ? 'f0' : p.dnf ? 'fd' : p.pos <= 3 ? 'fp' : p.pts > 0 ? 'fs' : 'f0') + '" title="GP ' + p.n + '">' + (!p.took ? 'A' : p.dnf ? 'R' : p.pos) + '</span>').join('') + '</div>' : '';
  const mate = tm && tm.duel && tm.duel.both && (tm.duel.a === nick || tm.duel.b === nick) ?
    '<p class="note">Sfida in famiglia con ' + nameHtml(tm.duel.a === nick ? tm.duel.b : tm.duel.a) + ': ' + (tm.duel.a === nick ? tm.duel.aw + ' a ' + tm.duel.bw : tm.duel.bw + ' a ' + tm.duel.aw) + ' su ' + tm.duel.both + ' GP.</p>' : '';
  const mine = S.awards.filter(a => a.nicks.includes(nick)).map(a => '<span class="chip">' + esc(a.titolo) + '</span>').join(' ');
  return warnBox() + hero + (mine ? '<p class="chips">' + mine + '</p>' : '') + stats + form +
    (S.played ? '<h2 class="h2 sec">GP per GP</h2><div class="tw"><table><thead><tr><th>GP</th><th>Griglia</th><th>Arrivo</th><th class="tot">Punti</th><th>+/-</th></tr></thead><tbody>' + body + '</tbody></table></div><p class="note">I punti barrati sono i risultati scartati.</p>' : '') + mate +
    '<p class="note"><a href="#/driver-standings">Torna alla classifica piloti</a></p>';
};

/* ---------- pronostici ---------- */
pages.pronostici = function (sel) {
  const P = S.pron, PP = P.PP;
  const rules = '<section class="panel"><h2 class="h2">Come si gioca</h2><p class="muted" style="margin:0 0 10px">Prima del GP ognuno indica i tre piloti che pensa saliranno sul podio, in ordine.</p><div class="pts">' +
    [['Vincitore esatto', PP.vincitore], ['Secondo esatto', PP.secondo], ['Terzo esatto', PP.terzo], ['Pilota nel podio ma in altra posizione', PP.nelPodio], ['Bonus podio perfetto', PP.podioPerfetto]].map(x => '<div><b>+' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div></section>';
    if (!P.rounds.length) return warnBox() + head('Pronostici') + '<section class="panel soon"><h2 class="h2">Stiamo lavorando per voi</h2><p class="muted">La sezione pronostici sta per arrivare. Restate sintonizzati!</p></section>';
  const rank = '<section class="sec"><h2 class="h2">Classifica pronostici</h2><div class="tw"><table><thead><tr><th>Pos</th><th>Nome</th><th>GP</th><th>Vincitori</th><th>Podi perfetti</th><th class="tot">Punti</th></tr></thead><tbody>' +
    P.ranking.map(x => '<tr><td>' + x.rank + '</td><td><span class="who">' + (drv(x.name) ? nameHtml(x.name) : esc(x.name)) + '</span></td><td>' + x.gp + '</td><td>' + x.wins + '</td><td>' + x.perfect + '</td><td class="tot">' + x.total + '</td></tr>').join('') + '</tbody></table></div></section>';
  let n = +sel; if (!P.byRound[n]) n = P.rounds[P.rounds.length - 1];
  const tabs = '<nav class="tabs" aria-label="Gran Premi">' + P.rounds.map(k => '<a href="#/pronostici/' + k + '"' + (k === n ? ' aria-current="true"' : '') + '>GP ' + k + '</a>').join('') + '</nav>';
  const R = P.byRound[n], lab = { exact: 'Esatto', podio: 'Nel podio', no: 'Fuori' };
  const real = R.top ? '<p class="muted">Podio reale: ' + R.top.map((k, i) => (i + 1) + '° ' + esc(k)).join(', ') + '</p>' : '<p class="muted">GP non ancora disputato: i pronostici sono scritti, i punti arrivano dopo la gara.</p>';
  const cards = R.entries.map(e => '<article class="pcard"><header><b>' + esc(e.name) + '</b><span class="ppt">' + (e.score ? '+' + e.score.pts : '...') + '</span></header><ol>' +
    e.pick.map((k, i) => '<li class="' + (e.score ? e.score.det[i] : '') + '"><span>' + (i + 1) + '°</span> ' + esc(k) + (e.score ? '<em>' + lab[e.score.det[i]] + '</em>' : '') + '</li>').join('') + '</ol>' +
    (e.score && e.score.perfect ? '<p class="perf">Podio perfetto!</p>' : '') + '</article>').join('');
  return warnBox() + head('Pronostici', 'Indovina il podio di ogni GP e scala la classifica dei pronostici.') + rank + '<h2 class="h2 sec">Pronostici GP ' + n + '</h2>' + tabs + real + '<div class="pgrid">' + cards + '</div>' + rules;
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
    return '<tr style="--c:' + t.colore + '"><td>' + (i + 1) + '</td><td><span class="who">' + nameHtml(e[0]) + '</span></td><td>' + esc(e[1] || '-') + '</td>' +
      '<td class="tm"><span class="tmw">' + logo(t, 28) + esc(t.nome) + '</span></td><td class="tm"><span class="who">' + (mate ? nameHtml(mate.nick) : '-') + '</span></td></tr>';
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
  if (!n) return head('Gare') + tabs + '<p class="empty">Nessun GP disputato per ora.</p>';
  const r = S.races[n];
  const hasGrid = !!r.grid;
  const body = r.rows.map(x => {
    const ch = x.gridPos ? x.gridPos - x.pos : null;
    const chT = ch == null || x.dnf ? '-' : ch > 0 ? '<span class="up">+' + ch + '</span>' : ch < 0 ? '<span class="dn">' + ch + '</span>' : '=';
    const time = x.dnf ? 'DNF' : (x.pos === 1 ? esc(x.time) : esc(x.time));
    return '<tr style="--c:' + colorOf(x.nick) + '"><td>' + x.pos + '</td><td><span class="who">' + nameHtml(x.nick) + '</span><span class="team">' + esc(teamNameOf(x.nick)) + '</span></td>' +
      '<td>' + time + '</td><td class="tot">' + x.pts + '</td>' + (hasGrid ? '<td class="gap">' + (x.gridPos || '-') + '</td><td>' + chT + '</td>' : '') + '</tr>';
  }).join('');
  const meta = '<div class="meta"><div><span>Circuito</span><b>' + esc(r.meta.circuito || 'Da definire') + '</b></div>' +
    '<div><span>Data</span><b>' + esc(fmtDate(r.meta.data)) + '</b></div>' +
    '<div><span>Pole position</span><b>' + (r.pole ? esc(r.pole) : '-') + '</b></div>' +
    '<div><span>Giro veloce</span><b>' + (r.fl && r.fl.pilota ? esc(r.fl.pilota) + (r.fl.tempo ? ' ' + esc(r.fl.tempo) : '') : '-') + '</b></div></div>';
  return warnBox() + head('Gare') + tabs + meta + cronacaHtml(n) +
    '<div class="tw"><table><thead><tr><th>Pos</th><th>Pilota</th><th>Tempo</th><th class="tot">Punti</th>' + (hasGrid ? '<th>Griglia</th><th>+/-</th>' : '') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    (hasGrid ? '<p class="note">+/- è il numero di posizioni guadagnate (+) o perse (-) rispetto alla griglia di partenza.</p>' : '') +
    banner(n, true);
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
  return warnBox() + head('Statistiche', 'Dati calcolati sui ' + S.played + ' GP disputati.') +
    '<div class="grid2">' + bars('Vittorie', 'wins') + bars('Podi', 'podiums') + bars('Pole position', 'poles') + bars('Giri veloci', 'fls') + '</div>' +
    '<h2 class="h2 sec">Record</h2>' + recs + chartBox() + awardsHtml();
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
  return warnBox() + head('Calendario', TOTAL + ' Gran Premi. Il nome di un GP disputato apre il risultato.') + '<div class="cal">' + items.join('') + '</div>' + grid;
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

  try { const ix = await (await fetch('index.html', { cache: 'no-store' })).text();
    if (/IL-TUO-SITO/.test(ix)) add('info', 'Anteprima WhatsApp', 'In index.html c\'e\' ancora IL-TUO-SITO: sostituiscilo con l\'indirizzo vero del sito (es. nomeutente.github.io/apex-drawn) nelle due righe og:image e og:url, altrimenti il link non mostrera\' l\'immagine in anteprima.');
    else add('ok', 'Anteprima WhatsApp', 'Indirizzo del sito impostato in index.html.'); } catch (e) {}
  if (D.pronostici && Object.keys(D.pronostici).length) add(S.warns.some(w => /^Pronostici/.test(w)) ? 'bad' : 'ok', 'Pronostici', S.pron.rounds.length + ' GP con pronostici, ' + S.pron.ranking.length + ' partecipanti.');
  else add('info', 'Pronostici', D.pronostici === undefined ? 'Nel data.js manca il blocco "pronostici: { }" (facoltativo): la pagina Pronostici dira\' che non ci sono pronostici.' : 'Nessun pronostico inserito (facoltativo).');

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
const NAV = [['home', 'Home'], ['driver-standings', 'Classifica piloti'], ['constructor-standings', 'Classifica costruttori'], ['teams', 'Teams'], ['qualifiche', 'Qualifiche'],
  ['race-results', 'Gare'], ['statistics', 'Statistiche'], ['pronostici', 'Pronostici'], ['calendar', 'Calendario'], ['giornale', 'Giornale'], ['regolamento', 'Regolamento']];
$('#nav').innerHTML = NAV.map(n => '<a href="#/' + n[0] + '" data-p="' + n[0] + '">' + n[1] + '</a>').join('');
$('#foot').textContent = S.played ? 'Dati aggiornati dopo il GP ' + S.lastRound + '. Le classifiche si calcolano in automatico dai risultati.' : 'Nessun GP ancora disputato.';
$('#foot').textContent += ' Versione del sito: ' + VERSION + '.';
let first = true;
function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = (NAV.some(n => n[0] === parts[0]) || parts[0] === 'diagnosi' || parts[0] === 'driver') ? parts[0] : 'home';
  const navP = page === 'driver' ? 'driver-standings' : page;
  $('#app').innerHTML = pages[page](parts[1]);
  document.querySelectorAll('#nav a').forEach(a => {
    if (a.dataset.p === navP) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); } else a.removeAttribute('aria-current');
  });
  document.title = (page === 'home' ? 'Apex Drawn - Campionato mondiale' : (page === 'diagnosi' ? 'Diagnosi' : page === 'driver' ? decodeURIComponent(parts[1] || 'Pilota') : NAV.find(n => n[0] === page)[1]) + ' - Apex Drawn');
  if (!first) { window.scrollTo(0, 0); $('#app').focus({ preventScroll: true }); }
  first = false;
  if (page === 'teams') loadComments();
  if (page === 'diagnosi') runDiag();
  if (page === 'statistics') initChart();
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

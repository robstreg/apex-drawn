/* ==========================================================
   APEX DRAWN - ELENCO DELLE STAGIONI
   Qui dici al sito quali stagioni esistono e quale si apre di default.
   ========================================================== */

/* Le stagioni. "dati" e' il nome del blocco dentro il file dei dati:
   - Stagione 1 -> data.js      (window.APEX)
   - Stagione 2 -> data-s2.js   (window.APEX_S2)
   "cartella" e' dove stanno foto dei GP, giornale e foto dei piloti di quella stagione
   (per la Stagione 1 e' vuota: usa le cartelle foto, giornale, piloti di sempre).
   "tema" e' il file di stile della stagione. */
window.STAGIONI = [
  { id: 1, nome: "Stagione 1", dati: "APEX" },
  { id: 2, nome: "Stagione 2", dati: "APEX_S2", cartella: "s2/", tema: "tema-s2.css", coloreBrowser: "#07050f" }
];

/* La stagione che si apre quando qualcuno entra nel sito (numero).
   Quando parte la Stagione 2, cambia 1 in 2. */
window.STAGIONE_CORRENTE = 1;

/* Nomi personalizzati di menu e titoli. A sinistra il nome originale (tutto minuscolo),
   a destra quello che vuoi tu. Togli le // davanti alle righe che vuoi usare.
   Cosi' non li perdi quando aggiorni app.js. */
window.ETICHETTE = {
   "driver standings": "Classifica piloti",
  "constructor standings": "Classifica costruttori",
  // "teams": "Squadre",
  "race results": "Risultati gare",
  "statistics": "Statistiche",
  "calendar": "Calendario",
};

/* ==========================================================
   APEX DRAWN - STAGIONE 2
   Per ora e' solo l'annuncio ("stay tuned"). Quando squadre e piloti sono decisi:
   1. compila "squadre" e "piloti" qui sotto;
   2. in stagioni.js cambia STAGIONE_CORRENTE da 1 a 2 (se vuoi aprire il sito su questa stagione).
   Finche' "piloti" e' vuoto il sito mostra la pagina "stay tuned".
   Dopo ogni GP si aggiorna come nella Stagione 1 (blocco "risultati").
   Foto dei GP, giornale e piloti vanno nelle cartelle s2/foto, s2/giornale, s2/piloti.
   ========================================================== */

window.APEX_S2 = {
  nome: "APEX DRAWN",
  sottotitolo: "Stagione 2",

  /* Pagina di annuncio. "data" e' facoltativa (AAAA-MM-GG): se la scrivi compare il conto alla rovescia. */
  annuncio: {
    titolo: "Il campionato con più concorrenti della storia",
    testo: "Stay tuned",
    data: "",
    posti: 20
  },

  gare: 10,
  giriProve: 3,
  giriGara: 5,
  punti: [12, 9, 7, 5, 4, 3, 2, 1],
  validi: 8,

  /* Squadre: { id: "sigla-breve", nome: "Nome", sigla: "NN", colore: "#rrggbb", logo: "s2/logos/nome.png" } */
  squadre: [],

  /* Piloti: { nick: "Nickname", squadra: "id-della-squadra" } */
  piloti: [],

  calendario: [
    { n: 1,  nome: "GP 1",  circuito: "", data: "" },
    { n: 2,  nome: "GP 2",  circuito: "", data: "" },
    { n: 3,  nome: "GP 3",  circuito: "", data: "" },
    { n: 4,  nome: "GP 4",  circuito: "", data: "" },
    { n: 5,  nome: "GP 5",  circuito: "", data: "" },
    { n: 6,  nome: "GP 6",  circuito: "", data: "" },
    { n: 7,  nome: "GP 7",  circuito: "", data: "" },
    { n: 8,  nome: "GP 8",  circuito: "", data: "" },
    { n: 9,  nome: "GP 9",  circuito: "", data: "" },
    { n: 10, nome: "GP 10", circuito: "", data: "" }
  ],

  qualifiche: { circuito: "", data: "", nota: "", risultati: [] },
  giornale: [],
  commenti: { url: "" },
  musica: { file: "musica/The_Chemical_Brothers_-_Hey_Boy_Hey_Girl", titolo: "The Chemical Brothers-Hey Boy Hey Girl" },
  pronostici: {},
  risultati: {},
  penalita: [],

  regolamento: [
    { titolo: "Formato", righe: [
      "Il campionato si corre su 10 Gran Premi.",
      "Ogni GP ha 3 giri di prove libere e 5 giri di gara."
    ]},
    { titolo: "Griglia di partenza", righe: [
      "La griglia è inversa rispetto all'ordine di arrivo del GP precedente: chi arriva ultimo parte in pole.",
      "Chi non partecipa a un GP parte ultimo nel GP successivo."
    ]},
    { titolo: "Formazione delle squadre", righe: [
      "Le squadre sono nate dalle qualifiche mondiali, disputate prima dell'inizio del campionato.",
      "Il primo classificato ha fatto coppia con l'ultimo, il secondo con il penultimo e così via."
    ]},
    { titolo: "Punti", punti: true, righe: [
      "Vanno a punti i primi 8 classificati."
    ]},
    { titolo: "Classifica piloti", righe: [
      "Nel punteggio finale si tengono gli 8 migliori risultati di ogni pilota, così le assenze non pesano.",
      "A parità di punti vale il maggior numero di vittorie, poi di secondi posti e così via."
    ]},
    { titolo: "Classifica costruttori", righe: [
      "Ogni squadra ha due piloti: il punteggio di squadra di un GP è la somma dei loro punti.",
      "Si tengono i migliori 8 punteggi di squadra."
    ]}
  ]
};

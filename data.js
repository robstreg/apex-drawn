/* ==========================================================
   APEX DRAWN - DATI DEL CAMPIONATO
   Questo è l'UNICO file da modificare dopo ogni Gran Premio.
   Tutto il resto (classifiche, statistiche, griglie) si calcola da solo.

   COME AGGIUNGERE UN GP
   1. Nella sezione "risultati" copia il blocco del GP 1 e cambia il numero (2, 3, ...).
   2. In "arrivo" scrivi i piloti nell'ordine di arrivo:
        ["Nickname", "tempo"]
      - il primo ha il tempo di gara totale (es. "05:24,508")
      - gli altri hanno il distacco con il + davanti (es. "+10,955")
      - se un pilota non finisce: ["Nickname", "", "DNF"] (va messo in fondo)
      - chi è assente semplicemente non si scrive: prende 0 punti
   3. Facoltativo: "giroVeloce" e "pole" (la pole dal GP 2 in poi si calcola da sola
      dalla griglia inversa, serve solo se vuoi correggerla a mano).
   4. Salva e ricarica il sito.
   ========================================================== */

window.APEX = {
  nome: "APEX DRAWN",
  sottotitolo: "Campionato mondiale Luca Bargellini",

  gare: 10,                 // numero di GP del campionato
  giriProve: 3,
  giriGara: 5,
  punti: [12, 9, 7, 5, 4, 3, 2, 1],   // dal 1° all'8° posto
  validi: 8,                // si tengono i migliori 8 risultati (piloti e squadre)

  /* Per mettere i loghi veri: copia i file nella cartella "logos" con questi nomi.
     Finché non ci sono, il sito mostra un'icona con le iniziali. */
  squadre: [
    { id: "nj",     nome: "NJ Racing",     sigla: "NJ", colore: "#2f7bff", logo: "logos/nj-racing.png" },
    { id: "lion",   nome: "Royal Lion",    sigla: "RL", colore: "#ffc61a", logo: "logos/royal-lion.png" },
    { id: "raptor", nome: "Raptor Racing", sigla: "RR", colore: "#ff3d3d", logo: "logos/raptor-racing.png" },
    { id: "eagle",  nome: "Italia Eagle",  sigla: "IE", colore: "#25c46a", logo: "logos/italia-eagle.png" }
  ],

  piloti: [
    { nick: "Nihholo",       squadra: "nj" },
    { nick: "Jarjtodt81",    squadra: "nj" },
    { nick: "Risorto",       squadra: "lion" },
    { nick: "Giusmacher2",   squadra: "lion" },
    { nick: "RobstregMN",    squadra: "raptor" },
    { nick: "BatSciscio1",   squadra: "raptor" },
    { nick: "SaettaMcFabri", squadra: "eagle" },
    { nick: "Patabomber",    squadra: "eagle" }
  ],

  /* Calendario: completa circuito e data quando li decidi (lascia "" se non sono definiti). */
  calendario: [
    { n: 1,  nome: "GP 1",  circuito: "Circuito 1", data: "02/11/2026" },
    { n: 2,  nome: "GP 2",  circuito: "Circuito cittadino diurno", data: "03/11/2026" },
    { n: 3,  nome: "GP 3",  circuito: "", data: "" },
    { n: 4,  nome: "GP 4",  circuito: "", data: "" },
    { n: 5,  nome: "GP 5",  circuito: "", data: "" },
    { n: 6,  nome: "GP 6",  circuito: "", data: "" },
    { n: 7,  nome: "GP 7",  circuito: "", data: "" },
    { n: 8,  nome: "GP 8",  circuito: "", data: "" },
    { n: 9,  nome: "GP 9",  circuito: "", data: "" },
    { n: 10, nome: "GP 10", circuito: "", data: "" }
  ],

  /* QUALIFICHE MONDIALE: le qualifiche che hanno formato le squadre.
     Scrivi i piloti in ordine di classifica: ["Nickname", "tempo"]
     (il tempo e' libero: "1:23,456", "+0,512" ... oppure lascia "" se non c'e').
     "nota" e' facoltativa: puoi spiegare come sono nate le coppie. */
  qualifiche: {
    circuito: "",
    data: "2026-10-28",
    nota: "Qualifiche disputate prima dell'inizio del campionato per formare le squadre: il primo ha fatto coppia con l'ultimo, il secondo con il penultimo e così via.",
    risultati: [
      ["Nihholo",       "1:02,381"],
      ["Risorto",       "1:04,378"],
      ["RobstregMN",    "1:05,365"],
      ["SaettaMcFabri", "1:05,444"],
      ["Patabomber",    "1:05,818"],
      ["BatSciscio1",   "1:06,343"],
      ["Giusmacher2",   "1:08,078"],
      ["Jarjtodt81",    "1:08,081"]
    ]
  },
 giornale: [
    // { n: 1, data: "2026-11-02", titolo: "Il grande inizio" },
  ],
 
  commenti: { url: "" },
musica: { file: "", titolo: "" },
  risultati: {
    1: {
     giroVeloce: { pilota: "Nihholo", tempo: "na" },     // esempio: { pilota: "Risorto", tempo: "1:03,412" }
      pole: "Jarjtodt81",
      arrivo: [
        ["Nihholo",       "05:24,508"],
        ["Risorto",       "+10,955"],
        ["BatSciscio1",    "+12,784"],
        ["SaettaMcFabri", "+14,176"],
        ["RobstregMN",    "+22,612"],
        ["Giusmacher2",   "+26,089"],
        ["Jarjtodt81",   "+32,441"],
        ["Patabomber",    "+33,996"]
      ]
    },
   2: {
      giroVeloce: { pilota: "Nihholo", tempo: "1:16,890" },
      pole: "Patabomber",
      arrivo: [
        ["Nihholo", "6:37,535"],
        ["Risorto", "+11,999"],
        ["SaettaMcFabri", "+22,929"],
        ["RobstregMN", "+26,064"],
        ["BatSciscio1", "+29,182"],
        ["Giusmacher2", "+36,476"],
        ["Jarjtodt81", "+37,354"],
        ["Patabomber", "+38,894"]
      ]
    },// 2: { arrivo: [ ... ] },   <- ogni GP finisce con una virgola
  },
    3: {
      giroVeloce: { pilota: "Nihholo", tempo: "1:24,853" },
      pole: "Patabomber",
      arrivo: [
        ["Nihholo", "7:17,361"],
        ["Risorto", "+7,124"],
        ["BatSciscio1", "+11,149"],
        ["RobstregMN", "+15,580"],
        ["Patabomber", "+20,415"],
        ["SaettaMcFabri", "+22,220"],
        ["Jarjtodt81", "+28,681"],
        ["Giusmacher2", "+30,525"]
      ]
    },
  /* Penalità (decurtazione di punti in classifica), facoltativo.
     Esempio: { pilota: "Risorto", punti: 2, motivo: "GP 3, contatto in curva 4" }
     I punti si tolgono dal pilota e dalla sua squadra. */
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

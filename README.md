# Apex Drawn - sito del campionato

File del sito: index.html, style.css, app.js, data.js, cartella logos.
Dopo ogni GP si modifica SOLO data.js (istruzioni in cima al file), meglio con lo strumento aggiungi-gp.html.
Classifiche, scarti (migliori 8), griglia inversa e statistiche si aggiornano da sole.

## Pubblicare gratis (scegli una strada)

A) GitHub Pages (consigliata: modifichi data.js dal browser, anche da telefono, e il sito si aggiorna da solo)
   1. Crea un account su github.com e un repository pubblico (es. apex-drawn).
   2. "Add file > Upload files" e carica tutti i file e la cartella logos.
   3. Settings > Pages > Source: "Deploy from a branch", branch main, cartella /(root).
   4. Dopo un minuto il sito e' su https://TUONOME.github.io/apex-drawn/ : questo e' il link da condividere.
   5. Per aggiornare: apri data.js su GitHub, matita (Edit), aggiungi il GP, "Commit changes".

B) Netlify Drop (piu' veloce, nessun repository)
   1. Vai su app.netlify.com/drop e trascina la cartella del sito.
   2. Ottieni subito un link. Per aggiornare ripeti il trascinamento (con un account gratuito il link resta lo stesso).

## Aggiungere un GP (ogni volta, 2 minuti)

1. Apri `aggiungi-gp.html` (sul sito pubblicato: indirizzo-del-sito/aggiungi-gp.html; in locale: doppio clic sul file).
2. Il numero del GP e' gia' quello giusto. Incolla l'arrivo, una riga per pilota (nickname e tempo), nell'ordine di arrivo.
   - primo: tempo totale (05:24,508); gli altri: distacco (+10,955)
   - ritiro: scrivi DNF al posto del tempo (va in fondo)
   - assente: non scriverlo, prende 0 punti
3. Facoltativo: scegli pilota e tempo del giro veloce.
4. Controlla i messaggi (niente rosso) e premi "Copia blocco".
5. Apri `data.js`, cerca `risultati: {`, vai in fondo all'ultimo GP e incolla subito sotto la riga `},`.
6. Salva (su GitHub: "Commit changes"). Il sito si aggiorna da solo.
7. Facoltativo: nel blocco `calendario` di data.js scrivi circuito e data del GP.

## Qualifiche mondiale

In `data.js`, blocco `qualifiche`: scrivi i piloti in ordine di classifica, `["Nickname", "tempo"]`.

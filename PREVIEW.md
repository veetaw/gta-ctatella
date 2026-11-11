# Aggiornamento rilascio

Vedi [RELEASE-MAX.md](RELEASE-MAX.md): Normale predefinita, cambio qualità con riavvio e pacchetto HQ caricato solo in Max. I selettori separati avatar/veicoli sono stati rimossi.

# Anteprima locale: grafica, avatar online e veicoli

Worktree separato `gta-visual-online-preview`, branch `codex/visual-online-preview`, basato su `cd94c62` della versione online. Non modifica `main`, la checkout di rilascio, database remoti o servizi di produzione. Nessun deploy eseguito.

## Cosa è pronto

- Pulsante impostazioni con icona a ingranaggio, titolo e nome accessibile; il menu offre Normale/Max come unica scelta di qualità; Max include avatar e veicoli HQ.
- Normale usa il percorso di rendering originale. Composer, PMREM del tramonto e luci aggiuntive vengono creati solo attivando Max e liberati al ritorno.
- Aspetto unico offline/online: qualità, personaggio, maglia, pantaloni, capelli e carnagione. Salvataggio locale per account e persistenza in `user_metadata.avatarAppearance`; richieste al profilo serializzate per impedire che un salvataggio vecchio sovrascriva quello nuovo. Il profilo di anteprima non scrive su Supabase.
- Il server convalida l'aspetto e lo invia agli altri giocatori tramite messaggi affidabili, separati dagli aggiornamenti binari della posizione. I nuovi ingressi ricevono tutti gli aspetti della stanza. Avatar remoti e passeggeri applicano le stesse scelte. Texture HQ da 1024² su desktop, 512² su mobile, caricate soltanto in Max.
- Correzione duplicazione auto/elicottero: il server assegna una transazione alla salita; ignora gli aggiornamenti precedenti alla conferma `vehicle-ready`, inviata dal client dopo avere installato il modello guidato. Lo stesso ID resta posseduto e viene parcheggiato una sola volta alla discesa.
- Ferrari e Corvette HQ in Max, con ruote animate e materiali PBR: geometria ridotta da 358.788 a 52.374 triangoli, asset Meshopt da circa 1,30 MB, caricato soltanto alla selezione HQ. Il modello corrente torna visibile oltre 60 m. Ingombro, passo, contatto ruote, collisioni, velocità e fisica restano originali. Panda, Punto, Jeep, cross, blindato, Rambo e carro armato non vengono sostituiti.

La correzione delle duplicazioni e la condivisione delle skin richiedono l'aggiornamento sia del client sia del server online. Il protocollo rimane compatibile con i client precedenti; le nuove funzionalità complete richiedono la coppia aggiornata.

## Avvio locale, senza servizi remoti

Da questa cartella, in due terminali:

```sh
npm run preview:online:server
npm run dev:visual-lab
```

- Offline: `http://127.0.0.1:5197/?visualLab&player=Iucc` → Gioca.
- Online primo client: `http://127.0.0.1:5197/?visualLab&mode=online&player=Iucc`.
- Online secondo client: stesso URL con `player=Vtella`. Creare una stanza privata nel primo e inserire il codice nel secondo.
- Confronto Ferrari: `http://127.0.0.1:5197/visual-preview.html`.

`visualLab` e il profilo fittizio funzionano solo in sviluppo su loopback. Il fixture WebSocket ascolta solo su `127.0.0.1:8097`, non usa credenziali e non registra ingressi sul database. La pagina di confronto è esclusivamente un'anteprima visiva, senza cambiare lo stato della partita.

Usare il comando dedicato `dev:visual-lab`: evita `predev` e la rigenerazione dei dati condivisi con le checkout esistenti. I file generati del mondo e le dipendenze sono collegamenti locali; non rigenerarli da questo worktree.

## Verifiche

- `node scripts/test-vehicle-handoff.mjs`: regressione riprodotta prima della correzione; ora superata per Panda ed elicottero, inclusi pacchetti a piedi ritardati.
- `npm run test:online`: stanze, posti passeggeri, parcheggio, PvP, traffico condiviso, interpolazione, nascondino, aspetti e colori non validi.
- `node scripts/test-visual-lab.mjs`: avatar originale intatto, 45 ossa, pesi normalizzati, silhouette e animazioni.
- `node scripts/test-vehicle-visuals.mjs`: ingombro, ruote a terra, LOD e ripristino esatto dei modelli originali.
- Test veicoli e rendering budget esistenti superati.
- Due client browser con backend locale: aspetto trasmesso e realmente applicato al mesh remoto, caricamento HQ e assenza di errori runtime.
- Build Vite di verifica in `/tmp/ctatella-online-visual-build`; nessuna pubblicazione. Il packaging del mondo e gli script di deploy non sono stati eseguiti.

La suite generale del mondo resta soggetta all'asserzione preesistente sui tetti già riscontrata nella checkout originale.

Screenshot e log sono in `artifacts/`, ignorati da Git.

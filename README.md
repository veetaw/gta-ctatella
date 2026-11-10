# San Gregorio Magno

Esplorazione 3D locale in Vite + Three.js, costruita dai dati GIS nella cartella `assets/`.

## Avvio

```sh
npm install
npm run world  # rigenera dati e ortofoto; necessario solo se cambiano gli asset
npm test
npm run dev
```

Apri http://localhost:5187. `npm run build` produce `dist/`.

## Multiplayer sulla stessa Wi-Fi

1. Configura `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` in `.env.local`. Il progetto Supabase deve accettare Realtime Broadcast su canali pubblici. Serve una connessione Internet per l’accesso e il signaling.
2. Esegui `npm run dev`. Sugli altri dispositivi apri l’indirizzo **Network** che Vite mostra nel terminale. Usa lo stesso build del gioco su tutti i dispositivi.
3. Dal gioco apri **LAN**. L’host sceglie **Crea stanza** e condivide il codice di sei caratteri. Gli altri lo inseriscono e scelgono **Entra**. La stanza ospita fino a sei persone, host incluso.
4. Usa **Torna in gioco** per iniziare a esplorare. L’host può scegliere **Chiudi inviti** per scollegare il signaling dopo l’ultimo ingresso. **Torna in singolo** riapre la campagna con i progressi salvati.

Il gameplay passa direttamente su WebRTC tra l’host e ciascun ospite. Le posizioni viaggiano su `gameData` fino a 30 aggiornamenti al secondo. L’host simula due auto di traffico e fino a quattro pedoni intorno a Piazza Municipio. Ogni giocatore ha i propri veicoli sbloccati e condivide con gli altri il mezzo che sta guidando. La partita libera è temporanea e non carica né salva i progressi della campagna.

Il codice è un invito informale per giocare tra amici. Il signaling non richiede nuove tabelle e non usa TURN. Una rete ospiti con isolamento fra dispositivi può impedire il collegamento. Se l’host lascia, la stanza termina.

## Comandi

- WASD o frecce: guida; a piedi W/S avanzano e A/D ruotano.
- E: scendi / risali entro 6 metri dall'auto.
- Spazio: frena. Shift: corri a piedi.
- C: tre distanze della telecamera. Trascina la scena per orbitare; doppio clic per ricentrare.
- R: ritorna allo spawn verificato di Via Guerrazzi.
- Minimap: trascina per spostare, rotella e + per zoom, ↗ per ingrandire, doppio clic per ricentrare.
- Suono: attiva il motore sintetizzato. ⛶: schermo intero.

## Coordinate e dati

L'origine comune è il centro dei **campioni** DEM: X=533394.327795997, Y=4501251.13341788. Ogni geometria usa esclusivamente `x=X-ORIGIN_X`, `z=-(Y-ORIGIN_Y)` dopo l'eventuale conversione CRS con proj4. Il DEM ha 709 × 561 campioni a 5 metri, per 3540 × 2800 metri fra i centri estremi. Nessun ridimensionamento della scala metrica.

I PRJ DBT dichiarano ETRS89 UTM33N. L'ASC non ha un PRJ: il CRS è dedotto dalle coordinate e dalla coincidenza della tavola con il GeoTIFF RDN2008 / UTM33N (EPSG:7792). ETRS89 e RDN2008 sono compatibili alla risoluzione dei dati; non è stata inventata una correzione arbitraria del datum. L'ortofoto 2023 è ritagliata dai suoi geotag e ricampionata a 4096², La megatexture conserva una base cartografica; le carreggiate sono nastri 3D separati con asfalto procedurale HD e UV metriche.

Sono esportati 1782 poligoni edificio interamente contenuti nella tavola. Il DBT comunale si estende oltre il DEM: 1227 poligoni esterni o di bordo sono esclusi esplicitamente e conteggiati nei metadati. I numeri di copertura si riferiscono al ritaglio DEM, non all'intero comune. 3050 campioni nulli a bordo tavola (zero nel file, nonostante NODATA=-9999) sono riempiti dal campione valido più vicino sulla griglia; i dati validi restano invariati.

Le altezze edificio sono stimate dall'area perché la tabella EDIFC non contiene campi altezza/piani. Il codice supporta tali campi se presenti. I nomi stradali sono estratti da TP_STR_TP_STR_NOM_T e associati ai tracciati omonimi, quindi alla rete EL_STR entro 45 metri; le vie senza associazione sono indicate come "Strada locale".

Muri continui dalla quota minima meno 10 m alla gronda massima più altezza. Finestre e persiane esclusivamente nel canvas facciata. Tetti triangolati con earcut, cortili inclusi. Vegetazione decorativa deterministica sulle zone verdi dell'ortofoto, esclusi gli edifici. Nessun servizio esterno è necessario per dati o texture; i font hanno fallback locali.

## Verifiche

`npm test` controlla copertura, quote finite, spawn sulla strada e libero da edifici, interpolazione bilineare, collisioni con scivolamento e assenza di attraversamento ad alta velocità, contatti delle quattro ruote, triangolazione e area di ogni tetto. La fisica usa passi fissi da 1/90 s e sottopassi collisione di massimo 35 cm.

Le quote grezze rimangono nel DEM; a runtime `road-network.js` costruisce un modello stradale condiviso da rendering, terreno, ruote e personaggio. Gli assi sono ricampionati con passo massimo 80 cm e le quote smussate con media pesata su 6 metri. Ogni sezione ha bordi sinistro e destro alla stessa identica quota. Alle sovrapposizioni gli assi condividono una quota locale comune, con raccordi longitudinali su 7 metri: nessun ramo sceglie un'altezza indipendente. Fuori dai raccordi resta il profilo longitudinale DEM smussato.

Il terreno vicino alle strade si raccorda al piano stradale con smoothstep su 2,4 metri. La geometria del terreno è raffinata a 1,25 metri nei corridoi stradali e tagliata in modo conservativo sotto tutti i triangoli della carreggiata, compresi quelli attraversati anche quando i loro vertici sono esterni al nastro. I bordi duplicati fra le tessere sono saldati dopo il taglio. Banchine e fondazioni laterali interrate chiudono le scarpate. Le fondazioni degli edifici si estendono ulteriormente dove una strada ha abbassato il terreno.

L'asfalto è una texture canvas periodica 1024² con graniglia, tracce pneumatici e cunette in pietra negli intervalli U 0–0,08 e 0,92–1. U attraversa la carreggiata; V si ripete ogni 4 metri. Materiale `MeshStandardMaterial`: roughness 0,88, metalness 0,05, bump e roughness map derivate dal canvas, RepeatWrapping e anisotropia 16. La mesh è rialzata di 6 cm rispetto alla quota stradale; la fisica campiona esattamente i suoi triangoli visibili, offset compreso. Le sovrapposizioni fra nastri sono ritagliate con Clipper su coordinate intere a precisione 0,1 mm, evitando superfici duplicate e z-fighting.

`npm test` include inoltre il controllo di 93.264 sezioni trasversali, 234 pose dell'auto in Via Mameli senza rollio, UV metriche, assenza di fessure tra tessere e 64.847 sonde di separazione fra terreno e asfalto. Il risultato numerico è salvato in `artifacts/road-verification.json`.

Le geometrie stradali e del terreno adattato vengono precalcolate in Node da `npm run roads`, richiamato automaticamente prima di `npm run dev` e `npm run build`. Una firma SHA-256 degli input evita rigenerazioni inutili. Il browser carica i buffer compressi di `public/road-meshes.binz` con il relativo manifest `road-cache.json`; il percorso di calcolo runtime rimane disponibile come fallback. Banchine e fondazioni sono divise per strada per consentire il frustum culling.

Per aprire direttamente il tratto verificato: http://localhost:5187/?via=mameli. La selezione sceglie una posizione libera da edifici sulla via richiesta; R torna a quello spawn.

## Architettura e arredo del borgo

Le sagome GIS e la rete stradale mantengono l'allineamento precedente. Le facciate sono ricostruite con un atlante procedurale condiviso: aperture ogni 4,5–5,5 m, al massimo una sui muri inferiori a 6 m, portoni/garage/cantine al piano terra e varianti con persiane verdi o marroni, avvolgibili e archi ribassati ai piani superiori. Zoccolature alte 80 cm seguono la quota del terreno, senza coprire i portoni; umidità leggera e pluviali agli spigoli sono disegnati nel materiale. Le finestre restano texture sul muro.

I tetti sono falde a padiglione adattate a ciascun poligono, con cortili aperti, cornicioni sporgenti 35–45 cm, colmi alti 1,2–1,8 m e coppi invecchiati. Le case ricevono uno o due comignoli in muratura. Balconi aggettanti 90 cm, solette e ringhiere aperte in ferro sono allineati alle porte-finestre del primo piano; vengono esclusi quando entrerebbero in un edificio vicino.

Asfalto più chiaro e polveroso, tombini in ghisa e griglie trasversali seguono la quota della carreggiata. Sole alto, cielo estivo, ombre a 4096² e foschia solo oltre 1600 m sostituiscono l'atmosfera grigia ravvicinata. Lampioni ogni circa 32–40 m, cartelli con i nomi delle vie e vegetazione mediterranea sono posizionati proceduralmente fuori da carreggiate e impronte degli edifici. Ulivi, pini, cipressi e cespugli occupano spazi liberi presso i bivi e aree verdi individuate nell'ortofoto. Questi dettagli architettonici e d'arredo sono una ricostruzione procedurale guidata dal brief, non un rilievo fotografico di ciascun immobile.

`npm test` comprende `test-village.mjs`, che verifica spaziature, tetti concavi e con cortili, quote dei cornicioni, allineamento dei balconi e posizioni dell'arredo. Il rapporto è in `artifacts/village-verification.json`.

## Via Ponte: patrimonio religioso e pavimentazioni

`build-world.mjs` richiama `build-heritage.mjs`: l'audit legge 187 shapefile e i campi/contenuti di 452 DBF (rapporto `artifacts/dbt-audit.json`). Le destinazioni d'uso sono interpretate attraverso le tabelle di dominio originali, non dai soli numeri: EDIFC_TY=11 identifica una chiesa, EDIFC_USO=05 un luogo di culto. Santa Maria delle Grazie, edificio **978922**, è il corpo isolato al bivio di Via Ponte. Il suo perimetro GIS resta invariato; il fronte è scelto verso il poligono DBT dell'incrocio **493497**.

Le navate ricevono una gronda a 7,4 m sopra il massimo terreno e un colmo a 9,2 m, stime architettoniche dichiarate nei dati, non quote misurate dal DBF. Le falde sono due piani simmetrici ritagliati sul poligono reale e divisi esattamente lungo il colmo. Facciata sacra dedicata con portale, edicola votiva e tre monofore, senza atlante residenziale o persiane; campanile a vela con apertura, campana e croce sono in 3D. Questi particolari sono una ricostruzione procedurale guidata dalla descrizione dell'utente. I piccoli corpi religiosi e i campanili escludono anch'essi le finestre residenziali.

L'analisi dell'ortofoto lavora a 40 cm/pixel, calcolando media RGB, luminanza, varianza, contrasto locale e frazioni di pietra chiara/neutra lungo ogni strada e superficie DBT. Il dominio “pavimentato” non distingue asfalto da pietra: le statistiche sono indizi, incrociati con geometria e verifica visiva dei ritagli. Il DBT di questa tavola non contiene poligoni esplicitamente classificati come piazza/vicolo: la piazza di Via Ponte è registrata come incrocio. Le selezioni e il grado di evidenza rimangono nel JSON e in `artifacts/heritage-analysis.json`.

Nove aree di pavimentazione comprendono la piazza, i rami adiacenti e tre tratti stretti del nucleo presso Chiesa Madre. Le raggiere e cornici bianche provengono direttamente da ritagli georeferenziati del TIFF originale a **20 cm/pixel**, con contrasto e nitidezza migliorati. L'ingrandimento delle texture non aggiunge dettaglio fotografico inesistente: fughe, corsi curvi di sanpietrini e graniglia sono dettagli procedurali metrici, combinati nel materiale con la foto reale. Le transizioni verso l'asfalto sono sfumate su 1,4 m. Un ritaglio fotografico continuo a 2048 px e la maschera unificata dei sei poligoni del bivio eliminano le cunette residue fra superfici adiacenti.

Le piazze coprono l'intero poligono DBT con una griglia metrica da 1 m, ritagliando i nastri esistenti per evitare z-fighting. La griglia evita ventagli di triangoli sottilissimi nelle superfici concave; le normali vengono saldate per una resa continua. I nuovi triangoli sono condivisi con fisica e taglio del terreno; le sezioni stradali senza banking restano invariate. `test-heritage.mjs` controlla identificazione, orientamento, falde simmetriche, foto e copertura della piazza. `test-roads.mjs` verifica anche il terreno sotto le piazze. Aprire **http://localhost:5187/?via=ponte** per partire davanti alla chiesa; R ripristina questa posizione.

## Raccordi urbani e scansione completa DBT

Il primo aggiornamento è stato completato e compilato prima di integrare i nuovi layer (`artifacts/phase1-build.log`). Gli spazi inferiori a 4 m fra carreggiata/piazza e facciate ricevono una banchina a +10 cm, con penetrazione di 40 cm nel muro e quota trasversale presa dal bordo strada. Una fascia continua chiude la connessione alla facciata; i residui acuti del ritaglio sono sostituiti da bevel limitati. Le fondazioni non dipendono dal terreno grezzo esposto. I raccordi comprendono anche gli edifici minori aggiunti dal DBT. Il terreno sottostante è tagliato almeno 45 cm sotto tutte le superfici; il taglio considera l'intero triangolo attraversato, non solo i vertici contenuti. I triangoli delle banchine e dei raccordi con area quasi nulla o angoli inferiori a 3° vengono scartati/sostituiti. Nei nodi planimetrici già alla stessa quota ci sono 265 dischi piatti, senza cunette interne; la pavimentazione decorata mantiene il proprio materiale.

`build-road-meshes.mjs` genera anche `public/urban-aprons.json`. I raccordi sono triangoli condivisi con la fisica, non un piano decorativo separato. `test-urban.mjs` controlla le distanze, la penetrazione, la copertura della facciata, gli angoli e quasi 400.000 vertici del terreno. Le scarpate rurali sono ritagliate fuori dalle pavimentazioni e filtrate geometricamente.

`npm run extras` esegue `scripts/build-dbt-extras.mjs`. La scansione legge tutte le geometrie dei 187 SHP e tutti i 452 DBF: 104.128 oggetti e 2.563.550 vertici sorgente. Il rapporto completo per layer è `artifacts/dbt-full-scan.json`: indica elementi letti, elementi nel DEM, rappresentazioni esportate e motivi di esclusione. Tabelle di dominio e CLASSREF ricongiungono le classificazioni delle geometrie agli attributi. Le rappresentazioni alternative dello stesso oggetto, curve di livello e dati amministrativi non producono oggetti 3D duplicati. Le porzioni esterne vengono ritagliate sul DEM, senza ricentrare nulla. Le firme dei file evitano scansioni e precalcoli ripetuti a fonti invariate.

Nel ritaglio sono esportati 7.552 elementi aggiuntivi, inclusi 202 poligoni completi di incrocio/anello stradale: 1 isola circolare riconosciuta geometricamente come rotatoria, 3 altre isole e 2 spartitraffico lineari; 1.466 muri di sostegno/ala, 1.480 muri divisori (487 a secco), 999 recinzioni; 14 aree a gradinate e 1 gradinata sportiva; 2 ponti; 25 campi sportivi, 6 piscine e 15 vasche; 6 aree verdi, 317 poligoni boschivi e 2.143 alberi puntuali; 830 edifici minori, 8 cabine, 13 serre, 5 tralicci; 3 tabernacoli, 2 monumenti e 5 manufatti non qualificati, oltre ai marciapiedi e al bordo d'acqua censiti. I campi classificati calcio ricevono linee e porte; le superfici non qualificate non sono trasformate arbitrariamente in campi da calcio. Le piante GIS rimangono esatte. Le altezze non presenti nel DBF, le essenze arboree e le forme architettoniche puntuali sono ricostruzioni procedurali dichiarate, non un rilievo fotogrammetrico. Il codice non classifica come fontane i manufatti privi di tipo.

I gradini sono ritagliati sui poligoni DBT, con pedate orizzontali e alzate solide; il campionamento della quota a piedi usa esattamente le stesse pedate. I ponti ricevono impalcati, parapetti sui lati longitudinali rispetto alla strada e appoggi; la quota segue il profilo stradale esistente. L'isola circolare ha aiuola, cordolo e segnali di rotatoria. Muri, isole, recinzioni, edifici minori e tronchi hanno collisioni solide indicizzate spazialmente. La vegetazione procedurale viene diradata vicino agli alberi DBT per evitare duplicazioni.

Accessi diretti di verifica: `?via=ponte` per la piazza, `?luogo=rotonda`, `?luogo=scale`, `?luogo=ponte`, `?luogo=sport` per i nuovi elementi. La posizione iniziale viene scelta su una strada libera dai nuovi ostacoli. `npm run world`, `npm run build` e `npm run dev` mantengono allineati dati e geometrie; `npm test` include le verifiche urbane e DBT. Rapporti numerici in `artifacts/urban-verification.json` e `artifacts/dbt-extras-verification.json`.

Gli incroci DBT sono pavimentati sull'intera superficie censita, oltre ai nastri assiali: le parti decorative mantengono la propria foto, le altre ricevono asfalto HD senza cunette interne. Le isole hanno quota piatta a +18 cm rispetto al profilo stradale, condivisa con il terreno scavato sottostante; non sono appoggiate alla quota grezza della collina.

## Panda 4x4 e Ferrari

Entrambe le auto sono presenti vicino allo spawn. `1` seleziona la Panda, `2` la Ferrari e `V` alterna il veicolo mentre si guida; a piedi `E` sceglie l’auto più vicina entro 6 metri. `R` riposiziona entrambe. La Panda raggiunge 130 km/h, la Ferrari 350 km/h con sette marce. FOV e sintesi del motore seguono velocità, marcia e modello. Le ruote sono istanziate e campionate individualmente sul campo quote; il corpo della Panda ha un raccordo morbido delle sospensioni. La fisica usa sei sottopassi, un volume a capsula con controllo di muso/coda e campioni di collisione lunghi al massimo 35 cm.

Le superfici aggiuntive DBT di boschi e verde sono escluse dal rendering: sulle montagne rimane il DEM ortofotografico. I dati originali restano nel catalogo GIS. Profondità logaritmica, mipmap, anisotropia massima e ombre agganciate alla griglia dei texel stabilizzano il paesaggio. Il raggio delle ombre è 90 metri. Geometrie statiche raggruppate per materiale, oggetti ripetuti istanziati, terreno con dettaglio a distanza e indici spaziali da 20 metri limitano il lavoro per fotogramma. Le ombre dettagliate vengono emesse soltanto da geometrie vicine al giocatore; il DEM lontano mantiene una copertura continua. La minimappa viene precalcolata una sola volta. La risoluzione di rendering si adatta se il frame rate scende, fino a un pixel ratio minimo di 0,8; il frame rate effettivo dipende dalla GPU e dalla risoluzione della finestra.

`node scripts/test-vehicles.mjs` verifica velocità, cambio, frenata, CCD a 350 km/h e contatto ruote/terreno. `node scripts/test-render-budget.mjs` verifica batching, trasformazioni, instancing, texel snapping e LOD. Entrambi fanno parte di `npm test`. Il diagnostico DOM di sola lettura `document.documentElement.dataset.performance` espone draw call effettive, triangoli, FPS, auto attiva e configurazione depth buffer per la verifica nel browser.

## HUD, mobile e produzione

L’HUD mostra solo radar GPS, barre di integrità/energia, tachimetro con arco contagiri e tre icone. Via e veicolo compaiono per quattro secondi quando cambiano. `H` apre e chiude i comandi; il pannello sospende il movimento. Il radar si inclina guidando e torna piatto a piedi. La telecamera bassa usa inerzia in curva, FOV 60–78° e un leggero scuotimento oltre 250 km/h. Luce pomeridiana, contrasto ACES e ambiente PMREM dello Sky riflesso da vernice e vetri accompagnano stop emissivi, fari senza ulteriori ombre, skidmark e fumo con pool istanziati. Anche l’auto parcheggiata ha un ingombro solido, usato da veicoli, personaggio e telecamera.

Su touch: avvio con un tocco, frecce per sterzare, pedali contestuali e joystick a piedi. L’interfaccia mostra minimappa, velocità essenziale in auto e azioni pertinenti; nessun pannello comandi PC o selettore globale del minigioco. Tutti i puntatori vengono rilasciati su cancellazione o perdita del focus. La disponibilità del fullscreen/orientation lock dipende dal browser: se negati il gioco rimane utilizzabile. Su iOS/Android/iPadOS: niente MSAA, ombre dinamiche o PMREM; framebuffer limitato a 850.000 pixel, pixel ratio massimo 1. Texture terreno da 1024², facciate da 1024², cartelli da 512×1024; immagini piazze fino a 512 px, asfalto da 512² senza mappe ausiliarie. Desktop: ombre a 4096² e qualità originale. `mobile-check.html` è un banco prova locale con viewport 844×390, 393×852 e 320×700; è escluso dalla distribuzione.

`npm run build` genera circa 31 MB per il profilo desktop e i blocchi mobile aggiuntivi serviti per prossimità (circa 101 MB complessivi sul CDN). La cache geometrica usa meshoptimizer, welding e quantizzazione delle posizioni a 1 mm, con errore massimo 0,5 mm; il reticolo DEM mantiene l’ordine necessario al LOD. JSON compressi e geometria hanno nomi contenenti l’hash e decompressione client, con fallback JavaScript se manca DecompressionStream. L’ortofoto è convertita in WebP. Il packaging verifica codec, topologia, budget di 50 MB e assenza di ASC/SHP/DBF/TIFF/ZIP grezzi. Gli asset originali in `assets/` e le cache di lavoro in `public/` rimangono soltanto locali. Vite copia esclusivamente la allowlist generata; `.vercelignore` consente l’upload di `dist/` e `vercel.json`.

- `npm run preview`: serve la build su http://localhost:5188.
- `npm run test:production`: verifica decoder, indici, reticolo DEM, budget, fallback gzip, contagiri e drift.
- `npm run deploy`: ricostruisce in locale e invia solo la distribuzione a Vercel, senza build GIS nel cloud.
- Se Vercel non è autenticato, il comando completo è `npx vercel login && npm run deploy`.

La configurazione Vercel serve file statici da `dist`, applica cache immutabile a bundle e dati con hash, rivalida il manifest e non avvia installazioni o build remote. Rapporti in `artifacts/production-assets.json`; i log di collaudo sono `final-gta-build.log` e `final-gta-tests.log`.

Il profilo mobile usa materiali/immagini delle piazze condivisi e geometrie già precalcolate a blocchi, senza caricare i grandi JSON del profilo desktop. La perdita del contesto ferma il loop e rilascia i comandi; il primo ripristino riusa le risorse conservate a risoluzione ridotta, una perdita ripetuta propone un tentativo manuale senza cicli di reload. Schede nascoste sospendono animazione e fisica. `npm run test:mobile` verifica rilevamento, budget e macchina di ripristino. Il banco prova locale consente una perdita/ripresa WebGL reale. Un test desktop con profilo mobile non certifica tutti i telefoni fisici.

Le cantine sono limitate alla prima fila sul lato sinistro in salita del percorso GPS Via San Zaccaria (`40.6557267, 15.4063`) → Viale della Rimembranza (`40.6555196, 15.400788`). Tutte le altre abitazioni conservano altezza originale e facciate intonacate. Le cantine hanno un solo piano, tetto incluso entro 3,5 m dal piano di accesso stradale, portone ad arco in legno scuro e falde planari senza aggetti sovrapposti. Gli accessi ritagliano muri e banchine. Il basolato usa triangoli ritagliati sul percorso e sulla sola piazzetta DBT a `40.655552, 15.401863`, con transizioni a raso verso l’asfalto. I particolari permanenti della piazzetta seguono la vista Street View di maggio 2022: muro in pietra, copertina, ringhiera, ulivi e lampioni; esclusi gli allestimenti temporanei. `node scripts/test-cellar-district.mjs` verifica i vincoli geometrici.

Orientamento mobile: si gioca soltanto in orizzontale. In verticale una schermata chiede di ruotare il telefono; fisica e missioni si fermano e i comandi vengono rilasciati. Tornando in orizzontale la partita riprende; il minigioco musicale resta in pausa finché si preme Riprendi. Il fullscreen resta facoltativo.

Correzione iPhone: il client mobile usa ora un mondo precalcolato a blocchi GIS di 96 m. Nessun caricamento dei grandi JSON desktop, nessuna triangolazione o ricostruzione delle banchine sul telefono. La build prepara 1.140 blocchi indipendenti con geometrie meshoptimizer, collisioni e quote fisiche esatte per strade, piazze e gradini. Il caricamento iniziale della geometria del punto di partenza è 2,22 MB; il catalogo completo disponibile sul CDN resta scaricato solo per prossimità. Sono residenti al massimo 9 blocchi, con limite di 32 MiB per gli array geometrici/fisici e rilascio esplicito dei buffer GPU lontani. La fisica attende il caricamento dei blocchi necessari a proseguire.

La schermata iniziale arriva prima di Three.js/WebGL e richiede di ruotare il telefono in orizzontale per giocare. La rotazione aggiorna soltanto la proiezione della telecamera: il framebuffer mobile resta 640×640 (riducibile in caso di framerate basso) e non viene ingrandito durante rotazione/fullscreen. Il target mobile è 30 FPS; la risoluzione adattiva interviene sotto 26 FPS. La versione desktop mantiene il percorso originale. `npm run test:mobile` include budget dei blocchi, decoder, indici, bin fisici e campioni di quote; `artifacts/iphone-qa.html` è il banco prova locale per 20 rotazioni e spostamenti tra quartieri, escluso dal deploy. La distribuzione complessiva include entrambi i profili ed è circa 101 MB; il telefono non scarica l'intera distribuzione.

Lu Mazzuoccl si raccoglie soltanto a piedi vicino a `40.6575901, 15.4012597`. Tocca per bloccare potenza e direzione; dopo ogni lancio raggiungi l’oggetto per rilanciarlo verso `40.6555031, 15.4018798`. La distanza dal traguardo appare solo durante la partita. Il tasto M non attiva il gioco.

Per modifiche GIS: `npm run world`, poi `npm run build`. La distribuzione pronta per Vercel è `dist/`; `npm run deploy` la ricostruisce e pubblica.

Riferimenti aggiuntivi da Street View: Piazza Croce (`40.6586315, 15.4011607`), con pavimentazione scura limitata all’incrocio, lampioni ornamentali, ringhiera e pannello dipinto schematico; My Way (`40.6584369, 15.398951`), con portico arretrato, colonne, fioriere e balconate; bar del distributore su Via del Sole (`40.6572926, 15.3966811`), con vetrine, tende chiare e pensilina. Le geometrie sono unite per materiale in `src/local-landmarks.js`; le dimensioni dei dettagli sono stime visive, le impronte degli edifici restano quelle DBT.

Aggiornamento mobile: camminata a 3,2 m/s e sprint tenuto a 7,2 m/s, tasto Salta e Spara predisposto ma disabilitato. La camera si accorcia davanti agli ostacoli invece di salire sopra gli edifici. L’asfalto è uniforme e gli incroci non hanno più dischi sovrapposti. I motori usano registrazioni CC0 (crediti in `public/audio/CREDITS.txt`), con miscelazione per carico/RPM, 5 marce per Panda/Punto e 7 per Ferrari, pausa di cambiata e calo del regime.

### Turneia a San Vito

A piedi presso **40.661428, 15.405119**, premi **Turneia** vicino ai due manzi tricolore e alle 24 pecore. Completa tre giri intorno alla chiesa mantenendo il gregge al seguito. **Shift / SPRINT** raddoppia i punti in movimento; **Spazio / SALTA** dà +50 punti, oppure +100 durante lo sprint (cooldown 1,5 s). Ogni giro vale +500 punti più un bonus velocità. **Q / 🗣️ Chiama lu muanz** riproduce un fischio procedurale e ricompatta gli animali quando scappano. Fuori dal percorso o con gregge disperso i punti e i giri si fermano. La Ferrari rossa si sblocca a fine missione e compare vicino a San Vito con una **F** sulla minimappa.

Il record locale e lo sblocco persistono nel salvataggio esistente. La classifica unica usa `player_profiles`, con selettori **Totale Paese / Porta la Statua / Lu Mazzuoccl / Turneia / Abballa**. Lo schema `supabase-schema.sql` include nickname univoci, RLS, protezione dei record e Realtime. I progressi locali sono separati per account e conservati se la sincronizzazione non è disponibile.

Verifica dedicata: `npm run test:turneia` (giri, sprint/salti, fuga/richiamo, seguito del gregge, taglie degli animali e texture della maglia). `node scripts/test-mobile.mjs` verifica anche il salto touch immediato senza doppia attivazione sintetica.

## Processione e accesso

Prima del mondo è richiesto accesso email/password; la registrazione richiede un nickname univoco. La processione parte automaticamente dalla Madonna delle Grazie e segue 333 m di strade fino alla Chiesa Madre: Cenda, San Pietro, Madonna e 16 fedeli. Porta una vara per 15 m per sbloccare le altre tre missioni: la distanza avanza col corteo, anche senza muovere il joystick. All’arrivo il corteo entra in chiesa; si può riavviare soltanto tornando al punto iniziale. La minimappa si espande con tutti i punti missione e i veicoli.

Verifica mirata: `npm run test:progression`, `npm run test:turneia`, `npm run test:abballa`, `node scripts/test-mobile.mjs`.

Al login e al reset il personaggio compare sempre a piedi, fuori dalle sagome dei veicoli. Dopo aver completato Porta la Statua, gli accessi successivi non avviano il corteo: resta disponibile il pulsante di avvio manuale presso la Madonna delle Grazie.

## Multiplayer via Internet

Dalla home, dopo l'accesso, scegli **ONLINE**. **Partita pubblica** cerca un posto in una stanza pubblica o ne apre una. **Crea stanza privata** genera un codice di sei caratteri. Le stanze ospitano sei giocatori e restano aperte finché c'è qualcuno dentro.

Per la prova locale, esegui `npm run online:server` e, in un secondo terminale, `npm run dev -- --port 5191`. Apri `http://localhost:5191`. Se mancano i dati GIS, esegui prima `npm run world`. Il server legge la configurazione Supabase già usata dal gioco in `.env.local`. La verifica automatica del server è `npm run test:online`.

Usa **E** per salire o scendere dai tuoi veicoli. A piedi, **X** apre le armi, **F** o il clic spara e **R** ricarica. I comandi equivalenti sono disponibili su touch. Come nella campagna, il combattimento è disponibile per i profili maggiorenni. I giocatori condividono le posizioni e i veicoli in uso. I veicoli parcheggiati sono personali. Le stanze online sono temporanee e separate dalla campagna e dalla LAN. Traffico e pedoni ambientali restano nella modalità LAN.

### Server Azure

Il server Node.js richiede Node 22 o successivo. Distribuisci il repository con le dipendenze di produzione (`npm ci --omit=dev`) e i file generati `public/world-data.json` e `public/dbt-extras.json` della stessa versione del gioco. Questi due file servono al server per verificare il terreno e le coperture dei colpi. Avvia con `npm run online:server`. Il processo usa `PORT` (default `8080`), risponde su `GET /health` e accetta WebSocket su `/online`.

Configura sul server `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `ONLINE_ORIGINS` (origini HTTPS del frontend separate da virgole). Il server verifica i token Supabase. Su App Service usa una singola istanza con WebSocket abilitati e TLS sul servizio. Su VM, esponi il processo attraverso il reverse proxy HTTPS con l'upgrade WebSocket su `/online`. Imposta `VITE_ONLINE_URL=wss://<host>/online` nella build del frontend.

Per Container Apps, prepara l'immagine dalla radice del progetto con i due JSON già generati.

```sh
docker build --platform linux/amd64 -t ctatella-online:1 .
```

Pubblica l'immagine nel registro scelto e usa il relativo tag su Azure. Seleziona **Consumption** con una singola revisione attiva, minimo 0 e massimo 1 replica, ingresso HTTP esterno sulla porta 8080. Mantieni attivo lo spending limit di Azure for Students. Configura le variabili Supabase e le origini del sito nel portale, così le credenziali restano fuori dall'immagine. Il client riprova il collegamento iniziale per un massimo di un minuto per permettere al server di avviarsi dopo un periodo di inattività.

Le stanze sono in memoria e vengono chiuse al riavvio del processo. La guida usa la fisica locale. Il server controlla limiti di movimento, cadenza, munizioni, coperture e salute. Trasmette le posizioni a un massimo di 20 aggiornamenti al secondo, entro 230 metri e solo quando lo stato cambia. A stanza piena ogni aggiornamento contiene fino a 90 byte di posizioni per destinatario, esclusi WebSocket, TLS ed eventi di combattimento.

Il frontend legge `VITE_ONLINE_TESTER_IDS` in fase di build. Imposta una lista di UUID Supabase separati da virgole per abilitare ONLINE ai tester, `*` per tutti gli utenti autenticati, oppure un valore vuoto per nascondere la modalità a tutti. Dopo ogni modifica ricompila il frontend. Questo filtro vale per l’interfaccia e la navigazione del client.

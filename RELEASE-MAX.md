# Grafica Max: rilascio

Normale è la modalità predefinita. Il cambio Normale/Max viene salvato sul dispositivo e riavvia automaticamente il gioco. Non ci sono selettori separati per avatar e veicoli HQ.

Normale non importa `avatar-hq`, `vehicle-hq`, `max-rendering`, i relativi effetti o i modelli aggiuntivi. Il bundle Three core è separato dagli addon di post-processing. Il mondo, i dati di streaming e i modelli normali restano quelli pubblicati.

Max importa il codice e i modelli aggiuntivi dopo il riavvio, attiva il tramonto cinematografico e applica avatar e veicoli HQ. Avatar: geometria raffinata condivisa, texture da 1024 px su desktop e 512 px su mobile. Corvette C1 e Ferrari sono compresse Meshopt, con geometrie visuali entro gli ingombri fisici originali, ruote animate e LOD a 60 m. I colori del profilo restano riconoscibili anche in Normale senza attivare il dettaglio HQ.

Le attribuzioni sono accessibili dal piccolo link sotto le impostazioni. La Corvette di sharingan include autore, fonte e licenza CC BY 4.0 nei metadati del GLB; il sorgente distribuito è nella biblioteca `pedrosoandre/carros`. Per la Ferrari 458 di vicent091036 viene mantenuta l'attribuzione e il riferimento dell'esempio Three.js, pubblicamente distribuito come modello CC BY. Entrambi sono stati adattati e ottimizzati.

Il rilascio include anche sincronizzazione delle personalizzazioni online e correzione client/server della duplicazione dei veicoli durante la salita. Il protocollo rimane compatibile con i client precedenti.

Controlli mirati: build di produzione, analisi del grafo dei moduli (nessun asset HQ nel percorso Normale), modalità predefinita, ingombri/ruote/LOD Ferrari e Corvette, regressione della salita con pacchetti ritardati e suite del protocollo online. Nessuna rigenerazione del mondo: il manifest è stato confrontato con il sito pubblicato e coincide.

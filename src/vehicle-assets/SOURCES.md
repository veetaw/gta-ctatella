# Fonti dei modelli e candidati

## Ferrari usata nell'anteprima locale

**Ferrari 458 Italia**, autore **vicent091036**. Asset proveniente dall'[esempio ufficiale Three.js](https://threejs.org/examples/webgl_materials_car.html), che attribuisce esplicitamente il modello all'autore.

File sorgente: https://threejs.org/examples/models/gltf/ferrari.glb

Upload originale indicato dall'esempio: https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6

Adattamenti locali: rimozione UV inutilizzate (il file non contiene texture), semplificazione della geometria, ricostruzione delle normali, compressione Meshopt, materiali, allineamento a dimensioni e ruote del gioco. Il sorgente non modificato è conservato solo in `artifacts/ferrari-original-reference.glb`.

Distribuito e attribuito come CC BY 4.0 nelle implementazioni pubbliche dell'esempio Three.js. Attribuzione in gioco: titolo, autore, fonte Three.js, collegamento alla licenza e indicazione degli adattamenti.

## Corvette C1

**Lucifer's Corvette – 1960 Chevrolet Corvette C1**, autore **sharingan** (https://sketchfab.com/luci-fan), **CC BY 4.0**. I metadati `asset.extras` del file riportano autore, licenza e fonte.

Fonte originale: https://sketchfab.com/3d-models/lucifers-corvette-1960-chevrolet-corvette-c1-507ee2e6d6a34a3db7bf8373c70fecff

Distribuzione GLB: https://github.com/pedrosoandre/carros/blob/main/assets/chevrolet-corvette.glb

Adattamenti: separazione e allineamento delle quattro ruote, normalizzazione degli ingombri al gioco, ottimizzazione Meshopt, texture limitate a 1024 px, collegamento al LOD e alle animazioni esistenti. La licenza dell'asset resta CC BY 4.0.

## Ricerca: candidati non importati

| Veicolo | Fonte | Valutazione |
|---|---|---|
| Panda | [Fiat Panda MK3, Merc_TV](https://sketchfab.com/3d-models/fiat-panda-mk3-since-2011-937ce0e375b54b4f9c8120f257df3787) | 29.700 triangoli, pagina riporta CC Attribution. Generazione diversa dalla Panda 4x4 classica attuale: non sostituita automaticamente. Download e asset da ispezionare. |
| Panda | [Fiat Panda, Nieve5677](https://sketchfab.com/3d-models/fiat-panda-0756a0766fdc4ff0b3bc5b3f5285fbed) | 1,2 milioni di triangoli: troppo pesante senza un lavoro di ottimizzazione sostanziale. |
| Punto | [2011 Fiat Punto, tonielpro520](https://sketchfab.com/3d-models/2011-fiat-punto-888037316bf8471c96014aeec9975f1d) | Candidato trovato; accesso alla pagina bloccato durante l'ispezione, generazione diversa dalla Punto attuale. Non importato. |
| Jeep | [Jeep, DJMaesen](https://sketchfab.com/3d-models/jeep-8dd9a0b3faa84aaa813431b44c716a6d) | 18.400 triangoli, mappe 2K e CC Attribution dichiarati. Candidato interessante, ancora da scaricare e verificare. |
| Jeep | [VEHICLE – JEEP WRANGLER, Thcyrax](https://sketchfab.com/3d-models/vehicle-jeep-wrangler-5c090410ea544b72a6d265d1ede55795) | 5.600 triangoli, ruote separate, CC Attribution dichiarato: candidato leggero. |
| Cross | [Sherco Motocross, Dakta.Grower.Nzl](https://sketchfab.com/3d-models/sherco-motocross-36f6ff00c6294bfcb0832bc68f8bade8) | Candidato con CC Attribution dichiarato, dettaglio e gerarchia da verificare prima dell'importazione. |
| Blindato | [Armored Vehicle APC, azoz@toji](https://sketchfab.com/3d-models/armored-vehicle-apc-game-ready-asset-a675f6ebb65e4d7493cd6a677c237213) | 200.000 triangoli e mappe PBR 2K dichiarati: richiede ottimizzazione e verifica della provenienza. Non inserito nel gioco. |
| Rambo 4×4 | Modello attuale | Conservato, per mantenere l'identità specifica del mezzo. |
| Carro armato | Modello attuale | Conservato; nessun candidato sufficientemente verificato in questa iterazione. |

Nessun acquisto o accesso ad account di marketplace è stato effettuato. I termini indicati per i candidati sono quelli mostrati dalle rispettive pagine, non una verifica dei file o dei diritti sull'opera rappresentata.

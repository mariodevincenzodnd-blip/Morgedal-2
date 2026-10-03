# Morgedal — Standard tecnico delle schede personaggio

Questo file definisce le regole comuni da mantenere per tutte le schede esistenti e future.

## 1. File Drive canonico unico

Ogni personaggio usa **un solo file JSON ufficiale condiviso su Google Drive**.

- Master e Player leggono e scrivono lo stesso file.
- Non creare copie personali del JSON come normale flusso di lavoro.
- Se esiste una vecchia copia personale, può essere migrata una sola volta nel file ufficiale; poi il browser deve restare collegato al file canonico.
- In caso di errore di scrittura sul file ufficiale, mostrare l'errore: non creare silenziosamente un duplicato.

## 2. Modello Player / Master

La correzione introdotta per AGGRON/Rocco è una regola generale, non un'eccezione.

### Player
Il Player deve poter usare e modificare i dati operativi necessari in sessione, tra cui:
- punteggi/valori operativi previsti dalla scheda;
- modificatori manuali operativi;
- tiri salvezza e abilità dove previsti dal modello corrente;
- PF correnti, PF temporanei e massimo operativo dei PFT;
- utilizzi degli slot;
- risorse e tracker;
- Attacchi / Incantesimi di Prima Utilità;
- campi operativi di equipaggiamento e inventario;
- immagini operative dove già consentite dal modello.

### Editor Master
Restano protetti e modificabili soltanto con Editor Master:
- PF massimi normali;
- massimi degli slot;
- capacità massima inventario;
- struttura della scheda;
- categorie;
- testi canonici strutturali;
- aggiunta/rimozione di riquadri o elementi strutturali;
- dimensioni, visibilità e configurazioni Master.

L'Editor Master deve partire **spento** anche quando accede il proprietario.

### Formattazione testo nell'Editor Master

Quando l'Editor Master è attivo, le aree di testo ricco modificabili devono offrire una toolbar di formattazione comune, senza introdurre un secondo sistema di salvataggio.

La toolbar deve consentire almeno:
- scelta del font;
- grassetto, corsivo e sottolineato;
- dimensione numerica del carattere e pulsanti di aumento/riduzione;
- colore del testo;
- evidenziatore/colore di sfondo del testo;
- rimozione della formattazione;
- annulla/ripristina quando supportati dal browser.

Regole:
- la toolbar è visibile e utilizzabile **solo con Editor Master attivo**;
- la formattazione si applica al testo selezionato dentro un'area contenteditable;
- il contenuto formattato resta HTML della stessa proprietà già gestita dalla scheda e deve passare dagli stessi listener input e dallo stesso queueSave() esistenti;
- non creare storage, file o salvataggi paralleli per la sola formattazione;
- i Player vedono la resa formattata già salvata ma non ricevono la toolbar Master.


### Tracker PF / PF temporanei
Il blocco dei **PF temporanei** deve essere una copia visiva speculare del blocco dei PF correnti:
- titolo **PUNTI FERITA TEMPORANEI** con la stessa tipografia, grandezza, bordo e impaginazione di **PUNTI FERITA**;
- stessa riga controlli: **− | valore | / | riquadro di riferimento | +**;
- i due riquadri numerici devono essere identici per dimensione e stile a quelli dei PF normali;
- la barra orizzontale deve avere stessa altezza, stessa lunghezza e stesso allineamento della barra PF;
- colore dinamico distinto per i PFT: a **PFT massimi** la barra è **blu elettrico**; scendendo, il colore sfuma in modo continuo verso il **celeste** (riferimento visivo alla metà) e poi verso il **verde acqua/turchese** a `floor(PFT max / 3)`; sotto un terzo resta verde acqua fino a zero, senza scatti cromatici;
- il secondo riquadro dei PFT rappresenta il **massimo operativo dei PFT** ed è modificabile sia dal Player sia dal Master;
- i PFT correnti non possono superare il massimo PFT impostato; la barra PFT usa questo massimo come propria scala ed è indipendente dai PF massimi normali;
- per i salvataggi precedenti privi del nuovo campo, il massimo PFT viene inizializzato una sola volta al precedente valore di riferimento (PF massimi), così da preservare il comportamento visivo esistente fino alla prima modifica.

### Colore dinamico della barra PF
La barra dei PF normali usa una scala cromatica progressiva che comunica visivamente lo stato di salute senza modificare alcun dato canonico:
- a **PF massimi** il colore tende al **verde acqua/turchese**, vicino alla famiglia cromatica dei PFT ma distinto da essa;
- scendendo dai PF massimi, il turchese sfuma gradualmente verso il **verde**;
- intorno al **75% dei PF massimi** il riferimento cromatico è verde;
- da lì la barra passa progressivamente al **giallo/arancione**, raggiungendo l'**arancione** a `floor(PF max / 2)`;
- tra la metà e `floor(PF max / 3)` la barra sfuma progressivamente dall'arancione al **rosso**;
- sotto il terzo la barra continua a scurirsi verso un **rosso sangue profondo**;
- gli **ultimi 10 PF**, quando compatibili con le soglie del personaggio, usano il rosso sangue più denso come stato di massimo pericolo.

Le soglie vengono sempre ricalcolate quando cambia il valore dei PF massimi. Per personaggi con un massimo PF molto basso, la soglia finale viene compressa automaticamente per mantenere l'ordine cromatico e non sovrapporsi in modo incoerente alle soglie percentuali.

### Etichetta delle riserve di slot

La dicitura mostrata accanto agli slot deve riflettere la struttura reale della riserva:
- se la scheda usa **una sola riserva complessiva di slot**, senza suddivisione per livelli, **non mostrare alcuna etichetta accanto ai pallini**: l'intestazione della sezione è già sufficiente;
- se la scheda usa **più riserve distinte per livello**, le diciture restano **Livello 1**, **Livello 2**, **Livello 3**, ecc.;
- la regola è strutturale e vale per tutte le schede esistenti e future: non trasformare una riserva unica in un fittizio "Livello 1".
- il controllo numerico che modifica il numero massimo di slot non mostra la parola **max** ed è renderizzato **solo con Editor Master attivo**; i giocatori vedono e consumano/ripristinano i pallini esistenti ma non possono aumentare o ridurre la capacità della riserva;
- la stessa regola vale per ogni blocco di slot secondario o temporaneo, comprese le riserve di slot temporanei nelle trasformazioni.

## 3. OAuth e sessione Google

- Scope condiviso: Drive completo + userinfo.email.
- La Home e le schede devono usare la stessa sessione OAuth compatibile.
- Evitare loop Home → scheda → verifica → Home.
- Autenticazione Google e stato Editor Master sono due cose diverse.
- Il proprietario può aprire tutte le schede senza diventare automaticamente Editor Master.

## 4. Identità del Player

Ogni scheda deve avere un solo account Player autorizzato, salvo decisione esplicita del Master di autorizzarne più di uno.

Non indovinare associazioni email ↔ personaggio: inserirle solo quando confermate.

## 5. Storage locale

Ogni personaggio deve usare una chiave locale distinta, ad esempio:
- katan-sheet-v1
- ervork-sheet-v1
- aggron-sheet-v1

Mai riutilizzare la chiave di un altro personaggio.

## 6. Regola per nuove schede

Ogni nuova scheda deve nascere già con:
- file Drive canonico dedicato;
- STORAGE_KEY univoca;
- modello Player/Master sopra descritto;
- OAuth condiviso corrente;
- nessuna copia personale automatica;
- Home aggiornata;
- sintassi JavaScript verificata;
- test dei campi operativi Player e dei massimi Master-only.

### Persistenza e riapertura

Tutte le schede usano `assets/sheet-persistence.js`, con adattatori alle proprietà già esistenti. Le nuove schede devono usare lo stesso modulo.

- Caricare il JSON ufficiale prima di consentire scritture su Drive: default e caricamenti falliti non sono dati da sincronizzare.
- Avviare un solo salvataggio alla volta; acquisire uno snapshot prima di qualsiasi attesa e usarlo anche per i backup secondari.
- Confermare “Salvato su Drive” soltanto dopo la scrittura Drive della versione più recente. Un backup secondario riuscito non equivale a Drive sincronizzato.
- Conservare un journal temporaneo delle modifiche pendenti, distinto per file, account e scheda del browser, senza token o stato di sblocco Master. Rimuoverlo dopo la conferma della versione inviata.
- Alla riapertura recuperare il journal; se Drive contiene una versione diversa, chiedere quale versione usare e consentire di esportare il backup. Nessuna sovrascrittura automatica in caso di conflitto.
- Prima di scrivere confrontare la versione Drive con quella caricata; usare Web Locks quando disponibili per coordinare schede della stessa origine. Questa protezione non costituisce una transazione atomica tra dispositivi diversi.
- Non effettuare PATCH per pagine senza nuove modifiche. Ignorare i caricamenti arrivati dopo una modifica locale.
- Rileggere Drive al ritorno dalla cache avanti/indietro; attendere le modifiche pendenti prima dei collegamenti interni e conservarle anche in caso di reload/chiusura.
- Una vecchia copia personale non può sostituire automaticamente il JSON ufficiale: un'importazione scelta dall'utente passa dal normale salvataggio protetto.
- Verificare `node --test .github/scripts/persistence.test.cjs` e `.github/scripts/persistence-browser.mjs`, usando soltanto dati e richieste simulate.

### CD dei Trucchetti e quantità tramite pallini

- Chiarimento di Mario successivo alla PR #19: accanto a **Trucchetto** deve comparire soltanto la CD, non la dicitura Quantità né il numero di utilizzi. Il badge deve essere compatto, della larghezza del contenuto, anche in Editor Master. Le 12 schede usano `assets/trick-metadata.js`.
- La quantità è implicita nei pallini e resta regolata manualmente dai controlli Master esistenti. Non dedurre, aggiungere o modificare quantità, pallini o slot. Le condizioni d'uso e i riposi rimangono separati dal badge.
- È una proiezione del contenuto esistente, non una migrazione automatica: caricamento e rendering non cambiano né salvano il JSON. La CD viene letta da `uso` o dalla descrizione. Nessuna CD assente viene dedotta dalla CD generale delle abilità.
- Spostare l'intero qualificatore insieme al valore: CD variabile, CD per uccidere, CD relativa a Caos e CD dei tiri salvezza rimangono distinguibili. I TS senza dicitura CD restano nella descrizione.
- Le CD spostate non sono ripetute nel corpo del Trucchetto; il resto del testo e la formattazione vengono conservati. Rimuovere le quantità esplicite dalla presentazione del corpo soltanto se sono già presenti i pallini collegati; altrimenti conservare l'informazione esistente.
- L'Editor Master può modificare il campo CD. Soltanto una modifica esplicita della CD o della descrizione consolida i metadati in `uso`, conservandone la quantità e le condizioni esistenti, passando dallo stesso `queueSave` e dalle protezioni di persistenza esistenti.
- Verificare `.github/scripts/trick-metadata-browser.mjs`: Player/Master, desktop/mobile, assenza di scritture al caricamento, CD condizionali/variabili, rich text e salvataggio/ricaricamento, esclusivamente con Drive simulato.

## 7. Principio assoluto sulle fonti

Per nomi, testi, descrizioni, poteri, abilità, oggetti, inventario e classificazioni canoniche:

1. usare come fonte primaria la **scheda originale del singolo personaggio su Google Drive** per i dati specifici del PG;
2. usare **LAPSUS DEUS** come fonte primaria per canone generale, lore e grafia corretta dei nomi;
3. non inventare contenuti mancanti;
4. non riassumere, parafrasare, abbreviare o "migliorare" i testi canonici;
5. non ricostruire da memoria ciò che non è presente nelle fonti;
6. quando un elemento viene spostato, rimuoverlo dalla vecchia sezione: **spostare non significa duplicare**;
7. l'unica area in cui sono consentite micro-descrizioni operative è **Attacchi e Incantesimi di Prima Utilità**;
8. se una fonte necessaria manca o due fonti sono in conflitto, non scegliere autonomamente: fermarsi su quella voce e chiedere al Master.

Questa regola vale per tutte le schede esistenti e future.


### Interfaccia Poteri di Katan — prova delle fasce espandibili

Su richiesta esplicita di Mario, soltanto Katan usa tre fasce inizialmente chiuse dopo gli slot: Trucchetti, Abilità e Passive. Ogni voce ha una vista compatta con un breve riepilogo di visualizzazione e gli utilizzi esistenti; la freccia della voce apre il testo completo e gli utilizzi in fondo. Questa richiesta autorizza i riepiloghi in questa interfaccia di Katan, senza sostituire o abbreviare il testo canonico salvato. I riepiloghi predefiniti sono legati alla descrizione verificata; dopo una modifica del Master si usa un estratto del testo corrente.

- Entrambe le viste leggono gli stessi indici di `STATE.risorse` e salvano tramite il `queueSave` esistente. Nessuna migrazione, unificazione o nuovo contatore al rendering.
- I tracker degli utilizzi particolari sono presentati dentro l'abilità o passiva corrispondente, preservando tutti i contatori e gli stati già presenti. Per Superabilità è visibile anche il richiamo all'uso simultaneo delle caratteristiche. I due contatori preesistenti Super Abilità / SUPERABILITÀ restano distinti in attesa di un chiarimento di Mario.
- Apertura e chiusura dei menu sono solo stato temporaneo dell'interfaccia; restano stabili durante il rerender dei pallini e non scrivono sul JSON. Le descrizioni complete e i controlli Master esistenti sono conservati.
- Le altre undici schede restano con l'interfaccia corrente fino alla valutazione di Mario. Test: `.github/scripts/katan-power-browser.mjs`, soltanto Drive simulato.

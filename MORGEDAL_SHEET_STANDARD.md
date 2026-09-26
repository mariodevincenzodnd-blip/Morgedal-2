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
- PF correnti e PF temporanei;
- utilizzi degli slot;
- risorse e tracker;
- Attacchi / Incantesimi di Prima Utilità;
- campi operativi di equipaggiamento e inventario;
- immagini operative dove già consentite dal modello.

### Editor Master
Restano protetti e modificabili soltanto con Editor Master:
- PF massimi;
- massimi degli slot;
- capacità massima inventario;
- struttura della scheda;
- categorie;
- testi canonici strutturali;
- aggiunta/rimozione di riquadri o elementi strutturali;
- dimensioni, visibilità e configurazioni Master.

L'Editor Master deve partire **spento** anche quando accede il proprietario.

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

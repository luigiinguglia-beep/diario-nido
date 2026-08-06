# Diario Nido

Web app **gratuita al 100%** per asili nido e scuole dell'infanzia, con tre ruoli:

| Ruolo | Cosa fa |
|---|---|
| **Genitore** | Vede dal telefono il diario della giornata del proprio bimbo: presenza, attività, foto, avvisi. Può scrivere messaggi alla scuola (con conferma di lettura). |
| **Educatore** | Registra entrata/uscita, attività (pasto, nanna, cambio, gioco, note) e carica foto in pochi tap. |
| **Amministratore** | Gestisce sezioni, bambini, utenti, associazioni genitore-figlio e pubblica avvisi. |

## Architettura (costo: zero)

- **Database** → un Foglio Google (ogni scheda è una tabella)
- **Foto** → una cartella privata su Google Drive (le foto NON sono pubbliche: vengono servite dal backend solo agli utenti autorizzati)
- **Backend + hosting** → Google Apps Script (Web App)
- **Accesso** → ogni utente ha un *codice personale* assegnato dall'amministratore; il genitore vede **solo** i propri figli

## Installazione (10 minuti)

1. Vai su [sheets.new](https://sheets.new) e crea un foglio chiamato `DiarioNido`.
2. Menu **Estensioni → Apps Script**.
3. Nel progetto Apps Script crea questi file e incolla il contenuto della cartella `apps-script/` di questo repository:
   - `Setup.gs`
   - `Code.gs`
   - `Index.html` (in Apps Script: **+ → HTML**, nominalo `Index`)
4. Dall'editor esegui **una sola volta** la funzione `setupIniziale` (file `Setup.gs`) e autorizza i permessi richiesti. Questo crea tutte le schede del foglio, la cartella Drive per le foto e il tuo utente amministratore.
5. Apri la scheda `Utenti` del foglio e **cambia subito il codice** dell'amministratore (colonna `Codice`).
6. **Implementa → Nuova implementazione → App web**:
   - *Esegui come*: **Me**
   - *Chi può accedere*: **Chiunque**
7. Copia l'URL della web app e condividilo con educatori e genitori insieme al loro codice personale (che crei tu dalla sezione **Gestione** dell'app).

Sul telefono: aprendo l'URL in Chrome/Safari si può usare "Aggiungi a schermata Home" per avere l'icona come una vera app.

## Privacy (punti essenziali)

- Il flag **ConsensoFoto** per ogni bambino blocca il caricamento di foto se il consenso non è stato dato.
- Le foto restano in una cartella Drive privata del titolare: nessun link pubblico.
- Ogni genitore vede esclusivamente i dati dei bambini a lui associati.
- Raccogli i consensi scritti dei genitori (informativa privacy) prima di attivare le foto.

## Limiti noti e prossimi passi

- Adatto a un pilota (una struttura, fino a ~50 bambini). Oltre, conviene migrare a un database vero (es. Postgres): il modello dati è già pronto per l'export in CSV.
- Niente notifiche push: i genitori aprono l'app per vedere le novità (fase 2: email automatiche con `MailApp`).
- Fase 2: calendario eventi, questionari, gestione personale, fatturazione.

---

*Progetto originale e indipendente, non affiliato ad alcun prodotto commerciale.*

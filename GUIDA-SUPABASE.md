# Diario Nido — Versione Supabase (consigliata)

Questa è la versione "prodotto" dell'app: database vero, login sicuro, foto private.
Tutto sul **piano gratuito** di Supabase (500 MB database, 1 GB foto — più che sufficienti per una struttura).

La versione Google Apps Script nella cartella `apps-script/` resta come alternativa/prototipo.

---

## 1. Prepara il database (5 minuti)

1. Apri il tuo progetto su [supabase.com](https://supabase.com) → **SQL Editor** → **New query**
2. Copia TUTTO il contenuto di `supabase/schema.sql` e incollalo
3. Premi **Run**. Deve finire senza errori: crea tabelle, regole di sicurezza e l'archivio foto privato

## 2. Configura l'app (2 minuti)

1. Dashboard Supabase → **Settings → API**
2. Copia **Project URL** e **anon public key**
3. Apri `webapp/config.js` e incolla i due valori

## 3. Semplifica la registrazione (facoltativo ma consigliato)

Dashboard → **Authentication → Providers → Email** → disattiva **Confirm email**.
Così genitori ed educatori entrano subito dopo la registrazione, senza email di conferma.

## 4. Crea il tuo account amministratore

1. Apri l'app (vedi punto 5) e **registrati** con la tua email
2. Torna nel **SQL Editor** ed esegui (con la tua email):

```sql
update public.profiles set ruolo = 'amministratore'
where email = 'tua_email@esempio.it';
```

3. Esci e rientra nell'app: vedrai la scheda **Gestione**

## 5. Pubblica l'app gratis

**Opzione consigliata — Vercel (gratis, funziona con repository privati):**

1. Vai su [vercel.com](https://vercel.com) → registrati con GitHub (piano Hobby, gratuito)
2. **Add New → Project** → importa il repository `diario-nido`
3. In **Root Directory** scegli la cartella `webapp`
4. **Deploy** → ottieni un indirizzo tipo `https://diario-nido.vercel.app`

Per provare in locale, prima del deploy: apri semplicemente `webapp/index.html` nel browser.

## 6. Avvia la scuola

1. **Gestione** → crea le sezioni → aggiungi i bambini (spunta il consenso foto solo se firmato)
2. Fai registrare educatori e genitori nell'app con le loro email
3. **Gestione → Cambia ruolo** → promuovi gli educatori
4. **Gestione → Associa genitore** → collega ogni genitore ai suoi bambini

---

## Come funziona la sicurezza

- Le regole sono nel **database** (Row Level Security), non solo nell'app: un genitore può leggere SOLO i dati dei propri figli, anche se provasse a interrogare il database direttamente
- Le foto stanno in un archivio **privato**: vengono mostrate tramite link temporanei validi 1 ora, solo agli aventi diritto
- Le foto vengono compresse sul telefono prima del caricamento (~150-300 KB): in 1 GB gratuito ci stanno migliaia di foto
- Caricamento foto **bloccato** per i bambini senza consenso firmato

## Da sapere sul piano gratuito

- I progetti gratuiti vanno **in pausa dopo 1 settimana senza utilizzo** (ripristinabili con un click per 90 giorni). Durante l'anno scolastico non succede; prima della chiusura estiva fai un export dei dati (Database → Backups o SQL Editor) e a settembre riattiva il progetto dalla dashboard

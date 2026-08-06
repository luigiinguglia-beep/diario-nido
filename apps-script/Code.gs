/**
 * DIARIO NIDO — Backend (Google Apps Script)
 * Presenze, diario di bordo, foto, avvisi e messaggi per nidi e scuole 0-6.
 * Ruoli: admin, educatore, genitore. Accesso tramite codice personale.
 */

var SS = function () { return SpreadsheetApp.getActiveSpreadsheet(); };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Diario Nido')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- Utility ---------- */

function leggi_(nome) {
  var valori = SS().getSheetByName(nome).getDataRange().getValues();
  var testata = valori.shift();
  return valori
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      var o = {};
      testata.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function aggiungi_(nome, riga) { SS().getSheetByName(nome).appendRow(riga); }
function low_(v) { return String(v || '').trim().toLowerCase(); }
function oggi_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function ora_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'); }
function adesso_() { return oggi_() + ' ' + ora_(); }

/* ---------- Autenticazione e permessi ---------- */

function utente_(codice) {
  if (!codice) throw new Error('Inserisci il tuo codice personale.');
  var u = leggi_('Utenti').filter(function (x) { return String(x.Codice) === String(codice).trim(); })[0];
  if (!u) throw new Error('Codice non valido.');
  return u;
}

function richiedi_(codice, ruoli) {
  var u = utente_(codice);
  if (ruoli.indexOf(u.Ruolo) === -1) throw new Error('Non hai i permessi per questa operazione.');
  return u;
}

function bambiniDiGenitore_(email) {
  var ids = leggi_('BambinoGenitore')
    .filter(function (a) { return low_(a.EmailGenitore) === low_(email); })
    .map(function (a) { return String(a.BambinoID); });
  return leggi_('Bambini').filter(function (b) { return ids.indexOf(String(b.ID)) !== -1; });
}

function autorizzaBambino_(u, bambinoId) {
  if (u.Ruolo !== 'genitore') return;
  var miei = bambiniDiGenitore_(u.Email).map(function (b) { return String(b.ID); });
  if (miei.indexOf(String(bambinoId)) === -1) throw new Error('Non sei autorizzato su questo bambino.');
}

/* ---------- Contesto iniziale per la UI ---------- */

function getContesto(codice) {
  var u = utente_(codice);
  var ctx = { email: u.Email, nome: u.Nome, ruolo: u.Ruolo, sezioni: leggi_('Sezioni') };
  ctx.bambini = (u.Ruolo === 'genitore') ? bambiniDiGenitore_(u.Email) : leggi_('Bambini');
  return ctx;
}

/* ---------- Presenze (educatore/admin) ---------- */

function registraPresenza(codice, bambinoId, tipo) {
  var u = richiedi_(codice, ['educatore', 'admin']);
  var sh = SS().getSheetByName('Presenze');
  var dati = sh.getDataRange().getValues();
  var data = oggi_();
  var i;
  if (tipo === 'entrata') {
    for (i = 1; i < dati.length; i++) {
      if (String(dati[i][0]) === data && String(dati[i][1]) === String(bambinoId)) {
        throw new Error('Entrata già registrata oggi.');
      }
    }
    aggiungi_('Presenze', [data, String(bambinoId), ora_(), '', u.Nome]);
    return 'Entrata registrata alle ' + ora_();
  }
  for (i = dati.length - 1; i >= 1; i--) {
    if (String(dati[i][0]) === data && String(dati[i][1]) === String(bambinoId)) {
      sh.getRange(i + 1, 4).setValue(ora_());
      return 'Uscita registrata alle ' + ora_();
    }
  }
  throw new Error('Nessuna entrata registrata oggi per questo bambino.');
}

function getPresenzeOggi(codice) {
  richiedi_(codice, ['educatore', 'admin']);
  var data = oggi_();
  return leggi_('Presenze').filter(function (p) { return String(p.Data) === data; });
}

/* ---------- Diario di bordo (educatore/admin) ---------- */

function registraAttivita(codice, bambinoId, tipo, descrizione) {
  var u = richiedi_(codice, ['educatore', 'admin']);
  aggiungi_('Attivita', [adesso_(), String(bambinoId), tipo, descrizione || '', u.Nome]);
  return 'Attività registrata.';
}

/* ---------- Foto (educatore carica, genitore vede solo i suoi) ---------- */

function caricaFoto(codice, bambinoId, base64, tipoMime, nomeFile, didascalia) {
  var u = richiedi_(codice, ['educatore', 'admin']);
  var b = leggi_('Bambini').filter(function (x) { return String(x.ID) === String(bambinoId); })[0];
  if (!b) throw new Error('Bambino non trovato.');
  if (low_(b.ConsensoFoto) !== 'si') throw new Error('Manca il consenso foto per ' + b.Nome + '.');
  var idCartella = PropertiesService.getScriptProperties().getProperty('FOTO_FOLDER_ID');
  if (!idCartella) throw new Error('Esegui prima setupIniziale().');
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), tipoMime, nomeFile || ('foto-' + Date.now() + '.jpg'));
  var file = DriveApp.getFolderById(idCartella).createFile(blob);
  aggiungi_('Foto', [adesso_(), String(bambinoId), String(b.SezioneID), file.getId(), didascalia || '', u.Nome]);
  return 'Foto caricata.';
}

function getFotoBase64(codice, fileId) {
  var u = utente_(codice);
  var meta = leggi_('Foto').filter(function (f) { return String(f.FileID) === String(fileId); })[0];
  if (!meta) throw new Error('Foto non trovata.');
  autorizzaBambino_(u, meta.BambinoID);
  var blob = DriveApp.getFileById(fileId).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/* ---------- Feed del genitore ---------- */

function getFeed(codice, bambinoId) {
  var u = utente_(codice);
  autorizzaBambino_(u, bambinoId);
  var b = leggi_('Bambini').filter(function (x) { return String(x.ID) === String(bambinoId); })[0];
  if (!b) throw new Error('Bambino non trovato.');
  var limite = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  var recente = function (ts) { return new Date(String(ts).replace(' ', 'T')) >= limite; };
  return {
    presenzaOggi: leggi_('Presenze').filter(function (p) {
      return String(p.Data) === oggi_() && String(p.BambinoID) === String(bambinoId);
    })[0] || null,
    attivita: leggi_('Attivita').filter(function (a) {
      return String(a.BambinoID) === String(bambinoId) && recente(a.Timestamp);
    }).reverse(),
    foto: leggi_('Foto').filter(function (f) {
      return String(f.BambinoID) === String(bambinoId) && recente(f.Timestamp);
    }).reverse(),
    avvisi: leggi_('Avvisi').filter(function (av) {
      return av.Destinatario === 'tutti' ||
        av.Destinatario === 'sezione:' + b.SezioneID ||
        av.Destinatario === 'bambino:' + bambinoId;
    }).reverse()
  };
}

/* ---------- Avvisi ---------- */

function inviaAvviso(codice, titolo, testo, destinatario) {
  var u = richiedi_(codice, ['educatore', 'admin']);
  if (!titolo || !testo) throw new Error('Titolo e testo sono obbligatori.');
  aggiungi_('Avvisi', [adesso_(), titolo, testo, destinatario || 'tutti', u.Nome]);
  return 'Avviso pubblicato.';
}

/* ---------- Messaggi con conferma di lettura ---------- */

function inviaMessaggio(codice, aEmail, testo) {
  var u = utente_(codice);
  if (!aEmail || !testo) throw new Error('Destinatario e testo sono obbligatori.');
  aggiungi_('Messaggi', [adesso_(), u.Email, aEmail, testo, '']);
  return 'Messaggio inviato.';
}

function getMessaggi(codice) {
  var u = utente_(codice);
  var sh = SS().getSheetByName('Messaggi');
  var dati = sh.getDataRange().getValues();
  var miei = [];
  for (var i = 1; i < dati.length; i++) {
    var daMe = low_(dati[i][1]) === low_(u.Email);
    var perMe = low_(dati[i][2]) === low_(u.Email);
    if (daMe || perMe) {
      if (perMe && !dati[i][4]) sh.getRange(i + 1, 5).setValue(adesso_()); // conferma di lettura
      miei.push({ Timestamp: dati[i][0], Da: dati[i][1], A: dati[i][2], Testo: dati[i][3], LettoIl: dati[i][4] });
    }
  }
  return miei;
}

function getContatti(codice) {
  var u = utente_(codice);
  var utenti = leggi_('Utenti').map(function (x) { return { Email: x.Email, Nome: x.Nome, Ruolo: x.Ruolo }; });
  if (u.Ruolo === 'genitore') {
    return utenti.filter(function (x) { return x.Ruolo !== 'genitore'; });
  }
  return utenti.filter(function (x) { return low_(x.Email) !== low_(u.Email); });
}

/* ---------- Gestione (solo admin) ---------- */

function aggiungiSezione(codice, nome) {
  richiedi_(codice, ['admin']);
  if (!nome) throw new Error('Nome sezione obbligatorio.');
  aggiungi_('Sezioni', ['S' + Date.now(), nome]);
  return 'Sezione creata.';
}

function aggiungiBambino(codice, nome, dataNascita, sezioneId, consensoFoto) {
  richiedi_(codice, ['admin']);
  if (!nome || !sezioneId) throw new Error('Nome e sezione sono obbligatori.');
  aggiungi_('Bambini', ['B' + Date.now(), nome, dataNascita || '', String(sezioneId), consensoFoto ? 'si' : 'no']);
  return 'Bambino aggiunto.';
}

function aggiungiUtente(codice, email, nome, ruolo, codicePersonale) {
  richiedi_(codice, ['admin']);
  if (['admin', 'educatore', 'genitore'].indexOf(ruolo) === -1) throw new Error('Ruolo non valido.');
  if (!email || !nome || !codicePersonale) throw new Error('Email, nome e codice sono obbligatori.');
  if (leggi_('Utenti').some(function (x) { return String(x.Codice) === String(codicePersonale); })) {
    throw new Error('Codice già in uso: scegline un altro.');
  }
  aggiungi_('Utenti', [email, nome, ruolo, String(codicePersonale)]);
  return 'Utente creato. Comunicagli il suo codice personale.';
}

function associaGenitore(codice, bambinoId, emailGenitore) {
  richiedi_(codice, ['admin']);
  if (!bambinoId || !emailGenitore) throw new Error('Bambino ed email del genitore sono obbligatori.');
  aggiungi_('BambinoGenitore', [String(bambinoId), emailGenitore]);
  return 'Genitore associato al bambino.';
}

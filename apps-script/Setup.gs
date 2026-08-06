/**
 * DIARIO NIDO — Setup iniziale
 * Eseguire setupIniziale() UNA SOLA VOLTA dall'editor di Apps Script,
 * con il Foglio Google collegato al progetto.
 */

function setupIniziale() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schema = {
    Utenti: ['Email', 'Nome', 'Ruolo', 'Codice'],
    Sezioni: ['ID', 'Nome'],
    Bambini: ['ID', 'Nome', 'DataNascita', 'SezioneID', 'ConsensoFoto'],
    BambinoGenitore: ['BambinoID', 'EmailGenitore'],
    Presenze: ['Data', 'BambinoID', 'OraEntrata', 'OraUscita', 'RegistrataDa'],
    Attivita: ['Timestamp', 'BambinoID', 'Tipo', 'Descrizione', 'Educatore'],
    Foto: ['Timestamp', 'BambinoID', 'SezioneID', 'FileID', 'Didascalia', 'CaricataDa'],
    Avvisi: ['Timestamp', 'Titolo', 'Testo', 'Destinatario', 'Autore'],
    Messaggi: ['Timestamp', 'Da', 'A', 'Testo', 'LettoIl']
  };

  Object.keys(schema).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    sh.getRange('A:Z').setNumberFormat('@'); // tutto testo: evita conversioni automatiche di date e orari
    if (sh.getLastRow() === 0) sh.appendRow(schema[nome]);
    sh.setFrozenRows(1);
  });

  // Rimuove il foglio vuoto predefinito, se presente
  var predefinito = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (predefinito && ss.getSheets().length > 1) ss.deleteSheet(predefinito);

  // Cartella Drive PRIVATA per le foto
  var prop = PropertiesService.getScriptProperties();
  if (!prop.getProperty('FOTO_FOLDER_ID')) {
    var cartella = DriveApp.createFolder('DiarioNido_Foto');
    prop.setProperty('FOTO_FOLDER_ID', cartella.getId());
  }

  // Primo amministratore — CAMBIARE SUBITO il codice nella scheda Utenti!
  var utenti = ss.getSheetByName('Utenti');
  if (utenti.getLastRow() === 1) {
    utenti.appendRow([Session.getActiveUser().getEmail(), 'Amministratore', 'admin', 'cambia-questo-codice']);
  }

  return 'Setup completato. Cambia il codice admin nella scheda Utenti e poi pubblica la web app.';
}

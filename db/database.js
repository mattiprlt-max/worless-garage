const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'garage.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations — colonnes ajoutées après création initiale
try { db.exec("ALTER TABLE appels ADD COLUMN type_appel TEXT DEFAULT 'autre'"); } catch(e) {}
try { db.exec("ALTER TABLE appels ADD COLUMN statut_appel TEXT DEFAULT 'a_rappeler'"); } catch(e) {}
try { db.exec("ALTER TABLE interventions ADD COLUMN rdv_token TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE interventions ADD COLUMN date_rdv_client TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE interventions ADD COLUMN message_rdv_client TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE clients ADD COLUMN email TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE clients ADD COLUMN type_client TEXT DEFAULT 'Particulier'"); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    telephone TEXT,
    email TEXT,
    type_client TEXT DEFAULT 'Particulier',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    vehicule TEXT,
    probleme TEXT,
    statut TEXT DEFAULT 'À traiter',
    type_client TEXT DEFAULT 'Particulier',
    montant_devis REAL,
    resume_appel TEXT,
    date_intervention DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    numero_appelant TEXT,
    duree INTEGER,
    transcription TEXT,
    resume_ia TEXT,
    lu INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS avis_google (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auteur TEXT,
    note INTEGER,
    contenu TEXT,
    reponse_ia TEXT,
    publie INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intervention_id INTEGER REFERENCES interventions(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id),
    message TEXT,
    telephone TEXT,
    envoye INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rappels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intervention_id INTEGER REFERENCES interventions(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id),
    message TEXT,
    date_rappel DATETIME,
    envoye INTEGER DEFAULT 0,
    date_envoi DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;

const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Normalise un numéro de téléphone français en chiffres seuls, sans indicatif
// +33651683187 → 0651683187 | 06 51 68 31 87 → 0651683187
function normalizePhone(num) {
  if (!num) return '';
  const digits = String(num).replace(/[\s\-\.\(\)]/g, '');
  if (digits.startsWith('+33')) return '0' + digits.slice(3);
  if (digits.startsWith('0033')) return '0' + digits.slice(4);
  return digits;
}

// Webhook Retell via n8n — nouvel appel entrant
router.post('/retell', (req, res) => {
  const { numero_appelant, duree, transcription, resume_ia, nom_client, type_appel, client_connu } = req.body;

  // Chercher le client par téléphone (normalisation format FR ↔ international)
  let client_id = null;
  const phoneNorm = normalizePhone(numero_appelant);
  if (phoneNorm) {
    const client = db.prepare(`
      SELECT id, nom FROM clients
      WHERE CASE
        WHEN telephone LIKE '+33%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 4)
        WHEN telephone LIKE '0033%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 5)
        ELSE REPLACE(REPLACE(telephone,' ',''),'-','')
      END = ?
    `).get(phoneNorm);
    if (client) {
      client_id = client.id;
      // Mettre à jour le nom si Léa a capturé un nom différent (plus précis)
      if (nom_client && nom_client.trim() && nom_client.trim().toLowerCase() !== client.nom.toLowerCase()) {
        db.prepare('UPDATE clients SET nom = ? WHERE id = ?').run(nom_client.trim(), client_id);
        console.log(`✏️ Nom mis à jour : ${client.nom} → ${nom_client}`);
      }
    }
  }

  // Si client non trouvé mais on a son nom → créer automatiquement avec son numéro
  if (!client_id && nom_client && nom_client.trim()) {
    const r = db.prepare('INSERT INTO clients (nom, telephone) VALUES (?, ?)').run(
      nom_client.trim(),
      numero_appelant || null
    );
    client_id = r.lastInsertRowid;
    console.log(`👤 Nouveau client créé : ${nom_client} (${numero_appelant})`);
  }

  // Statut : suivi d'un client connu → traité / RDV ou client inconnu → à rappeler
  const statut_appel = (type_appel === 'suivi' && client_connu === true) ? 'traite' : 'a_rappeler';

  const result = db.prepare(`
    INSERT INTO appels (client_id, numero_appelant, duree, transcription, resume_ia, type_appel, statut_appel, lu)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(client_id, numero_appelant, duree, transcription, resume_ia, type_appel || 'autre', statut_appel);

  res.json({ success: true, id: result.lastInsertRowid });
});

// Webhook n8n — nouvel avis Google avec réponse IA générée
router.post('/avis', (req, res) => {
  const { auteur, note, contenu, reponse_ia } = req.body;
  if (!auteur || !contenu) return res.status(400).json({ error: 'auteur et contenu requis' });

  const result = db.prepare(`
    INSERT INTO avis_google (auteur, note, contenu, reponse_ia, publie)
    VALUES (?, ?, ?, ?, 0)
  `).run(auteur, note, contenu, reponse_ia);

  res.json({ success: true, id: result.lastInsertRowid });
});

// Webhook n8n — devis PDF analysé par IA → crée l'intervention
// Payload attendu depuis n8n :
// { nom_client, telephone, email, type_client, vehicule, probleme, montant_devis, date_intervention }
router.post('/devis-pdf', (req, res) => {
  const { nom_client, telephone, email, type_client, vehicule, probleme, montant_devis, date_intervention } = req.body;

  // Chercher le client existant par téléphone ou nom
  let client_id = null;
  if (telephone) {
    const phone = telephone.replace(/\s/g, '');
    const found = db.prepare("SELECT id FROM clients WHERE REPLACE(telephone, ' ', '') = ?").get(phone);
    if (found) client_id = found.id;
  }
  if (!client_id && nom_client) {
    const found = db.prepare('SELECT id FROM clients WHERE LOWER(nom) = LOWER(?)').get(nom_client.trim());
    if (found) client_id = found.id;
  }

  // Créer le client si inexistant
  if (!client_id && nom_client) {
    const r = db.prepare('INSERT INTO clients (nom, telephone, email, type_client) VALUES (?, ?, ?, ?)').run(
      nom_client, telephone || null, email || null, type_client || 'Particulier'
    );
    client_id = r.lastInsertRowid;
  }

  const result = db.prepare(`
    INSERT INTO interventions (client_id, vehicule, probleme, statut, type_client, montant_devis, date_intervention)
    VALUES (?, ?, ?, 'À traiter', ?, ?, ?)
  `).run(
    client_id,
    vehicule || null,
    probleme || 'Importé depuis devis PDF',
    type_client || 'Particulier',
    montant_devis || null,
    date_intervention || null
  );

  const intervention = db.prepare(`
    SELECT i.*, c.nom, c.telephone, c.email
    FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(result.lastInsertRowid);

  console.log(`✅ Intervention créée depuis PDF — ID ${intervention.id} — ${nom_client}`);
  res.json({ success: true, intervention });
});

// Webhook Retell — début d'appel, retourne les variables dynamiques pour l'agent IA
// Retell appelle ce endpoint via "Custom LLM" ou "Dynamic Variables" au call_started
// Payload Retell : { call: { from_number: "+33612345678", call_id: "...", ... } }
router.post('/retell-variables', (req, res) => {
  const fromNumber = req.body?.call?.from_number || req.body?.from_number || '';
  const phone = fromNumber.replace(/[\s\-\.\(\)]/g, '');

  let vars = {
    client_existe: 'false',
    client_nom: '',
    client_vehicule: '',
    client_historique: '',
    client_id: ''
  };

  if (phone) {
    const client = db.prepare(
      "SELECT * FROM clients WHERE REPLACE(REPLACE(REPLACE(telephone, ' ', ''), '-', ''), '.', '') = ?"
    ).get(phone);

    if (client) {
      const derniere = db.prepare(`
        SELECT * FROM interventions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(client.id);

      const stats = db.prepare(
        'SELECT COUNT(*) as total FROM interventions WHERE client_id = ?'
      ).get(client.id);

      vars.client_existe = 'true';
      vars.client_id = String(client.id);
      vars.client_nom = client.nom;
      vars.client_vehicule = derniere?.vehicule || '';
      vars.client_historique = derniere
        ? `Dernière intervention : ${derniere.vehicule || 'véhicule inconnu'} — ${derniere.probleme || ''} (${derniere.statut}). Total : ${stats.total} passage(s).`
        : `${stats.total} passage(s) enregistré(s).`;
    }
  }

  // Retell attend { llm_dynamic_variables: { ... } }
  res.json({ llm_dynamic_variables: vars });
});

// Retell custom tool — recherche client par téléphone pendant l'appel
router.post('/lookup-client', (req, res) => {
  console.log('🔍 lookup-client body:', JSON.stringify(req.body));

  // Retell peut envoyer le numéro dans phone_number (passé par le LLM)
  // ou dans call.from_number (contexte d'appel injecté par Retell)
  const raw = req.body?.phone_number
    || req.body?.call?.from_number
    || req.body?.from_number
    || '';
  const phoneNorm = normalizePhone(raw);
  console.log('🔍 raw:', raw, '→ norm:', phoneNorm);

  if (!phoneNorm) return res.json({ client_existe: 'false' });

  const client = db.prepare(`
    SELECT * FROM clients
    WHERE CASE
      WHEN telephone LIKE '+33%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 4)
      WHEN telephone LIKE '0033%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 5)
      ELSE REPLACE(REPLACE(telephone,' ',''),'-','')
    END = ?
  `).get(phoneNorm);

  if (!client) return res.json({ client_existe: 'false' });

  const derniere = db.prepare(
    'SELECT * FROM interventions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(client.id);

  res.json({
    client_existe: 'true',
    client_nom: client.nom,
    vehicule_client: derniere?.vehicule || '',
    statut: derniere?.statut || '',
    historique: derniere
      ? `${derniere.vehicule || 'véhicule'} — ${derniere.probleme || ''} — statut : ${derniere.statut}`
      : 'Aucune intervention enregistrée'
  });
});

router.post('/notification-envoyee', (req, res) => {
  const { notification_id } = req.body;
  if (!notification_id) return res.status(400).json({ error: 'notification_id requis' });
  db.prepare('UPDATE notifications SET envoye = 1 WHERE id = ?').run(notification_id);
  res.json({ success: true });
});

module.exports = router;

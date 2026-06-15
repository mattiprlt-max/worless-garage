const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/clients/by-phone/:tel — sans auth, utilisé par Retell/n8n pour identifier l'appelant
function normalizePhone(num) {
  if (!num) return '';
  const digits = String(num).replace(/[\s\-\.\(\)]/g, '');
  if (digits.startsWith('+33')) return '0' + digits.slice(3);
  if (digits.startsWith('0033')) return '0' + digits.slice(4);
  return digits;
}

router.get('/by-phone/:tel', (req, res) => {
  const phoneNorm = normalizePhone(req.params.tel);
  const client = db.prepare(`
    SELECT * FROM clients
    WHERE CASE
      WHEN telephone LIKE '+33%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 4)
      WHEN telephone LIKE '0033%' THEN '0' || SUBSTR(REPLACE(REPLACE(telephone,' ',''),'-',''), 5)
      ELSE REPLACE(REPLACE(telephone,' ',''),'-','')
    END = ?
  `).get(phoneNorm);

  if (!client) return res.json({ client_existe: false });

  const derniereIntervention = db.prepare(`
    SELECT * FROM interventions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(client.id);

  const stats = db.prepare(`
    SELECT COUNT(*) as total, SUM(montant_devis) as total_depense
    FROM interventions WHERE client_id = ?
  `).get(client.id);

  res.json({
    client_existe: true,
    client_id: client.id,
    nom: client.nom,
    telephone: client.telephone,
    email: client.email || '',
    type_client: client.type_client,
    total_interventions: stats.total,
    derniere_intervention: derniereIntervention ? {
      id: derniereIntervention.id,
      vehicule: derniereIntervention.vehicule || '',
      probleme: derniereIntervention.probleme || '',
      statut: derniereIntervention.statut,
      date: derniereIntervention.date_intervention || derniereIntervention.created_at
    } : null
  });
});

router.get('/search', auth, (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) return res.json([]);
  const clients = db.prepare(`
    SELECT * FROM clients
    WHERE nom LIKE ? OR telephone LIKE ? OR email LIKE ?
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);
  res.json(clients);
});

router.get('/:id', auth, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });

  const interventions = db.prepare(`
    SELECT * FROM interventions WHERE client_id = ? ORDER BY created_at DESC
  `).all(req.params.id);

  const stats = db.prepare(`
    SELECT COUNT(*) as total_interventions, SUM(montant_devis) as total_depense
    FROM interventions WHERE client_id = ?
  `).get(req.params.id);

  res.json({ ...client, interventions, ...stats });
});

router.post('/', auth, (req, res) => {
  const { nom, telephone, email, type_client } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis' });
  const result = db.prepare(`
    INSERT INTO clients (nom, telephone, email, type_client) VALUES (?, ?, ?, ?)
  `).run(nom, telephone, email, type_client || 'Particulier');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

module.exports = router;

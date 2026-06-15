const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const appels = db.prepare(`
    SELECT a.*, c.nom as nom_client
    FROM appels a
    LEFT JOIN clients c ON a.client_id = c.id
    ORDER BY a.created_at DESC
  `).all();
  res.json(appels);
});

router.get('/non-lus', auth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM appels WHERE lu = 0').get();
  res.json(count);
});

router.get('/:id', auth, (req, res) => {
  const appel = db.prepare(`
    SELECT a.*, c.nom as nom_client
    FROM appels a LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!appel) return res.status(404).json({ error: 'Appel introuvable' });
  res.json(appel);
});

router.patch('/:id/lu', auth, (req, res) => {
  db.prepare('UPDATE appels SET lu = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.patch('/:id/statut', auth, (req, res) => {
  const { statut_appel } = req.body;
  if (!['a_rappeler', 'traite'].includes(statut_appel)) return res.status(400).json({ error: 'Statut invalide' });
  db.prepare('UPDATE appels SET statut_appel = ? WHERE id = ?').run(statut_appel, req.params.id);
  res.json({ success: true });
});

router.post('/:id/creer-intervention', auth, (req, res) => {
  const appel = db.prepare('SELECT * FROM appels WHERE id = ?').get(req.params.id);
  if (!appel) return res.status(404).json({ error: 'Appel introuvable' });

  const { vehicule, probleme, date_intervention } = req.body;
  const result = db.prepare(`
    INSERT INTO interventions (client_id, vehicule, probleme, statut, type_client, resume_appel, date_intervention)
    VALUES (?, ?, ?, 'À traiter', 'Particulier', ?, ?)
  `).run(appel.client_id, vehicule, probleme, appel.resume_ia, date_intervention);

  const intervention = db.prepare('SELECT * FROM interventions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(intervention);
});

module.exports = router;

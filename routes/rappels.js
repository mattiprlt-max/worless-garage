const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/rappels — tous les rappels à venir (non envoyés)
router.get('/', auth, (req, res) => {
  const rappels = db.prepare(`
    SELECT r.*, c.nom, c.telephone, c.email, i.vehicule, i.probleme
    FROM rappels r
    LEFT JOIN clients c ON r.client_id = c.id
    LEFT JOIN interventions i ON r.intervention_id = i.id
    WHERE r.envoye = 0
    ORDER BY r.date_rappel ASC
  `).all();
  res.json(rappels);
});

// GET /api/rappels/dus-liste — liste complète des rappels dus (pour cron n8n)
router.get('/dus-liste', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rappels = db.prepare(`
    SELECT r.*, c.nom, c.telephone
    FROM rappels r LEFT JOIN clients c ON r.client_id = c.id
    WHERE r.envoye = 0 AND date(r.date_rappel) <= ?
  `).all(today);
  res.json(rappels);
});

// GET /api/rappels/dus — rappels dus aujourd'hui ou en retard
router.get('/dus', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM rappels
    WHERE envoye = 0 AND date(date_rappel) <= ?
  `).get(today);
  res.json({ count: count.count });
});

// PATCH /api/rappels/:id — modifier le message
router.patch('/:id', auth, (req, res) => {
  const { message, date_rappel } = req.body;
  const fields = [];
  const values = [];
  if (message !== undefined) { fields.push('message = ?'); values.push(message); }
  if (date_rappel !== undefined) { fields.push('date_rappel = ?'); values.push(date_rappel); }
  if (!fields.length) return res.status(400).json({ error: 'Aucun champ valide' });
  values.push(req.params.id);
  db.prepare(`UPDATE rappels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const rappel = db.prepare(`
    SELECT r.*, c.nom, c.telephone, c.email, i.vehicule, i.probleme
    FROM rappels r
    LEFT JOIN clients c ON r.client_id = c.id
    LEFT JOIN interventions i ON r.intervention_id = i.id
    WHERE r.id = ?
  `).get(req.params.id);
  res.json(rappel);
});

// POST /api/rappels/:id/message — n8n renvoie le message généré par IA
router.post('/:id/message', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message requis' });
  db.prepare('UPDATE rappels SET message = ? WHERE id = ?').run(message, req.params.id);
  res.json({ success: true });
});

// POST /api/rappels/:id/envoyer — marquer comme envoyé + déclencher n8n
router.post('/:id/envoyer', auth, async (req, res) => {
  const rappel = db.prepare(`
    SELECT r.*, c.nom, c.telephone, c.email, i.vehicule, i.probleme
    FROM rappels r
    LEFT JOIN clients c ON r.client_id = c.id
    LEFT JOIN interventions i ON r.intervention_id = i.id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!rappel) return res.status(404).json({ error: 'Rappel introuvable' });

  const n8nUrl = process.env.N8N_RAPPEL_WEBHOOK;
  if (n8nUrl) {
    try {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telephone: rappel.telephone,
          nom: rappel.nom,
          message: rappel.message
        })
      });
    } catch (err) {
      console.error('Erreur envoi rappel n8n:', err.message);
    }
  }

  db.prepare(`UPDATE rappels SET envoye = 1, date_envoi = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

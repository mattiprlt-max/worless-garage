const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const avis = db.prepare('SELECT * FROM avis_google ORDER BY created_at DESC').all();
  res.json(avis);
});

router.patch('/:id/reponse', auth, (req, res) => {
  const { reponse_ia } = req.body;
  db.prepare('UPDATE avis_google SET reponse_ia = ? WHERE id = ?').run(reponse_ia, req.params.id);
  res.json({ success: true });
});

router.post('/:id/envoyer', auth, async (req, res) => {
  const avis = db.prepare('SELECT * FROM avis_google WHERE id = ?').get(req.params.id);
  if (!avis) return res.status(404).json({ error: 'Avis introuvable' });

  // Déclencher le webhook n8n pour publication Google
  const N8N_WEBHOOK = process.env.N8N_AVIS_WEBHOOK;
  if (N8N_WEBHOOK) {
    try {
      await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avis_id: avis.id, auteur: avis.auteur, reponse: avis.reponse_ia })
      });
    } catch (e) {
      console.error('Erreur webhook n8n avis:', e.message);
    }
  }

  db.prepare('UPDATE avis_google SET publie = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

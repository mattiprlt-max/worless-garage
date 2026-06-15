const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const interventions = db.prepare(`
    SELECT i.*, c.nom, c.telephone, c.email
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(interventions);
});

router.get('/:id', auth, (req, res) => {
  const intervention = db.prepare(`
    SELECT i.*, c.nom, c.telephone, c.email
    FROM interventions i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!intervention) return res.status(404).json({ error: 'Intervention introuvable' });
  res.json(intervention);
});

router.post('/', auth, (req, res) => {
  const { client_id, vehicule, probleme, statut, type_client, montant_devis, resume_appel, date_intervention } = req.body;
  const result = db.prepare(`
    INSERT INTO interventions (client_id, vehicule, probleme, statut, type_client, montant_devis, resume_appel, date_intervention)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, vehicule, probleme, statut || 'À traiter', type_client || 'Particulier', montant_devis, resume_appel, date_intervention);
  const intervention = db.prepare('SELECT * FROM interventions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(intervention);
});

router.patch('/:id', auth, (req, res) => {
  const allowed = ['statut', 'vehicule', 'probleme', 'montant_devis', 'resume_appel', 'date_intervention', 'type_client'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Aucun champ valide' });

  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f]);
  db.prepare(`UPDATE interventions SET ${sets} WHERE id = ?`).run(...values, req.params.id);
  const intervention = db.prepare(`
    SELECT i.*, c.nom, c.telephone, c.email
    FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);

  // Notification "voiture prête" dès que statut → Terminé
  if (req.body.statut === 'Terminé' && intervention.client_id && intervention.telephone) {
    const dejaNotifie = db.prepare('SELECT id FROM notifications WHERE intervention_id = ?').get(intervention.id);
    if (!dejaNotifie) {
      const notifResult = db.prepare('INSERT INTO notifications (intervention_id, client_id, telephone) VALUES (?, ?, ?)').run(intervention.id, intervention.client_id, intervention.telephone);
      const n8nNotifUrl = process.env.N8N_NOTIFICATION_WEBHOOK;
      if (n8nNotifUrl) {
        fetch(n8nNotifUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification_id: notifResult.lastInsertRowid,
            nom: intervention.nom || '',
            telephone: intervention.telephone || '',
            vehicule: intervention.vehicule || '',
            probleme: intervention.probleme || ''
          })
        }).catch(err => console.error('Erreur webhook notification:', err.message));
      }
    }
  }

  // Auto-créer un rappel pour toutes les interventions Terminé
  if (req.body.statut === 'Terminé' && intervention.client_id) {
    const existingRappel = db.prepare('SELECT id FROM rappels WHERE intervention_id = ?').get(intervention.id);
    if (!existingRappel) {
      const dateRappel = new Date();
      dateRappel.setFullYear(dateRappel.getFullYear() + 1);
      const result = db.prepare(`
        INSERT INTO rappels (intervention_id, client_id, message, date_rappel)
        VALUES (?, ?, '', ?)
      `).run(intervention.id, intervention.client_id, dateRappel.toISOString().split('T')[0]);

      const rappelId = result.lastInsertRowid;
      const n8nUrl = process.env.N8N_RAPPEL_MESSAGE_WEBHOOK;
      if (n8nUrl) {
        fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rappel_id: rappelId,
            nom: intervention.nom || '',
            telephone: intervention.telephone || '',
            vehicule: intervention.vehicule || '',
            probleme: intervention.probleme || ''
          })
        }).catch(err => console.error('Erreur webhook rappel:', err.message));
      }
    }
  }

  res.json(intervention);
});

router.delete('/:id', auth, (req, res) => {
  const intervention = db.prepare('SELECT id FROM interventions WHERE id = ?').get(req.params.id);
  if (!intervention) return res.status(404).json({ error: 'Intervention introuvable' });
  db.prepare('DELETE FROM interventions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

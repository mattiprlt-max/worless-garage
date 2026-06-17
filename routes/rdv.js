const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const BASE_URL = process.env.APP_URL || 'https://garage-worless.worless.fr';

// POST /api/rdv/envoyer — garagiste envoie le lien de confirmation au client
router.post('/envoyer', auth, (req, res) => {
  const { intervention_id } = req.body;
  const intervention = db.prepare(`
    SELECT i.*, c.nom, c.email, c.telephone
    FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(intervention_id);

  if (!intervention) return res.status(404).json({ error: 'Intervention introuvable' });
  if (!intervention.date_intervention) return res.status(400).json({ error: 'Aucune date fixée sur cette intervention' });

  const token = crypto.randomBytes(16).toString('hex');
  db.prepare("UPDATE interventions SET rdv_token = ?, statut = 'En attente de réponse' WHERE id = ?").run(token, intervention_id);

  const lienAccepte = `${BASE_URL}/api/rdv?id=${intervention_id}&token=${token}&action=accepte`;
  const lienAutre = `${BASE_URL}/api/rdv?id=${intervention_id}&token=${token}&action=autre`;

  // Envoie l'email de confirmation au client
  const n8nClientUrl = process.env.N8N_RDV_WEBHOOK;
  if (n8nClientUrl) {
    fetch(n8nClientUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: intervention.nom || 'Client',
        email: intervention.email || '',
        telephone: intervention.telephone || '',
        vehicule: intervention.vehicule || '',
        probleme: intervention.probleme || '',
        date_intervention: intervention.date_intervention,
        date_formatee: intervention.date_intervention
          ? new Date(intervention.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : 'Date à confirmer',
        lien_accepte: lienAccepte,
        lien_accepter: lienAccepte,
        lien_autre: lienAutre
      })
    }).catch(err => console.error('Erreur webhook RDV client:', err.message));
  }

  res.json({ success: true, lien_accepte: lienAccepte, lien_autre: lienAutre });
});

// GET /api/rdv?id=X&token=X&action=accepte|autre — page client
router.get('/', (req, res) => {
  const { id, token, action } = req.query;
  if (!id || !token) return res.status(400).send(pageFeedback('error', 'Lien invalide', 'Ce lien est incorrect ou expiré.'));

  const intervention = db.prepare(`
    SELECT i.*, c.nom, c.email, c.telephone
    FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ? AND i.rdv_token = ?
  `).get(id, token);

  if (!intervention) return res.status(404).send(pageFeedback('error', 'Lien invalide', 'Ce lien est incorrect ou a déjà été utilisé.'));

  const date = intervention.date_intervention
    ? new Date(intervention.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date à confirmer';

  if (action === 'accepte') {
    db.prepare("UPDATE interventions SET statut = 'RDV confirmé' WHERE id = ?").run(id);
    const notifUrl = process.env.N8N_RDV_NOTIF_WEBHOOK;
    if (notifUrl) {
      fetch(notifUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirmé',
          client_nom: intervention.nom || 'Client',
          vehicule: intervention.vehicule || '',
          date_intervention: intervention.date_intervention
        })
      }).catch(err => console.error('Erreur notif garagiste RDV:', err.message));
    }
    return res.send(pageFeedback('success', 'Rendez-vous confirmé !',
      `Merci <strong>${intervention.nom || ''}</strong>, votre rendez-vous du <strong>${date}</strong> pour votre <strong>${intervention.vehicule || 'véhicule'}</strong> est bien confirmé.`,
      'Le Garage Martin vous attend !'
    ));
  }

  if (action === 'autre') {
    return res.send(pageProposerDate(id, token, date, intervention));
  }

  return res.status(400).send(pageFeedback('error', 'Action inconnue', 'Ce lien est incorrect.'));
});

// POST /api/rdv/proposer — client propose un nouveau créneau
router.post('/proposer', (req, res) => {
  const { id, token, date_souhaitee, message } = req.body;
  if (!id || !token) return res.status(400).send(pageFeedback('error', 'Erreur', 'Données manquantes.'));

  const intervention = db.prepare(`
    SELECT i.*, c.nom FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ? AND i.rdv_token = ?
  `).get(id, token);
  if (!intervention) return res.status(404).send(pageFeedback('error', 'Lien invalide', 'Ce lien est incorrect ou expiré.'));

  db.prepare(`UPDATE interventions SET statut = 'Nouveau créneau', date_rdv_client = ?, message_rdv_client = ? WHERE id = ?`)
    .run(date_souhaitee || null, message || null, id);

  const notifUrl = process.env.N8N_RDV_NOTIF_WEBHOOK;
  if (notifUrl) {
    fetch(notifUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'nouveau créneau demandé',
        client_nom: intervention.nom || 'Client',
        vehicule: intervention.vehicule || '',
        date_intervention: intervention.date_intervention,
        infos_supp: `${date_souhaitee || ''}${message ? ' — ' + message : ''}`
      })
    }).catch(err => console.error('Erreur notif garagiste créneau:', err.message));
  }

  return res.send(pageFeedback('pending', 'Demande envoyée !',
    `Votre demande de nouveau créneau a bien été transmise au Garage Martin.`,
    'Ils vous recontacteront très vite pour confirmer.'
  ));
});

function pageFeedback(type, titre, message, sousTitre = '') {
  const icons = { success: '✅', error: '❌', pending: '📅' };
  const colors = { success: '#22c55e', error: '#ef4444', pending: '#f59e0b' };
  const icon = icons[type] || '✅';
  const color = colors[type] || '#22c55e';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${titre} — Garage Martin</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#f0f0f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#141414;border:1px solid #222;border-radius:20px;padding:40px 36px;max-width:440px;width:100%;text-align:center}.icon{font-size:52px;margin-bottom:20px;display:block}.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background:${color}22;color:${color};border:1px solid ${color}44;margin-bottom:16px}h1{font-size:22px;font-weight:700;margin-bottom:12px;color:#fff}.message{font-size:15px;color:#9ca3af;line-height:1.65}.message strong{color:#e5e7eb}.sous-titre{margin-top:16px;font-size:14px;color:#6b7280}hr{border:none;border-top:1px solid #222;margin:28px 0}.branding{font-size:13px;color:#4b5563}.branding span{color:#374151;font-weight:600}</style></head><body><div class="card"><span class="icon">${icon}</span><div class="badge">Garage Martin</div><h1>${titre}</h1><p class="message">${message}</p>${sousTitre ? `<p class="sous-titre">${sousTitre}</p>` : ''}<hr><p class="branding">Propulsé par <span>Worless</span></p></div></body></html>`;
}

function pageProposerDate(id, token, dateActuelle, intervention) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Proposer un créneau — Garage Martin</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#f0f0f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#141414;border:1px solid #222;border-radius:20px;padding:36px;max-width:440px;width:100%}.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;margin-bottom:20px}h1{font-size:20px;font-weight:700;margin-bottom:8px}.sub{font-size:14px;color:#6b7280;margin-bottom:28px;line-height:1.55}.sub strong{color:#9ca3af}label{display:block;font-size:13px;color:#6b7280;margin-bottom:6px;margin-top:20px;font-weight:500}input[type="date"],textarea{width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:10px;padding:11px 14px;color:#f0f0f0;font-size:15px;outline:none;font-family:inherit}textarea{resize:vertical;min-height:80px}button{margin-top:24px;width:100%;background:#22c55e;color:#000;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}hr{border:none;border-top:1px solid #1f1f1f;margin:24px 0 16px}.branding{font-size:13px;color:#374151;text-align:center}.branding span{font-weight:600;color:#4b5563}</style></head><body><div class="card"><div class="badge">Garage Martin</div><h1>Proposer un autre créneau</h1><p class="sub">Le créneau proposé était le <strong>${dateActuelle}</strong>.<br>Indiquez vos disponibilités ci-dessous.</p><form method="POST" action="/api/rdv/proposer"><input type="hidden" name="id" value="${id}"><input type="hidden" name="token" value="${token}"><label>Date souhaitée</label><input type="date" name="date_souhaitee" required><label>Message (optionnel)</label><textarea name="message" placeholder="Ex : Je suis disponible le matin avant 10h…"></textarea><button type="submit">Envoyer ma disponibilité</button></form><hr><p class="branding">Propulsé par <span>Worless</span></p></div></body></html>`;
}

module.exports = router;

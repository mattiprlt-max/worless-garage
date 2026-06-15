const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const ymPrev = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;

  const ca = db.prepare(`SELECT COALESCE(SUM(montant_devis),0) as total FROM interventions WHERE statut IN ('Terminé','Livré') AND strftime('%Y-%m', created_at)=?`).get(ym);
  const caPrev = db.prepare(`SELECT COALESCE(SUM(montant_devis),0) as total FROM interventions WHERE statut IN ('Terminé','Livré') AND strftime('%Y-%m', created_at)=?`).get(ymPrev);

  const interMois = db.prepare(`SELECT COUNT(*) as count FROM interventions WHERE strftime('%Y-%m', created_at)=?`).get(ym);
  const interPrev = db.prepare(`SELECT COUNT(*) as count FROM interventions WHERE strftime('%Y-%m', created_at)=?`).get(ymPrev);

  const appelsMois = db.prepare(`SELECT COUNT(*) as count FROM appels WHERE strftime('%Y-%m', created_at)=?`).get(ym);

  const aTraiter = db.prepare(`SELECT COUNT(*) as count FROM interventions WHERE statut NOT IN ('Terminé','Livré')`).get();

  const statuts = db.prepare(`SELECT statut, COUNT(*) as count FROM interventions GROUP BY statut ORDER BY count DESC`).all();

  const retard = db.prepare(`
    SELECT i.id, i.statut, i.vehicule, i.probleme, i.date_intervention, c.nom, c.telephone
    FROM interventions i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.date_intervention < datetime('now') AND i.statut NOT IN ('Terminé','Livré')
    AND i.date_intervention IS NOT NULL
    ORDER BY i.date_intervention ASC LIMIT 5
  `).all();

  const tauxConversion = appelsMois.count > 0 ? Math.round((interMois.count / appelsMois.count) * 100) : null;

  res.json({
    ca: { mois: ca.total, prev: caPrev.total },
    interventions: { mois: interMois.count, prev: interPrev.count },
    appels: { mois: appelsMois.count },
    aTraiter: aTraiter.count,
    tauxConversion,
    statuts,
    retard
  });
});

module.exports = router;

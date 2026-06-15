const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés'));
  }
});

// POST /api/devis/upload
// Extrait le texte du PDF et envoie à n8n pour analyse IA
router.post('/upload', auth, upload.single('devis'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier PDF requis' });

  const n8nUrl = process.env.N8N_DEVIS_PDF_WEBHOOK;
  if (!n8nUrl) {
    return res.status(503).json({ error: 'Service indisponible' });
  }

  try {
    const data = await pdfParse(req.file.buffer);
    const texte = data.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

    await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texte, filename: req.file.originalname })
    });

    res.json({ status: 'processing' });
  } catch (err) {
    console.error('Erreur traitement PDF:', err.message);
    res.status(500).json({ error: 'Impossible de lire ce fichier PDF' });
  }
});

module.exports = router;

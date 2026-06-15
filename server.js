require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/interventions', require('./routes/interventions'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/appels', require('./routes/appels'));
app.use('/api/avis', require('./routes/avis'));
app.use('/api/webhook', require('./routes/webhooks'));
app.use('/api/devis', require('./routes/devis'));
app.use('/api/rappels', require('./routes/rappels'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/rdv', require('./routes/rdv'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

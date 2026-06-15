const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'worless_secret_2024';

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });

  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Seeding database...');

// User admin
const hash = bcrypt.hashSync('worless2024', 10);
db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)`)
  .run('garage@worless.fr', hash, 'admin');

// Clients
const clients = [
  { nom: 'Jean Dupont', telephone: '0612345678', email: 'jean.dupont@gmail.com', type_client: 'Particulier' },
  { nom: 'Marie Leroy', telephone: '0698765432', email: 'marie.leroy@gmail.com', type_client: 'Particulier' },
  { nom: 'Transport Moreau SARL', telephone: '0145678901', email: 'contact@moreau-transport.fr', type_client: 'Pro' },
  { nom: 'Paul Bernard', telephone: '0623456789', email: 'paul.bernard@orange.fr', type_client: 'Particulier' },
  { nom: 'Entreprise Fabre', telephone: '0456789012', email: 'fabre.entreprise@gmail.com', type_client: 'Pro' },
];

const insertClient = db.prepare(`INSERT OR IGNORE INTO clients (nom, telephone, email, type_client) VALUES (?, ?, ?, ?)`);
clients.forEach(c => insertClient.run(c.nom, c.telephone, c.email, c.type_client));

// Interventions
const interventions = [
  { client_id: 1, vehicule: 'Peugeot 308 - AB-123-CD', probleme: 'Vidange + filtre à air', statut: 'En cours', montant_devis: 180, resume_appel: 'Client appelle pour vidange annuelle. Véhicule Peugeot 308, 95 000 km. Souhaite aussi vérification des freins.', date_intervention: '2026-05-20' },
  { client_id: 2, vehicule: 'Renault Clio - EF-456-GH', probleme: 'Freins avant à changer', statut: 'En attente client', montant_devis: 320, resume_appel: 'Bruit de freinage à l\'avant. Disques et plaquettes à remplacer côté gauche. Devis envoyé.', date_intervention: '2026-05-21' },
  { client_id: 3, vehicule: 'Mercedes Sprinter - IJ-789-KL', probleme: 'Révision complète + courroie', statut: 'À traiter', montant_devis: 850, resume_appel: 'Révision des 150 000 km. Courroie de distribution à changer impérativement.', date_intervention: '2026-05-22' },
  { client_id: 1, vehicule: 'Peugeot 308 - AB-123-CD', probleme: 'Climatisation ne fonctionne plus', statut: 'Terminé', montant_devis: 220, resume_appel: null, date_intervention: '2026-04-10' },
  { client_id: 4, vehicule: 'Citroën C3 - MN-012-OP', probleme: 'Voyant moteur allumé', statut: 'En cours', montant_devis: 150, resume_appel: 'Voyant moteur allumé depuis 3 jours. Diagnostic à effectuer.', date_intervention: '2026-05-19' },
  { client_id: 2, vehicule: 'Renault Clio - EF-456-GH', probleme: 'Vidange', statut: 'Livré', montant_devis: 120, resume_appel: null, date_intervention: '2026-03-15' },
  { client_id: 5, vehicule: 'Ford Transit - QR-345-ST', probleme: 'Embrayage à remplacer', statut: 'À traiter', montant_devis: 1200, resume_appel: 'Embrayage qui patine, remplacement complet nécessaire. Véhicule utilitaire.', date_intervention: '2026-05-23' },
];

const insertIntervention = db.prepare(`INSERT OR IGNORE INTO interventions (client_id, vehicule, probleme, statut, type_client, montant_devis, resume_appel, date_intervention) VALUES (?, ?, ?, ?, (SELECT type_client FROM clients WHERE id = ?), ?, ?, ?)`);
interventions.forEach(i => insertIntervention.run(i.client_id, i.vehicule, i.probleme, i.statut, i.client_id, i.montant_devis, i.resume_appel, i.date_intervention));

// Appels
const appels = [
  { client_id: 1, numero_appelant: '0612345678', duree: 142, transcription: 'Agent : Bonjour, Garage Martin, que puis-je faire pour vous ?\nClient : Bonjour, c\'est Jean Dupont, j\'appelle pour prendre rendez-vous pour une vidange sur ma Peugeot 308.\nAgent : Bien sûr Monsieur Dupont. Quel est le kilométrage de votre véhicule ?\nClient : Environ 95 000 kilomètres.\nAgent : Parfait. Souhaitez-vous aussi un contrôle des freins ?\nClient : Oui ce serait bien, j\'entends un petit bruit parfois.\nAgent : Très bien, je note ça. Nous pouvons vous recevoir le 20 mai, est-ce que ça vous convient ?\nClient : Oui parfait.\nAgent : C\'est noté. À bientôt Monsieur Dupont.', resume_ia: 'Jean Dupont — Peugeot 308 (95 000 km) — Vidange + vérification freins (bruit signalé) — RDV demandé pour le 20 mai', lu: 1, created_at: '2026-05-18 09:23:00' },
  { client_id: null, numero_appelant: '0756789012', duree: 87, transcription: 'Agent : Bonjour, Garage Martin, que puis-je faire pour vous ?\nClient : Bonjour, j\'ai un gros problème avec ma voiture, le moteur fait un bruit bizarre depuis ce matin.\nAgent : Je comprends. Quel est votre nom ?\nClient : Thomas Petit.\nAgent : Et quel véhicule avez-vous Monsieur Petit ?\nClient : Une Golf 7, 2018.\nAgent : D\'accord. Est-ce un bruit au démarrage ou en roulant ?\nClient : Les deux, mais surtout en roulant, ça claque.\nAgent : C\'est urgent alors. Je vous mets en priorité. Pouvez-vous venir demain matin ?\nClient : Oui je serai là à 8h.', resume_ia: 'Thomas Petit — VW Golf 7 (2018) — Bruit moteur en roulant (claquement) — URGENT — RDV demain 8h', lu: 0, created_at: '2026-05-19 11:05:00' },
  { client_id: 3, numero_appelant: '0145678901', duree: 203, transcription: 'Agent : Bonjour, Garage Martin, que puis-je faire pour vous ?\nClient : Bonjour, c\'est Transport Moreau. J\'appelle pour notre Sprinter, il est à 150 000 km, on voudrait faire la révision complète.\nAgent : Bien sûr. Vous voulez inclure la courroie de distribution ?\nClient : Oui absolument, c\'est important pour nous.\nAgent : Je comprends. Quand pouvez-vous l\'amener ?\nClient : Le 22 mai matin si possible.\nAgent : C\'est noté pour le 22 mai.', resume_ia: 'Transport Moreau SARL — Mercedes Sprinter (150 000 km) — Révision complète + courroie de distribution — RDV 22 mai matin', lu: 1, created_at: '2026-05-17 14:30:00' },
  { client_id: null, numero_appelant: '0634567890', duree: 65, transcription: 'Agent : Bonjour, Garage Martin, que puis-je faire pour vous ?\nClient : Bonjour, je voudrais savoir si vous faites les contrôles techniques ?\nAgent : Non, nous ne faisons pas les contrôles techniques, mais nous pouvons préparer votre véhicule avant le contrôle.\nClient : Ah d\'accord, merci au revoir.', resume_ia: 'Appel renseignement — contrôle technique (pas de prise en charge) — pas de suite à donner', lu: 0, created_at: '2026-05-19 16:42:00' },
];

const insertAppel = db.prepare(`INSERT OR IGNORE INTO appels (client_id, numero_appelant, duree, transcription, resume_ia, lu, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
appels.forEach(a => insertAppel.run(a.client_id, a.numero_appelant, a.duree, a.transcription, a.resume_ia, a.lu, a.created_at));

// Avis Google
const avis = [
  { auteur: 'Michel Renard', note: 5, contenu: 'Excellent garage ! Très professionnel, travail soigné et prix honnêtes. Je recommande vivement.', reponse_ia: 'Merci beaucoup Michel pour ce retour qui nous touche vraiment ! Nous mettons tout en œuvre pour offrir un service de qualité à nos clients. À bientôt au garage !', publie: 0 },
  { auteur: 'Sophie Marchand', note: 4, contenu: 'Bon accueil, travail bien fait. Juste un petit délai plus long que prévu mais ils ont bien communiqué.', reponse_ia: 'Merci Sophie pour votre avis et votre compréhension concernant le délai. Nous nous efforçons toujours de tenir informés nos clients. À bientôt !', publie: 1 },
  { auteur: 'Karim Belkacem', note: 5, contenu: 'Rapide, efficace, prix transparent. Mon embrayage a été remplacé en une journée. Bravo à l\'équipe !', reponse_ia: 'Merci Karim pour ce super retour ! La transparence et la rapidité sont au cœur de notre façon de travailler. On sera là pour votre prochain entretien !', publie: 0 },
];

const insertAvis = db.prepare(`INSERT OR IGNORE INTO avis_google (auteur, note, contenu, reponse_ia, publie) VALUES (?, ?, ?, ?, ?)`);
avis.forEach(a => insertAvis.run(a.auteur, a.note, a.contenu, a.reponse_ia, a.publie));

console.log('✅ Base de données remplie avec succès');
console.log('   Login : garage@worless.fr / worless2024');

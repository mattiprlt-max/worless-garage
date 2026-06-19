// Auth guard
const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

// API helper
async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login.html'; }
  return res.json();
}

// Toast
function toast(title, sub = '', type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Skeleton loaders
function skeleton(count = 3) {
  return Array(count).fill(0).map((_, i) => `
    <div class="skeleton-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div>
          <div class="skeleton-line skeleton" style="width:160px;height:15px;margin-bottom:7px"></div>
          <div class="skeleton-line skeleton" style="width:110px;height:11px"></div>
        </div>
        <div class="skeleton-line skeleton" style="width:90px;height:28px;border-radius:6px"></div>
      </div>
      <div class="skeleton-line skeleton" style="width:${70 - i * 8}%;height:12px;margin-bottom:14px"></div>
      <div style="display:flex;gap:16px">
        <div class="skeleton-line skeleton" style="width:80px;height:10px"></div>
        <div class="skeleton-line skeleton" style="width:100px;height:10px"></div>
        <div class="skeleton-line skeleton" style="width:60px;height:10px"></div>
      </div>
    </div>
  `).join('');
}

// Statut → classe CSS
function statutClass(s) {
  const map = { 'À traiter': 'a-traiter', 'En cours': 'en-cours', 'En attente client': 'en-attente', 'Terminé': 'termine', 'Livré': 'livre', 'En attente de réponse': 'en-attente', 'RDV confirmé': 'termine', 'Nouveau créneau': 'en-attente' };
  return map[s] || 'a-traiter';
}

// Étoiles
function stars(note) { return '★'.repeat(note) + '☆'.repeat(5 - note); }

// Dates
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDuree(sec) {
  if (!sec) return '—';
  return `${Math.floor(sec / 60)}min ${sec % 60}s`;
}

// ─── NAVIGATION ───────────────────────────────────────────
function navigate(section) {
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.section === section);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  loaders[section]();
}

document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.section));
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
});

// SVG icons inline
const ICON_EDIT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

// ─── INTERVENTIONS ────────────────────────────────────────
const STATUTS = ['À traiter', 'En cours', 'En attente client', 'Terminé', 'Livré'];

async function loadInterventions() {
  const list = document.getElementById('interventions-list');
  list.innerHTML = skeleton(3);
  const data = await api('/interventions');
  document.getElementById('interventions-count').textContent = `${data.length} intervention${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">🔧</div>Aucune intervention pour le moment</div>';
    return;
  }

  list.innerHTML = data.map(i => `
    <div class="intervention-card" data-statut="${i.statut}">
      <div class="intervention-top">
        <div>
          <div class="intervention-client">${i.nom || 'Client inconnu'}</div>
          <div class="intervention-vehicule">${i.vehicule || '—'}</div>
        </div>
        <div class="intervention-actions">
          <button class="btn-edit" onclick="editIntervention(${i.id})" title="Modifier">${ICON_EDIT}</button>
          ${i.client_id ? `<button class="btn-edit" onclick="editClientDirectly(${i.client_id})" title="Modifier le client" style="font-size:14px">👤</button>` : ''}
          <select class="status-select" onchange="updateStatut(${i.id}, this.value, this)">
            ${STATUTS.map(s => `<option ${s === i.statut ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="intervention-probleme">${i.probleme || '—'}</div>
      <div class="intervention-meta">
        <span class="meta-item">📅 ${fmtDate(i.date_intervention)}</span>
        <span class="meta-item">📱 ${i.telephone || '—'}</span>
        <span class="meta-item">👤 ${i.type_client || '—'}</span>
        ${i.montant_devis ? `<span class="montant">${Number(i.montant_devis).toFixed(0)} €</span>` : ''}
      </div>
      ${i.resume_appel ? `<div class="resume-appel"><div class="resume-label">Résumé appel IA</div>${i.resume_appel}</div>` : ''}
      ${i.date_intervention ? `
        <div class="rdv-actions">
          <button class="btn btn-rdv btn-sm" onclick="envoyerConfirmationRdv(${i.id}, this)">
            📅 Envoyer confirmation RDV
          </button>
          ${i.statut === 'En attente de réponse' ? '<span class="rdv-creneau">⏳ En attente de réponse client</span>' : ''}
          ${i.statut === 'RDV confirmé' ? '<span class="rdv-confirme">✓ RDV confirmé par le client</span>' : ''}
          ${i.statut === 'Nouveau créneau' ? '<span class="rdv-creneau">📅 Nouveau créneau demandé</span>' : ''}
        </div>` : ''}
    </div>
  `).join('');
}

async function updateStatut(id, statut, selectEl) {
  const card = selectEl.closest('.intervention-card');
  await api(`/interventions/${id}`, { method: 'PATCH', body: JSON.stringify({ statut }) });
  card.dataset.statut = statut; // met à jour la barre de couleur à gauche
  toast('Statut mis à jour', statut);
}

async function envoyerConfirmationRdv(interventionId, btn) {
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  try {
    const data = await api('/rdv/envoyer', { method: 'POST', body: JSON.stringify({ intervention_id: interventionId }) });
    if (data.success) {
      toast('Lien envoyé', 'Le client va recevoir la confirmation de RDV');
      btn.textContent = '✓ Envoyé';
    } else {
      toast('Erreur', data.error || 'Impossible d\'envoyer', 'error');
      btn.textContent = '📅 Envoyer confirmation RDV';
      btn.disabled = false;
    }
  } catch (e) {
    toast('Erreur réseau', e.message, 'error');
    btn.textContent = '📅 Envoyer confirmation RDV';
    btn.disabled = false;
  }
}

// ─── MODAL NOUVELLE INTERVENTION / ÉDITION ───────────────
let prefillClientId = null;
let formMode = 'create'; // 'create' | 'edit'
let editInterventionId = null;

document.getElementById('btn-nouvelle-intervention').addEventListener('click', () => openModal());
document.getElementById('modal-cancel').addEventListener('click', () => closeModal());
document.getElementById('modal-intervention').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-delete').addEventListener('click', async () => {
  if (!editInterventionId) return;
  if (!confirm('Supprimer cette intervention ? Cette action est irréversible.')) return;
  await api(`/interventions/${editInterventionId}`, { method: 'DELETE' });
  closeModal();
  toast('Intervention supprimée', '', 'success');
  loadInterventions();
});

function openModal(prefill = {}) {
  formMode = 'create';
  editInterventionId = null;
  prefillClientId = prefill.client_id || null;

  document.getElementById('modal-title').textContent = prefill.titre || 'Nouvelle intervention';
  document.getElementById('form-client-id').value = prefill.client_id || '';
  document.getElementById('form-nom').value = prefill.nom || '';
  document.getElementById('form-telephone').value = prefill.telephone || '';
  document.getElementById('form-email').value = prefill.email || '';
  document.getElementById('form-type-client').value = prefill.type_client || 'Particulier';
  document.getElementById('form-vehicule').value = prefill.vehicule || '';
  document.getElementById('form-probleme').value = prefill.probleme || '';
  document.getElementById('form-date').value = prefill.date || '';
  document.getElementById('form-montant').value = prefill.montant || '';

  document.getElementById('modal-submit').textContent = 'Créer l\'intervention';
  document.getElementById('modal-delete').style.display = 'none';

  document.getElementById('modal-intervention').classList.add('open');
}

async function editIntervention(id) {
  const i = await api(`/interventions/${id}`);
  formMode = 'edit';
  editInterventionId = id;
  prefillClientId = i.client_id;

  document.getElementById('modal-title').textContent = 'Modifier l\'intervention';
  document.getElementById('form-client-id').value = i.client_id || '';
  document.getElementById('form-nom').value = i.nom || '';
  document.getElementById('form-telephone').value = i.telephone || '';
  document.getElementById('form-email').value = i.email || '';
  document.getElementById('form-type-client').value = i.type_client || 'Particulier';
  document.getElementById('form-vehicule').value = i.vehicule || '';
  document.getElementById('form-probleme').value = i.probleme || '';
  // date_intervention peut être "2026-05-20T00:00:00.000Z" → on garde juste YYYY-MM-DD
  document.getElementById('form-date').value = i.date_intervention ? i.date_intervention.split('T')[0] : '';
  document.getElementById('form-montant').value = i.montant_devis || '';

  document.getElementById('modal-submit').textContent = 'Enregistrer';
  document.getElementById('modal-delete').style.display = 'inline-flex';

  document.getElementById('modal-intervention').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-intervention').classList.remove('open');
  prefillClientId = null;
  formMode = 'create';
  editInterventionId = null;
}

document.getElementById('form-intervention').addEventListener('submit', async e => {
  e.preventDefault();
  const nom = document.getElementById('form-nom').value.trim();
  const telephone = document.getElementById('form-telephone').value.trim();
  const email = document.getElementById('form-email').value.trim();
  const type_client = document.getElementById('form-type-client').value;
  const vehicule = document.getElementById('form-vehicule').value;
  const probleme = document.getElementById('form-probleme').value;
  const montant_devis = document.getElementById('form-montant').value || null;
  const date_intervention = document.getElementById('form-date').value || null;

  if (formMode === 'edit' && editInterventionId) {
    // Mode édition — PATCH sur l'intervention + client si besoin
    await api(`/interventions/${editInterventionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ vehicule, probleme, type_client, montant_devis, date_intervention })
    });
    closeModal();
    toast('Intervention mise à jour', nom);
    loadInterventions();
    return;
  }

  // Mode création
  let client_id = prefillClientId;
  if (!client_id) {
    const client = await api('/clients', { method: 'POST', body: JSON.stringify({ nom, telephone, email, type_client }) });
    client_id = client.id;
  }

  await api('/interventions', {
    method: 'POST',
    body: JSON.stringify({ client_id, vehicule, probleme, type_client, montant_devis, date_intervention })
  });

  closeModal();
  toast('Intervention créée', nom);
  loadInterventions();
});

// ─── CLIENTS ──────────────────────────────────────────────
let searchTimeout;

document.getElementById('clients-search').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('search-hint').innerHTML = 'Commencez à taper pour rechercher un client.';
    return;
  }
  document.getElementById('search-hint').innerHTML = '<div class="search-loading"><div class="spinner" style="width:18px;height:18px;margin:12px auto"></div></div>';
  searchTimeout = setTimeout(() => searchClients(q), 250);
});

async function searchClients(q) {
  const hint = document.getElementById('search-hint');
  const results = await api(`/clients/search?q=${encodeURIComponent(q)}`);

  if (!results.length) {
    hint.innerHTML = `
      <div class="search-no-result">
        Aucun client trouvé pour « <strong>${q}</strong> »
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-secondary btn-sm" onclick="openModal({nom:'${q}'})">+ Créer ce client</button>
      </div>
    `;
    return;
  }

  hint.innerHTML = results.map(c => `
    <div class="search-result-item" onclick="openCarteClient(${c.id})">
      <div>
        <span class="search-result-nom">${c.nom}</span>
        <span class="search-result-type">${c.type_client}</span>
      </div>
      <span class="search-result-contact">${c.telephone || c.email || '—'}</span>
    </div>
  `).join('');
}

async function openCarteClient(id) {
  const c = await api(`/clients/${id}`);
  const overlay = document.getElementById('overlay-client');
  const carte = document.getElementById('carte-client');

  carte.innerHTML = `
    <div class="carte-header">
      <div>
        <div class="carte-nom">${c.nom}</div>
        <div class="carte-infos">
          ${c.telephone ? `<span class="carte-info">📱 ${c.telephone}</span>` : ''}
          ${c.email ? `<span class="carte-info">✉️ ${c.email}</span>` : ''}
          <span class="carte-info">👤 ${c.type_client}</span>
        </div>
      </div>
      <button class="close-btn" onclick="closeCarteClient()">×</button>
    </div>
    <div class="carte-stats">
      <div class="stat">
        <div class="stat-val">${c.total_interventions || 0}</div>
        <div class="stat-label">Interventions</div>
      </div>
      <div class="stat">
        <div class="stat-val">${c.total_depense ? Number(c.total_depense).toFixed(0) + ' €' : '0 €'}</div>
        <div class="stat-label">Total dépensé</div>
      </div>
    </div>
    <div class="carte-historique">
      <div class="historique-title">Historique</div>
      ${c.interventions.length ? c.interventions.map(i => `
        <div class="histo-item">
          <div class="histo-left">
            <div class="histo-date">${fmtDate(i.date_intervention || i.created_at)}</div>
            <div class="histo-vehicule">${i.vehicule || '—'}</div>
            <div class="histo-probleme">${i.probleme}</div>
          </div>
          <div class="histo-right">
            ${i.montant_devis ? `<div class="histo-montant">${Number(i.montant_devis).toFixed(0)} €</div>` : ''}
            <span class="status status-${statutClass(i.statut)}">${i.statut}</span>
          </div>
        </div>
      `).join('') : '<div class="attente-ia" style="padding:12px 0">Aucune intervention</div>'}
    </div>
    <div class="carte-actions">
      <button class="btn btn-primary" onclick="closeCarteClient(); openModal({client_id:${c.id}, nom:'${c.nom}', telephone:'${c.telephone || ''}', email:'${c.email || ''}', type_client:'${c.type_client}'})">+ Nouvelle intervention</button>
      <button class="btn btn-secondary" onclick="ouvrirEditClient(${c.id}, \`${c.nom}\`, \`${c.telephone || ''}\`, \`${c.email || ''}\`, \`${c.type_client || 'Particulier'}\`)">Modifier</button>
      <button class="btn btn-secondary" onclick="closeCarteClient()">Fermer</button>
    </div>
  `;

  overlay.classList.add('open');
}

function closeCarteClient() {
  document.getElementById('overlay-client').classList.remove('open');
}

function ouvrirEditClient(id, nom, telephone, email, type_client) {
  const carte = document.getElementById('carte-client');
  carte.innerHTML = `
    <div class="carte-header">
      <div class="carte-nom">Modifier le client</div>
      <button class="close-btn" onclick="closeCarteClient()">×</button>
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:13px;color:#6b7280;display:block;margin-bottom:4px">Nom</label>
        <input id="edit-client-nom" class="form-input" value="${nom}" placeholder="Prénom Nom">
      </div>
      <div>
        <label style="font-size:13px;color:#6b7280;display:block;margin-bottom:4px">Téléphone</label>
        <input id="edit-client-tel" class="form-input" value="${telephone}" placeholder="06 XX XX XX XX">
      </div>
      <div>
        <label style="font-size:13px;color:#6b7280;display:block;margin-bottom:4px">Email</label>
        <input id="edit-client-email" class="form-input" type="email" value="${email}" placeholder="prenom.nom@email.fr">
      </div>
      <div>
        <label style="font-size:13px;color:#6b7280;display:block;margin-bottom:4px">Type</label>
        <select id="edit-client-type" class="form-input">
          <option value="Particulier" ${type_client === 'Particulier' ? 'selected' : ''}>Particulier</option>
          <option value="Professionnel" ${type_client === 'Professionnel' ? 'selected' : ''}>Professionnel</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="sauvegarderClient(${id})">Enregistrer</button>
    </div>
  `;
}

async function sauvegarderClient(id) {
  const nom = document.getElementById('edit-client-nom').value.trim();
  const telephone = document.getElementById('edit-client-tel').value.trim();
  const email = document.getElementById('edit-client-email').value.trim();
  const type_client = document.getElementById('edit-client-type').value;
  if (!nom) return toast('Erreur', 'Le nom est requis', 'error');
  await api(`/clients/${id}`, { method: 'PUT', body: JSON.stringify({ nom, telephone, email, type_client }) });
  toast('Client mis à jour', `${nom} a bien été modifié`);
  openCarteClient(id);
}

async function editClientDirectly(clientId) {
  if (!clientId) return toast('Erreur', 'Pas de client associé à cet appel', 'error');
  const c = await api(`/clients/${clientId}`);
  const overlay = document.getElementById('overlay-client');
  overlay.classList.add('open');
  ouvrirEditClient(c.id, c.nom, c.telephone || '', c.email || '', c.type_client || 'Particulier');
}
document.getElementById('overlay-client').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCarteClient();
});
document.getElementById('modal-transcription').addEventListener('click', e => {
  if (e.target === e.currentTarget) fermerTranscription();
});

function loadClients() {}

// ─── APPELS ───────────────────────────────────────────────
async function loadAppels() {
  const list = document.getElementById('appels-list');
  list.innerHTML = skeleton(4);
  const data = await api('/appels');
  const nonLus = data.filter(a => !a.lu).length;
  const manques = data.filter(a => !a.duree || a.duree < 15).length;
  document.getElementById('appels-count').textContent =
    `${data.length} appel${data.length !== 1 ? 's' : ''}${nonLus ? ` — ${nonLus} non lu${nonLus !== 1 ? 's' : ''}` : ''}${manques ? ` — ${manques} manqué${manques !== 1 ? 's' : ''}` : ''}`;

  if (!data.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">📞</div>Aucun appel pour le moment</div>';
    return;
  }

  // Non lus en premier, puis par date décroissante
  const sorted = [...data].sort((a, b) => {
    if (!a.lu && b.lu) return -1;
    if (a.lu && !b.lu) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  list.innerHTML = sorted.map(a => {
    const manque = !a.duree || a.duree < 15;
    const isRdv = a.type_appel === 'rdv';
    const isSuivi = a.type_appel === 'suivi';
    const isAchat = a.type_appel === 'achat';
    const traite = a.statut_appel === 'traite';

    const classeItem = [
      !a.lu ? 'non-lu' : '',
      manque ? 'appel-manque' : '',
      traite ? 'appel-traite' : ''
    ].filter(Boolean).join(' ');

    // Tag type
    let tagType = '';
    if (manque) tagType = '<span class="tag-manque">Manqué</span>';
    else if (isRdv) tagType = '<span class="tag-rdv">RDV</span>';
    else if (isSuivi) tagType = '<span class="tag-suivi">Suivi véhicule</span>';
    else if (isAchat) tagType = '<span class="tag-achat">Achat véhicule</span>';

    // Badge action — À rappeler ou Traité
    let badgeAction = '';
    if (!manque) {
      if (traite) {
        badgeAction = `<span class="badge-traite">✓ Traité</span>`;
      } else if (isRdv || isAchat) {
        badgeAction = `<span class="badge-a-rappeler">🔔 À rappeler</span>`;
      }
    }

    // Résumé
    let resumeHtml = '';
    if (isRdv) {
      resumeHtml = `<div class="appel-resume appel-resume-rdv"><strong>Résumé RDV</strong>${a.resume_ia || 'Pas de résumé disponible'}</div>`;
    } else if (isSuivi) {
      resumeHtml = `<div class="appel-resume appel-resume-suivi"><strong>Résumé suivi</strong>${a.resume_ia || 'Pas de résumé disponible'}</div>`;
    } else if (isAchat) {
      resumeHtml = `<div class="appel-resume appel-resume-achat"><strong>Résumé achat</strong>${a.resume_ia || 'Pas de résumé disponible'}</div>`;
    } else {
      resumeHtml = `<div class="appel-resume"><strong>Résumé IA</strong>${a.resume_ia || 'Pas de résumé disponible'}</div>`;
    }

    // Bouton basculer statut
    const btnStatut = (isRdv || isAchat) && !manque
      ? `<button class="btn btn-sm ${traite ? 'btn-secondary' : 'btn-success'}" onclick="toggleStatutAppel(${a.id}, '${traite ? 'a_rappeler' : 'traite'}', event)">
          ${traite ? '↩ Rouvrir' : '✓ Marquer traité'}
        </button>` : '';

    return `
    <div class="appel-item ${classeItem}" id="appel-${a.id}">
      <div class="appel-header" onclick="toggleAppel(${a.id})">
        <div class="appel-dot ${a.lu ? 'lu' : ''}"></div>
        <div class="appel-infos">
          <div class="appel-client">
            ${a.nom_client || 'Inconnu'}
            ${tagType}
            ${badgeAction}
          </div>
          <div class="appel-numero">${a.numero_appelant || '—'}</div>
        </div>
        <div class="appel-meta">
          <span class="appel-date">${fmtDateTime(a.created_at)}</span>
          <span class="appel-duree">${fmtDuree(a.duree)}</span>
          ${!traite && a.numero_appelant ? `<a class="btn-rappeler" href="tel:${a.numero_appelant}" onclick="event.stopPropagation()">📞 Rappeler</a>` : ''}
        </div>
      </div>
      <div class="appel-body" id="body-${a.id}">
        ${resumeHtml}
        <div class="appel-footer">
          ${btnStatut}
          ${a.transcription ? `<button class="btn btn-secondary btn-sm" onclick="ouvrirTranscription(${a.id}, event)">Voir la discussion</button>` : ''}
          ${a.client_id ? `<button class="btn btn-secondary btn-sm" onclick="editClientDirectly(${a.client_id})">Modifier le client</button>` : ''}
          ${!traite ? `<button class="btn btn-primary btn-sm" onclick="openModalDepuisAppel(${a.id})">Créer une intervention</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleAppel(id) {
  const body = document.getElementById(`body-${id}`);
  const item = document.getElementById(`appel-${id}`);
  body.classList.toggle('open');

  if (body.classList.contains('open') && item.classList.contains('non-lu')) {
    await api(`/appels/${id}/lu`, { method: 'PATCH' });
    item.classList.remove('non-lu');
    item.querySelector('.appel-dot').classList.add('lu');
    updateBadgeAppels();
  }
}

async function openModalDepuisAppel(appelId) {
  const appel = await api(`/appels/${appelId}`);
  openModal({
    titre: 'Intervention depuis appel',
    client_id: appel.client_id,
    nom: appel.nom_client || '',
    telephone: appel.numero_appelant || '',
    probleme: appel.resume_ia || ''
  });
}

async function toggleStatutAppel(id, nouveauStatut, event) {
  event.stopPropagation();
  await api(`/appels/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut_appel: nouveauStatut }) });
  await loadAppels();
}

async function ouvrirTranscription(appelId, event) {
  event.stopPropagation();
  const appel = await api(`/appels/${appelId}`);
  const modal = document.getElementById('modal-transcription');
  const body = document.getElementById('modal-transcription-body');
  body.textContent = appel.transcription || 'Pas de transcription disponible';
  modal.classList.add('open');
}

function fermerTranscription() {
  document.getElementById('modal-transcription').classList.remove('open');
}

// ─── AVIS GOOGLE ──────────────────────────────────────────
async function loadAvis() {
  const list = document.getElementById('avis-list');
  list.innerHTML = skeleton(2);
  const data = await api('/avis');
  const enAttente = data.filter(a => !a.publie).length;
  document.getElementById('avis-count').textContent = `${data.length} avis — ${enAttente} en attente`;

  if (!data.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">⭐</div>Aucun avis pour le moment</div>';
    return;
  }

  list.innerHTML = data.map(a => `
    <div class="avis-card" id="avis-${a.id}">
      <div class="avis-top">
        <div>
          <div class="avis-auteur">${a.auteur}</div>
          <div class="avis-stars">${stars(a.note)}</div>
        </div>
        <div style="text-align:right">
          <div class="avis-date">${fmtDate(a.created_at)}</div>
          ${a.publie ? '<div class="publie-badge" style="margin-top:6px">✓ Publié</div>' : ''}
        </div>
      </div>
      <div class="avis-contenu">${a.contenu}</div>
      ${a.reponse_ia ? `
        <div class="reponse-label">Réponse générée</div>
        <div class="reponse-text" id="reponse-text-${a.id}">${a.reponse_ia}</div>
        <textarea class="reponse-edit" id="reponse-edit-${a.id}" rows="4">${a.reponse_ia}</textarea>
        ${!a.publie ? `
          <div class="avis-actions">
            <button class="btn btn-secondary btn-sm" onclick="toggleEdit(${a.id})">Modifier</button>
            <button class="btn btn-primary btn-sm" onclick="envoyerReponse(${a.id})">Envoyer</button>
          </div>
        ` : ''}
      ` : '<div class="attente-ia">En attente de la réponse IA...</div>'}
    </div>
  `).join('');
}

function toggleEdit(id) {
  const text = document.getElementById(`reponse-text-${id}`);
  const edit = document.getElementById(`reponse-edit-${id}`);
  const isEditing = edit.style.display === 'block';

  if (isEditing) {
    const newVal = edit.value;
    text.textContent = newVal;
    edit.style.display = 'none';
    text.style.display = 'block';
    api(`/avis/${id}/reponse`, { method: 'PATCH', body: JSON.stringify({ reponse_ia: newVal }) });
    toast('Réponse modifiée');
  } else {
    text.style.display = 'none';
    edit.style.display = 'block';
    edit.focus();
  }
}

async function envoyerReponse(id) {
  const edit = document.getElementById(`reponse-edit-${id}`);
  if (edit.style.display === 'block') {
    await api(`/avis/${id}/reponse`, { method: 'PATCH', body: JSON.stringify({ reponse_ia: edit.value }) });
  }
  await api(`/avis/${id}/envoyer`, { method: 'POST' });
  toast('Réponse envoyée', 'Publication en cours sur Google');
  loadAvis();
}

// ─── BADGE APPELS + POLLING ───────────────────────────────
let lastNonLus = 0;

async function updateBadgeAppels() {
  const { count } = await api('/appels/non-lus');
  const badge = document.getElementById('badge-appels');
  const badgeMobile = document.getElementById('badge-appels-mobile');

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
    badgeMobile.textContent = count;
    badgeMobile.style.display = '';
    if (count > lastNonLus) {
      toast('Nouvel appel reçu', `${count} appel${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''}`);
    }
  } else {
    badge.style.display = 'none';
    badgeMobile.style.display = 'none';
  }
  lastNonLus = count;
}

// Polling toutes les 30s
updateBadgeAppels();
setInterval(updateBadgeAppels, 30000);

// ─── IMPORT PDF DEVIS ────────────────────────────────────
let pdfPollInterval = null;
let interventionsCountBeforeImport = 0;

document.getElementById('btn-import-pdf').addEventListener('click', openDropzone);
document.getElementById('dropzone-cancel').addEventListener('click', closeDropzone);
document.getElementById('dropzone-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDropzone();
});

// Drag & drop sur la zone
const dropzoneArea = document.getElementById('dropzone-area');
dropzoneArea.addEventListener('dragover', e => { e.preventDefault(); dropzoneArea.classList.add('dragover'); });
dropzoneArea.addEventListener('dragleave', () => dropzoneArea.classList.remove('dragover'));
dropzoneArea.addEventListener('drop', e => {
  e.preventDefault();
  dropzoneArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') uploadPdf(file);
  else toast('Format invalide', 'Seuls les fichiers PDF sont acceptés', 'error');
});

// Sélection via input
document.getElementById('pdf-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) uploadPdf(file);
});

function openDropzone() {
  document.getElementById('dropzone-modal').classList.add('open');
  // Reset état
  dropzoneArea.classList.remove('hidden');
  document.getElementById('dropzone-processing').classList.remove('active');
  document.getElementById('pdf-input').value = '';
}

function closeDropzone() {
  document.getElementById('dropzone-modal').classList.remove('open');
  if (pdfPollInterval) { clearInterval(pdfPollInterval); pdfPollInterval = null; }
}

async function uploadPdf(file) {
  // Passer en état "processing"
  dropzoneArea.classList.add('hidden');
  document.getElementById('dropzone-processing').classList.add('active');

  // Snapshot du nombre d'interventions actuel
  const current = await api('/interventions');
  interventionsCountBeforeImport = current.length;

  // Upload vers le backend
  const formData = new FormData();
  formData.append('devis', file);

  try {
    const res = await fetch('/api/devis/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || 'Erreur upload', data.detail || '', 'error');
      closeDropzone();
      return;
    }

    // Polling : on attend que n8n réponde et crée l'intervention
    pdfPollInterval = setInterval(async () => {
      const interventions = await api('/interventions');
      if (interventions.length > interventionsCountBeforeImport) {
        clearInterval(pdfPollInterval);
        pdfPollInterval = null;
        closeDropzone();
        loadInterventions();
        toast('Intervention créée', `Devis PDF importé — ${file.name}`);
      }
    }, 2000);

    // Timeout au bout de 30 secondes
    setTimeout(() => {
      if (pdfPollInterval) {
        clearInterval(pdfPollInterval);
        pdfPollInterval = null;
        closeDropzone();
        toast('Analyse échouée', 'Impossible de lire le devis — réessayez ou créez l\'intervention manuellement', 'error');
      }
    }, 30000);

  } catch (err) {
    toast('Erreur réseau', err.message, 'error');
    closeDropzone();
  }
}

// ─── RAPPELS ──────────────────────────────────────────────
async function loadRappels() {
  const list = document.getElementById('rappels-list');
  list.innerHTML = skeleton(3);
  const data = await api('/rappels');
  const today = new Date().toISOString().split('T')[0];
  const dus = data.filter(r => r.date_rappel && r.date_rappel.split('T')[0] <= today);
  const aVenir = data.filter(r => !r.date_rappel || r.date_rappel.split('T')[0] > today);

  document.getElementById('rappels-count').textContent =
    `${data.length} rappel${data.length > 1 ? 's' : ''} à envoyer${dus.length ? ` — ${dus.length} dû${dus.length > 1 ? 's' : ''}` : ''}`;

  if (!data.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">🔔</div>Aucun rappel pour le moment.<br>Les rappels sont créés automatiquement quand une intervention est terminée.</div>';
    return;
  }

  const renderRappel = (r) => {
    const estDu = r.date_rappel && r.date_rappel.split('T')[0] <= today;
    return `
    <div class="rappel-card ${estDu ? 'rappel-du' : ''}" id="rappel-${r.id}">
      <div class="rappel-top">
        <div>
          <div class="rappel-nom">${r.nom || 'Client inconnu'}</div>
          <div class="rappel-vehicule">${r.vehicule || ''} ${r.telephone ? '· ' + r.telephone : ''}</div>
        </div>
        <div class="rappel-date-wrap">
          ${estDu ? '<span class="rappel-badge-du">À envoyer</span>' : ''}
          <div class="rappel-date">${fmtDate(r.date_rappel)}</div>
        </div>
      </div>
      <textarea class="rappel-message" id="msg-${r.id}" rows="3">${r.message || ''}</textarea>
      <div class="rappel-actions">
        <button class="btn btn-secondary btn-sm" onclick="saveRappelMessage(${r.id})">Modifier le message</button>
        <button class="btn btn-secondary btn-sm" onclick="editDateRappel(${r.id})">Changer la date</button>
        <button class="btn btn-primary btn-sm" onclick="envoyerRappel(${r.id})">Envoyer le SMS</button>
      </div>
    </div>`;
  };

  let html = '';
  if (dus.length) {
    html += `<div class="rappels-group-title">À envoyer maintenant</div>`;
    html += dus.map(renderRappel).join('');
  }
  if (aVenir.length) {
    html += `<div class="rappels-group-title" style="margin-top:20px">À venir</div>`;
    html += aVenir.map(renderRappel).join('');
  }
  list.innerHTML = html;
}

async function saveRappelMessage(id) {
  const message = document.getElementById(`msg-${id}`).value;
  await api(`/rappels/${id}`, { method: 'PATCH', body: JSON.stringify({ message }) });
  toast('Message sauvegardé');
}

async function editDateRappel(id) {
  const newDate = prompt('Nouvelle date de rappel (YYYY-MM-DD) :');
  if (!newDate) return;
  await api(`/rappels/${id}`, { method: 'PATCH', body: JSON.stringify({ date_rappel: newDate }) });
  toast('Date mise à jour');
  loadRappels();
}

async function envoyerRappel(id) {
  const message = document.getElementById(`msg-${id}`).value;
  await api(`/rappels/${id}`, { method: 'PATCH', body: JSON.stringify({ message }) });
  await api(`/rappels/${id}/envoyer`, { method: 'POST' });
  toast('SMS envoyé', 'Le rappel a été envoyé au client');
  loadRappels();
  updateBadgeRappels();
}

async function updateBadgeRappels() {
  const { count } = await api('/rappels/dus');
  const badge = document.getElementById('badge-rappels');
  const badgeMobile = document.getElementById('badge-rappels-mobile');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
    badgeMobile.textContent = count;
    badgeMobile.style.display = '';
  } else {
    badge.style.display = 'none';
    badgeMobile.style.display = 'none';
  }
}

updateBadgeRappels();
setInterval(updateBadgeRappels, 30000);

// ─── DASHBOARD ────────────────────────────────────────────
async function loadStats() {
  const now = new Date();
  document.getElementById('dashboard-date').textContent =
    now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const s = await api('/stats');

  // Variation CA
  const caVar = s.ca.prev > 0 ? Math.round(((s.ca.mois - s.ca.prev) / s.ca.prev) * 100) : null;
  const caVarHtml = caVar !== null
    ? `<span class="stat-var ${caVar >= 0 ? 'var-up' : 'var-down'}">${caVar >= 0 ? '▲' : '▼'} ${Math.abs(caVar)} %</span>`
    : '';

  // Variation interventions
  const intVar = s.interventions.prev > 0 ? Math.round(((s.interventions.mois - s.interventions.prev) / s.interventions.prev) * 100) : null;
  const intVarHtml = intVar !== null
    ? `<span class="stat-var ${intVar >= 0 ? 'var-up' : 'var-down'}">${intVar >= 0 ? '▲' : '▼'} ${Math.abs(intVar)} %</span>`
    : '';

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">CA du mois</div>
      <div class="stat-card-value">${Number(s.ca.mois).toFixed(0)} €</div>
      <div class="stat-card-sub">Mois précédent : ${Number(s.ca.prev).toFixed(0)} € ${caVarHtml}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Interventions du mois</div>
      <div class="stat-card-value">${s.interventions.mois}</div>
      <div class="stat-card-sub">Mois précédent : ${s.interventions.prev} ${intVarHtml}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Appels du mois</div>
      <div class="stat-card-value">${s.appels.mois}</div>
      <div class="stat-card-sub">Interventions en attente : ${s.aTraiter}</div>
    </div>
    <div class="stat-card ${s.tauxConversion !== null && s.tauxConversion < 30 ? 'stat-card-warn' : ''}">
      <div class="stat-card-label">Taux de conversion</div>
      <div class="stat-card-value">${s.tauxConversion !== null ? s.tauxConversion + ' %' : '—'}</div>
      <div class="stat-card-sub">Appels → interventions</div>
    </div>
  `;

  // Statuts
  document.getElementById('dashboard-statuts').innerHTML = s.statuts.length ? `
    <div class="dashboard-block-title">Répartition par statut</div>
    <div class="statuts-list">
      ${s.statuts.map(st => `
        <div class="statut-row">
          <span class="statut-label status status-${statutClass(st.statut)}">${st.statut}</span>
          <span class="statut-count">${st.count}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Interventions en retard
  document.getElementById('dashboard-retard').innerHTML = s.retard.length ? `
    <div class="dashboard-block-title retard-title">⚠️ Interventions en retard (${s.retard.length})</div>
    <div class="retard-list">
      ${s.retard.map(r => `
        <div class="retard-card">
          <div class="retard-left">
            <div class="retard-nom">${r.nom || 'Client inconnu'}</div>
            <div class="retard-vehicule">${r.vehicule || '—'}</div>
            <div class="retard-probleme">${r.probleme || '—'}</div>
          </div>
          <div class="retard-right">
            <span class="status status-${statutClass(r.statut)}">${r.statut}</span>
            <div class="retard-date">Prévu ${fmtDate(r.date_intervention)}</div>
            ${r.telephone ? `<a class="btn-rappeler" href="tel:${r.telephone}">📞 Appeler</a>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '<div class="empty" style="padding:20px"><div class="empty-icon">✅</div>Aucune intervention en retard</div>';
}

// ─── VUE INTERVENTIONS (liste / calendrier) ───────────────
let vueInterventions = 'liste';
let calDate = new Date(); // jour affiché dans le calendrier

function setVueInterventions(vue) {
  vueInterventions = vue;
  document.getElementById('btn-vue-liste').classList.toggle('active', vue === 'liste');
  document.getElementById('btn-vue-cal').classList.toggle('active', vue === 'calendrier');
  document.getElementById('interventions-list').style.display = vue === 'liste' ? '' : 'none';
  document.getElementById('calendrier-wrapper').style.display = vue === 'calendrier' ? '' : 'none';
  if (vue === 'calendrier') renderCalendrier();
  if (vue === 'liste') loadInterventions();
}

async function renderCalendrier() {
  const wrapper = document.getElementById('calendrier-wrapper');
  const data = await api('/interventions');

  // Filtrer les interventions avec une date_intervention
  const avecDate = data.filter(i => i.date_intervention);

  const joursNom = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const moisNom = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

  const dateStr = calDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const jourNom = joursNom[calDate.getDay()];
  const moisLabel = moisNom[calDate.getMonth()];
  const label = `${jourNom} ${calDate.getDate()} ${moisLabel} ${calDate.getFullYear()}`;

  // Interventions de ce jour
  const duJour = avecDate.filter(i => {
    const d = i.date_intervention.split('T')[0];
    return d === dateStr;
  });

  // Générer créneaux horaires 7h→19h
  const heures = Array.from({length: 13}, (_, k) => k + 7); // 7..19

  // Regrouper les interventions par heure (si pas d'heure, on met en "toute la journée")
  const parHeure = {};
  const touteLaJournee = [];

  duJour.forEach(i => {
    const raw = i.date_intervention;
    let h = null;
    if (raw && raw.includes('T')) {
      const parsed = new Date(raw);
      if (!isNaN(parsed)) h = parsed.getHours();
    }
    if (h !== null && h >= 7 && h <= 19) {
      if (!parHeure[h]) parHeure[h] = [];
      parHeure[h].push(i);
    } else {
      touteLaJournee.push(i);
    }
  });

  const eventHtml = (i) => {
    const sc = statutClass(i.statut);
    return `<div class="cal-event statut-${sc}" onclick="editIntervention(${i.id})">
      <div class="cal-event-nom">${i.nom || 'Client inconnu'} · ${i.vehicule || '—'}</div>
      <div class="cal-event-detail">${i.probleme || '—'} <span class="status status-${sc}" style="font-size:10px;padding:2px 6px">${i.statut}</span></div>
    </div>`;
  };

  const slotsHtml = heures.map(h => {
    const events = parHeure[h] || [];
    const hStr = String(h).padStart(2, '0') + 'h';
    return `<div class="cal-slot">
      <div class="cal-slot-heure">${hStr}</div>
      <div class="cal-slot-content">${events.map(eventHtml).join('') || ''}</div>
    </div>`;
  }).join('');

  const touteLaJourneeHtml = touteLaJournee.length
    ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Toute la journée</div>
        ${touteLaJournee.map(eventHtml).join('')}
       </div>`
    : '';

  const isToday = dateStr === new Date().toISOString().split('T')[0];

  wrapper.innerHTML = `
    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="calNaviguer(-1)">‹</button>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="cal-nav-date">${label}</div>
        ${!isToday ? `<button class="cal-nav-today" onclick="calAujourdhui()">Aujourd'hui</button>` : ''}
      </div>
      <button class="cal-nav-btn" onclick="calNaviguer(1)">›</button>
    </div>
    ${touteLaJourneeHtml}
    ${duJour.length === 0 ? '<div class="cal-empty" style="text-align:center;padding:32px 0">Aucune intervention prévue ce jour</div>' : ''}
    <div class="cal-slots">${slotsHtml}</div>
  `;
}

function calNaviguer(delta) {
  calDate = new Date(calDate);
  calDate.setDate(calDate.getDate() + delta);
  renderCalendrier();
}

function calAujourdhui() {
  calDate = new Date();
  renderCalendrier();
}

// ─── LOADERS ──────────────────────────────────────────────
const loaders = {
  dashboard: loadStats,
  interventions: loadInterventions,
  clients: loadClients,
  appels: loadAppels,
  rappels: loadRappels,
  avis: loadAvis
};

// Chargement initial
loadStats();

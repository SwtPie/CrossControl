// ════════════════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════════════════
let state = {
  screen: 'events',       // 'events' | 'event'
  evenement: null,        // {id, nom, date, lieu} de l'événement actif
  page: 'dashboard',
  participants: [],
  courses: [],
  editParticipantId: null,
  editCourseId: null,
  filterSearch: '',
};

// ════════════════════════════════════════════════════════════════════════════════
// API & UTILS
// ════════════════════════════════════════════════════════════════════════════════
let api = null;

async function call(method, ...args) {
  if (!api) { console.error('[API] non disponible'); return null; }
  try {
    const result = await api[method](...args);
    return result;
  } catch (err) {
    console.error(`[API] ${method} EXCEPTION:`, err);
    return null;
  }
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast-${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('toast-hide'), 3500);
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function vmaColor(vma) {
  if (!vma) return 'gray';
  if (vma < 11) return 'blue';
  if (vma < 13) return 'yellow';
  if (vma < 15) return 'orange';
  return 'green';
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }

// ════════════════════════════════════════════════════════════════════════════════
// ROUTING : EVENTS SCREEN vs EVENT SCREEN
// ════════════════════════════════════════════════════════════════════════════════
function showScreen(screen) {
  state.screen = screen;
  document.getElementById('screen-events').classList.toggle('hidden', screen !== 'events');
  document.getElementById('screen-event').classList.toggle('hidden', screen !== 'event');
  document.getElementById('sidebar').classList.toggle('hidden', screen !== 'event');
}

async function openEvenement(eid) {
  const res = await call('open_evenement', eid);
  if (!res?.success) { toast(res?.error || 'Erreur', 'error'); return; }
  state.evenement = res.evenement;
  state.page      = 'dashboard';
  document.getElementById('event-name-badge').textContent = res.evenement.nom;
  showScreen('event');
  await refreshData();
  render();
}

async function closeEvenement() {
  await call('close_evenement');
  state.evenement = null;
  showScreen('events');
  await renderEvents();
}

// ════════════════════════════════════════════════════════════════════════════════
// ÉCRAN : LISTE DES ÉVÉNEMENTS
// ════════════════════════════════════════════════════════════════════════════════
let editEventId = null;

async function renderEvents() {
  const events = await call('get_evenements') || [];
  const container = document.getElementById('events-list');

  if (!events.length) {
    container.innerHTML = `
      <div class="empty" style="padding:80px 24px">
        <div class="empty-icon">🏁</div>
        <p>Aucun événement.<br>Créez votre premier cross !</p>
        <div style="margin-top:24px">
          <button class="btn btn-primary" onclick="openCreateEvent()">+ Créer un événement</button>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = events.map(e => `
    <div class="event-card" onclick="openEvenement(${e.id})">
      <div class="event-card-body">
        <div class="event-card-title">${e.nom}</div>
        <div class="event-card-meta">
          ${e.date ? `<span>📅 ${e.date}</span>` : ''}
          ${e.lieu ? `<span>📍 ${e.lieu}</span>` : ''}
        </div>
        ${e.description ? `<div class="event-card-desc">${e.description}</div>` : ''}
        <div class="event-card-stats">
          <span class="badge badge-blue">${e.nb_participants} participant(s)</span>
          <span class="badge badge-yellow">${e.nb_courses} course(s)</span>
        </div>
      </div>
      <div class="event-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openEditEvent(${e.id},'${escStr(e.nom)}','${escStr(e.date||'')}','${escStr(e.lieu||'')}','${escStr(e.description||'')}')">Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id},'${escStr(e.nom)}')">Supprimer</button>
      </div>
    </div>
  `).join('');
}

function escStr(s) {
  return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function openCreateEvent() {
  editEventId = null;
  document.getElementById('modal-event-title').textContent = 'Nouvel événement';
  ['event-nom','event-date','event-lieu','event-desc'].forEach(id => document.getElementById(id).value = '');
  openModal('modal-event');
}

function openEditEvent(id, nom, date, lieu, desc) {
  editEventId = id;
  document.getElementById('modal-event-title').textContent = 'Modifier l\'événement';
  document.getElementById('event-nom').value  = nom;
  document.getElementById('event-date').value = date;
  document.getElementById('event-lieu').value = lieu;
  document.getElementById('event-desc').value = desc;
  openModal('modal-event');
}

async function saveEvent() {
  const nom = document.getElementById('event-nom').value.trim();
  if (!nom) { toast('Nom requis', 'error'); return; }
  const data = {
    nom,
    date:        document.getElementById('event-date').value.trim(),
    lieu:        document.getElementById('event-lieu').value.trim(),
    description: document.getElementById('event-desc').value.trim(),
  };
  const btn = document.querySelector('#modal-event .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement...'; }

  let res;
  if (editEventId) {
    res = await call('update_evenement', editEventId, data);
  } else {
    res = await call('create_evenement', data);
  }

  if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer'; }

  if (res?.success) {
    closeModal('modal-event');
    toast(editEventId ? 'Événement modifié' : 'Événement créé');
    await renderEvents();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

async function deleteEvent(id, nom) {
  if (!confirm(`Supprimer "${nom}" et toutes ses données définitivement ?`)) return;
  const res = await call('delete_evenement', id);
  if (res?.success) {
    toast('Événement supprimé');
    await renderEvents();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// NAVIGATION INTERNE (dans un événement)
// ════════════════════════════════════════════════════════════════════════════════
async function navigate(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  await refreshData();
  render();
}

async function refreshData() {
  const [participants, courses, stats] = await Promise.all([
    call('get_participants'),
    call('get_courses'),
    call('get_stats'),
  ]);
  state.participants = participants || [];
  state.courses      = courses      || [];
  if (stats) {
    document.getElementById('stat-participants').textContent = stats.participants;
    document.getElementById('stat-courses').textContent      = stats.courses;
    document.getElementById('stat-arrivees').textContent     = stats.arrivees;
  }
}

function render() {
  const titles = {
    dashboard:    'Tableau de bord',
    participants: 'Participants',
    courses:      'Gestion des courses',
    live:         'Course en direct',
    terminees:    'Courses terminées',
    classement:   'Classement & résultats',
    statistiques: 'Statistiques',
    parametres:   'Paramètres',
  };
  document.getElementById('page-title').textContent       = titles[state.page] || '';
  document.getElementById('topbar-actions').innerHTML     = '';
  const pages = {
    dashboard:    renderDashboard,
    participants: renderParticipants,
    courses:      renderCourses,
    live:         renderLive,
    terminees:    renderTerminees,
    classement:    renderClassement,
    statistiques:  renderStatistiques,
    parametres:    renderParametres,
  };
  (pages[state.page] || (() => {}))();
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : DASHBOARD
// ════════════════════════════════════════════════════════════════════════════════
function renderDashboard() {
  const enCours    = state.courses.find(c => c.statut === 'en_cours');
  const prochaines = state.courses.filter(c => c.statut === 'preparation').slice(0, 3);
  const terminees  = state.courses.filter(c => c.statut === 'terminee').slice(0, 3);

  document.getElementById('content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div class="card" style="border-left:3px solid var(--accent)">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono);margin-bottom:8px">Participants</div>
        <div style="font-family:var(--font-mono);font-size:36px;font-weight:600;color:var(--accent)">${state.participants.length}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">inscrits</div>
      </div>
      <div class="card" style="border-left:3px solid var(--blue)">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono);margin-bottom:8px">Courses</div>
        <div style="font-family:var(--font-mono);font-size:36px;font-weight:600;color:var(--blue)">${state.courses.length}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">${state.courses.filter(c=>c.statut==='terminee').length} terminée(s)</div>
      </div>
      <div class="card" style="border-left:3px solid ${enCours ? 'var(--accent2)' : 'var(--text3)'}">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono);margin-bottom:8px">En ce moment</div>
        <div style="font-size:16px;font-weight:600;color:${enCours ? 'var(--accent2)' : 'var(--text3)'};margin-top:8px">
          ${enCours ? `⚡ ${enCours.nom}` : '— Aucune course active'}
        </div>
        ${enCours ? `<div style="margin-top:8px"><button class="btn btn-orange btn-sm" onclick="navigate('live')">→ Tableau de bord</button></div>` : ''}
      </div>
    </div>

    ${prochaines.length ? `
    <div class="card">
      <div class="card-title">Prochaines courses</div>
      <table>
        <thead><tr><th>Course</th><th>Distance</th><th>VMA</th><th></th></tr></thead>
        <tbody>${prochaines.map(c => `
          <tr>
            <td><strong>${c.nom}</strong></td>
            <td style="font-family:var(--font-mono)">${c.distance ? c.distance+'m' : '—'}</td>
            <td>${c.vma_min && c.vma_max ? `<span class="badge badge-yellow">${c.vma_min}–${c.vma_max}</span>` : '—'}</td>
            <td><button class="btn btn-orange btn-sm" onclick="navigate('live');setTimeout(()=>selectCourseForLive(${c.id}),200)">▶ Lancer</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${terminees.length ? `
    <div class="card">
      <div class="card-title">Dernières courses terminées</div>
      <table>
        <thead><tr><th>Course</th><th>Distance</th><th>Statut</th><th></th></tr></thead>
        <tbody>${terminees.map(c => `
          <tr>
            <td><strong>${c.nom}</strong></td>
            <td style="font-family:var(--font-mono)">${c.distance ? c.distance+'m' : '—'}</td>
            <td><span class="badge badge-green">Terminée</span></td>
            <td><button class="btn btn-ghost btn-sm" onclick="navigate('classement');setTimeout(()=>selectCourseForClassement(${c.id}),200)">Résultats</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${!prochaines.length && !terminees.length && !enCours ? `
    <div class="empty">
      <div class="empty-icon">🏃</div>
      <p>Bienvenue dans <strong>${state.evenement?.nom || 'cet événement'}</strong> !<br>Commencez par ajouter des participants, puis créez vos courses.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
        <button class="btn btn-primary" onclick="navigate('participants')">Ajouter des participants</button>
        <button class="btn btn-ghost"   onclick="navigate('courses')">Créer une course</button>
      </div>
    </div>` : ''}
  `;
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : PARTICIPANTS
// ════════════════════════════════════════════════════════════════════════════════
// sort state : { col: 'nom'|'prenom'|'etablissement'|'vma'|null, dir: 1|-1 }
let _pSort = { col: null, dir: 1 };

function _sortParticipants(col) {
  if (_pSort.col === col) {
    _pSort.dir *= -1;
  } else {
    _pSort.col = col;
    _pSort.dir = 1;
  }
  _renderParticipantsTable();
}

function renderParticipants() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="autoAssignDossards()">Auto-dossards</button>
    <button class="btn btn-ghost btn-sm" onclick="openImportModal()">📥 Importer</button>
    <button class="btn btn-ghost btn-sm" onclick="openExportParticipants()">📤 Export</button>
    <button class="btn btn-ghost btn-sm" onclick="openOptionsAvancees()">⚙️ Options</button>
    <button class="btn btn-primary" onclick="openAddParticipant()">+ Ajouter</button>
  `;
  // Ne recréer la structure que si elle n'existe pas encore (évite de perdre le focus sur l'input)
  if (!document.getElementById('participants-table-container')) {
    document.getElementById('content').innerHTML = `
      <div class="search-bar">
        <input type="text" id="participants-search" placeholder="Rechercher…"
          oninput="state.filterSearch=this.value;_renderParticipantsTable()">
        <span id="participants-count" style="font-size:12px;color:var(--text3);align-self:center;white-space:nowrap"></span>
      </div>
      <div class="card" id="participants-table-container"></div>
    `;
    document.getElementById('participants-search').value = state.filterSearch;
  }
  _renderParticipantsTable();
}

function _renderParticipantsTable() {
  const q = state.filterSearch.toLowerCase();
  let filtered = state.participants.filter(p =>
    !q || `${p.nom} ${p.prenom} ${p.classe} ${p.etablissement}`.toLowerCase().includes(q)
  );

  // Tri
  if (_pSort.col) {
    filtered = [...filtered].sort((a, b) => {
      let va = a[_pSort.col] ?? '';
      let vb = b[_pSort.col] ?? '';
      if (_pSort.col === 'vma') {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
        return (va - vb) * _pSort.dir;
      }
      return va.toString().localeCompare(vb.toString(), 'fr') * _pSort.dir;
    });
  }

  const count = document.getElementById('participants-count');
  if (count) count.textContent = `${filtered.length} / ${state.participants.length}`;
  const container = document.getElementById('participants-table-container');
  if (!container) return;

  // Indicateur de tri dans les en-têtes
  const arrow = (col) => {
    if (_pSort.col !== col) return '<span style="opacity:.25;font-size:10px"> ⇅</span>';
    return _pSort.dir === 1
      ? '<span style="font-size:10px"> ↑</span>'
      : '<span style="font-size:10px"> ↓</span>';
  };
  const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap';

  container.innerHTML = `
    <table>
      <thead><tr>
        <th>Dossard</th>
        <th style="${thStyle}" onclick="_sortParticipants('nom')">Nom${arrow('nom')}</th>
        <th style="${thStyle}" onclick="_sortParticipants('prenom')">Prénom${arrow('prenom')}</th>
        <th>Classe</th>
        <th style="${thStyle}" onclick="_sortParticipants('etablissement')">Établissement${arrow('etablissement')}</th>
        <th>Sexe</th>
        <th style="${thStyle}" onclick="_sortParticipants('vma')">VMA${arrow('vma')}</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${filtered.length ? filtered.map(p => `
          <tr>
            <td><span class="badge badge-yellow" style="font-family:var(--font-mono)">${p.dossard ?? '—'}</span></td>
            <td><strong>${p.nom}</strong></td>
            <td>${p.prenom}</td>
            <td>${p.classe || '—'}</td>
            <td>${p.etablissement || '—'}</td>
            <td>${p.sexe === 'F' ? 'F' : p.sexe === 'M' ? 'M' : '—'}</td>
            <td><span class="badge badge-${vmaColor(p.vma)}">${p.vma ?? '—'}</span></td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="openEditParticipant(${p.id})">Modifier</button>
              <button class="btn btn-danger btn-sm" onclick="deleteParticipant(${p.id},'${p.nom} ${p.prenom}')">Suppr.</button>
            </td>
          </tr>`).join('')
        : `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px">Aucun participant</td></tr>`}
      </tbody>
    </table>
  `;
}

function openAddParticipant() {
  state.editParticipantId = null;
  document.getElementById('modal-participant-title').textContent = 'Ajouter un participant';
  ['nom','prenom','classe','etablissement','vma','dossard'].forEach(f => document.getElementById(`p-${f}`).value = '');
  document.getElementById('p-sexe').value = '';
  openModal('modal-participant');
}

function openEditParticipant(id) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;
  state.editParticipantId = id;
  document.getElementById('modal-participant-title').textContent = 'Modifier le participant';
  document.getElementById('p-nom').value           = p.nom || '';
  document.getElementById('p-prenom').value        = p.prenom || '';
  document.getElementById('p-classe').value        = p.classe || '';
  document.getElementById('p-etablissement').value = p.etablissement || '';
  document.getElementById('p-sexe').value          = p.sexe || '';
  document.getElementById('p-vma').value           = p.vma ?? '';
  document.getElementById('p-dossard').value       = p.dossard ?? '';
  openModal('modal-participant');
}

async function saveParticipant() {
  const nom    = document.getElementById('p-nom').value.trim();
  const prenom = document.getElementById('p-prenom').value.trim();
  if (!nom || !prenom) { toast('Nom et prénom requis', 'error'); return; }
  const data = {
    nom, prenom,
    classe:        document.getElementById('p-classe').value.trim(),
    etablissement: document.getElementById('p-etablissement').value.trim(),
    sexe:          document.getElementById('p-sexe').value,
    vma:           parseFloat(document.getElementById('p-vma').value) || null,
    dossard:       parseInt(document.getElementById('p-dossard').value) || null,
  };
  const btn = document.querySelector('#modal-participant .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement...'; }
  const res = state.editParticipantId
    ? await call('update_participant', state.editParticipantId, data)
    : await call('add_participant', data);
  if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer'; }
  if (res?.success) {
    closeModal('modal-participant');
    toast(state.editParticipantId ? 'Participant modifié' : 'Participant ajouté');
    await refreshData();
    renderParticipants();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

async function deleteParticipant(id, name) {
  if (!confirm(`Supprimer ${name} ?`)) return;
  await call('delete_participant', id);
  toast('Participant supprimé');
  await refreshData();
  renderParticipants();
}

async function autoAssignDossards() {
  const start = parseInt(prompt('Numéro de dossard de départ ?', '1')) || 1;
  const res = await call('auto_assign_dossards', start);
  if (res?.success) {
    toast(`${res.count} dossards attribués`);
    await refreshData();
    renderParticipants();
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : COURSES
// ════════════════════════════════════════════════════════════════════════════════
let courseTab = 'liste';
let selectedCourseDetailId = null;
let courseParticipants = [];
let showMasquees = false;

async function renderCourses() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="showMasquees=!showMasquees;renderCourses()">
      ${showMasquees ? 'Masquer terminées' : 'Afficher tout'}
    </button>
    <button class="btn btn-primary" onclick="openAddCourse()">+ Nouvelle course</button>
  `;
  if (selectedCourseDetailId) {
    courseParticipants = (await call('get_course_participants', selectedCourseDetailId)) || [];
  }
  const course = state.courses.find(c => c.id === selectedCourseDetailId);
  const visibleCourses = state.courses.filter(c =>
    showMasquees ? true : !(c.statut === 'terminee' && c.masquee)
  );

  document.getElementById('content').innerHTML = `
    <div class="two-col">
      <div>
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="margin-bottom:0">Courses créées</div>
            ${state.courses.filter(c=>c.masquee).length ? `<span class="badge badge-gray">${state.courses.filter(c=>c.masquee).length} masquée(s)</span>` : ''}
          </div>
          ${visibleCourses.length ? `<table>
            <thead><tr><th>Nom</th><th>Distance</th><th>Statut</th><th></th></tr></thead>
            <tbody>${visibleCourses.map(c => `
              <tr style="cursor:pointer;opacity:${c.masquee?'0.5':'1'};${c.id===selectedCourseDetailId?'background:rgba(214,10,60,.05)':''}" onclick="selectCourseDetail(${c.id})">
                <td><strong>${c.nom}</strong>${c.masquee?'<span style="font-size:10px;color:var(--text3)"> (masquée)</span>':''}</td>
                <td style="font-family:var(--font-mono)">${c.distance ? c.distance+'m' : '—'}</td>
                <td>${statusBadge(c.statut)}</td>
                <td style="display:flex;gap:4px">
                  ${c.statut==='terminee' ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();toggleMasquer(${c.id})">${c.masquee?'Afficher':'Masquer'}</button>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditCourse(${c.id})">Modifier</button>
                  <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteCourse(${c.id},'${c.nom}')">Suppr.</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>` : `<div class="empty"><div class="empty-icon">🏁</div><p>Aucune course visible.</p></div>`}
        </div>
      </div>
      <div>
        ${course ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title" style="margin-bottom:0">${course.nom}</div>
            ${statusBadge(course.statut)}
          </div>
          <div class="info-row">
            <div class="info-item"><div class="lbl">Distance</div><div class="val">${course.distance ? course.distance+'m' : '—'}</div></div>
            <div class="info-item"><div class="lbl">VMA min</div><div class="val">${course.vma_min ?? '—'}</div></div>
            <div class="info-item"><div class="lbl">VMA max</div><div class="val">${course.vma_max ?? '—'}</div></div>
            <div class="info-item"><div class="lbl">Participants</div><div class="val">${courseParticipants.length}</div></div>
          </div>
          <div style="margin-bottom:16px">
            <button class="btn btn-blue btn-sm" onclick="openAjoutRapide(${course.id})">⚡ Ajout rapide</button>
            <button class="btn btn-ghost btn-sm" onclick="openExportCourse(${course.id})">📤 Export</button>
          </div>
          <div class="tabs">
            <div class="tab ${courseTab==='liste'?'active':''}" onclick="courseTab='liste';renderCourses()">Inscrits (${courseParticipants.length})</div>
            <div class="tab ${courseTab==='ajouter'?'active':''}" onclick="courseTab='ajouter';renderCourses()">Ajouter</div>
          </div>
          ${courseTab==='liste' ? `
            ${courseParticipants.length ? `<table>
              <thead><tr><th>Dossard</th><th>Nom</th><th>Classe</th><th>VMA</th><th></th></tr></thead>
              <tbody>${courseParticipants.map(p => `
                <tr>
                  <td><span class="badge badge-yellow">${p.dossard ?? '—'}</span></td>
                  <td>${p.nom} ${p.prenom}</td>
                  <td>${p.classe || '—'}</td>
                  <td><span class="badge badge-${vmaColor(p.vma)}">${p.vma ?? '—'}</span></td>
                  <td><button class="btn btn-danger btn-sm" onclick="removeFromCourse(${course.id},${p.id})">✕</button></td>
                </tr>`).join('')}
              </tbody>
            </table>` : `<div class="empty" style="padding:24px"><p>Aucun inscrit.</p></div>`}
          ` : `
            <input type="text" id="add-search" placeholder="Rechercher…" oninput="renderAddList()"
              style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:8px 10px;font-family:var(--font);font-size:13px;outline:none;margin-bottom:10px">
            <div id="add-list" style="max-height:280px;overflow-y:auto"></div>
          `}
        </div>` : `
        <div class="card">
          <div class="empty"><div class="empty-icon">👈</div><p>Sélectionnez une course</p></div>
        </div>`}
      </div>
    </div>
  `;
  if (courseTab === 'ajouter' && course) renderAddList();
}

function renderAddList() {
  const q = (document.getElementById('add-search')?.value || '').toLowerCase();
  const inscritIds = new Set(courseParticipants.map(p => p.id));
  const available  = state.participants.filter(p =>
    !inscritIds.has(p.id) && (!q || `${p.nom} ${p.prenom} ${p.classe}`.toLowerCase().includes(q))
  );
  const el = document.getElementById('add-list');
  if (!el) return;
  el.innerHTML = available.length ? `<table>
    <thead><tr><th>Dossard</th><th>Nom</th><th>Classe</th><th>VMA</th><th></th></tr></thead>
    <tbody>${available.map(p => `
      <tr>
        <td><span class="badge badge-yellow">${p.dossard ?? '—'}</span></td>
        <td>${p.nom} ${p.prenom}</td>
        <td>${p.classe || '—'}</td>
        <td><span class="badge badge-${vmaColor(p.vma)}">${p.vma ?? '—'}</span></td>
        <td><button class="btn btn-success btn-sm" onclick="addToCourse(${selectedCourseDetailId},${p.id})">Inscrire</button></td>
      </tr>`).join('')}
    </tbody>
  </table>` : `<div class="empty" style="padding:16px"><p>Aucun participant disponible</p></div>`;
}

async function selectCourseDetail(id) { selectedCourseDetailId = id; courseTab = 'liste'; await renderCourses(); }
async function toggleMasquer(cid) {
  const res = await call('toggle_masquer_course', cid);
  if (res?.success) { await refreshData(); renderCourses(); toast(res.masquee ? 'Course masquée' : 'Course affichée'); }
}
async function addToCourse(cid, pid) {
  await call('add_participant_to_course', cid, pid);
  courseParticipants = (await call('get_course_participants', cid)) || [];
  renderCourses();
}
async function removeFromCourse(cid, pid) {
  await call('remove_participant_from_course', cid, pid);
  courseParticipants = (await call('get_course_participants', cid)) || [];
  renderCourses();
}
async function autoAddByVma(cid) {
  const res = await call('auto_add_by_vma', cid);
  if (res?.success) {
    toast(`${res.count} participant(s) ajouté(s)`);
    courseParticipants = (await call('get_course_participants', cid)) || [];
    renderCourses();
  } else { toast(res?.error || 'Erreur', 'error'); }
}

// ── AJOUT RAPIDE ──
let ajoutRapideCourseId = null;

function openAjoutRapide(cid) {
  ajoutRapideCourseId = cid;

  // Calculer les valeurs uniques pour les selects
  const classes = [...new Set(state.participants.map(p => p.classe).filter(Boolean))].sort();
  const etablissements = [...new Set(state.participants.map(p => p.etablissement).filter(Boolean))].sort();

  // Pré-remplir les VMA min/max depuis la course si dispo
  const course = state.courses.find(c => c.id === cid);

  document.getElementById('ar-sexe').value = '';
  document.getElementById('ar-vma-min').value = course?.vma_min ?? '';
  document.getElementById('ar-vma-max').value = course?.vma_max ?? '';

  // Remplir les selects classes et établissements
  const selClasse = document.getElementById('ar-classe');
  selClasse.innerHTML = `<option value="">Toutes</option>` + classes.map(c => `<option value="${c}">${c}</option>`).join('');

  const selEtab = document.getElementById('ar-etablissement');
  selEtab.innerHTML = `<option value="">Tous</option>` + etablissements.map(e => `<option value="${e}">${e}</option>`).join('');

  previewAjoutRapide();
  openModal('modal-ajout-rapide');
}

function previewAjoutRapide() {
  const inscritIds = new Set(courseParticipants.map(p => p.id));
  const filtered = filteredAjoutRapide(inscritIds);
  const el = document.getElementById('ar-preview');
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = `<div class="empty" style="padding:16px"><p>Aucun participant ne correspond aux filtres.</p></div>`;
    document.getElementById('ar-count').textContent = '0 participant(s) à ajouter';
    return;
  }

  document.getElementById('ar-count').textContent = `${filtered.length} participant(s) à ajouter`;
  el.innerHTML = `<table>
    <thead><tr><th>Dossard</th><th>Nom</th><th>Sexe</th><th>Classe</th><th>Établissement</th><th>VMA</th></tr></thead>
    <tbody>${filtered.map(p => `
      <tr>
        <td><span class="badge badge-yellow">${p.dossard ?? '—'}</span></td>
        <td>${p.nom} ${p.prenom}</td>
        <td>${p.sexe || '—'}</td>
        <td>${p.classe || '—'}</td>
        <td style="font-size:12px;color:var(--text2)">${p.etablissement || '—'}</td>
        <td><span class="badge badge-${vmaColor(p.vma)}">${p.vma ?? '—'}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function filteredAjoutRapide(inscritIds) {
  const sexe  = document.getElementById('ar-sexe')?.value || '';
  const vmaMin = parseFloat(document.getElementById('ar-vma-min')?.value) || null;
  const vmaMax = parseFloat(document.getElementById('ar-vma-max')?.value) || null;
  const classe = document.getElementById('ar-classe')?.value || '';
  const etab   = document.getElementById('ar-etablissement')?.value || '';

  return state.participants.filter(p => {
    if (inscritIds.has(p.id)) return false;
    if (sexe && p.sexe !== sexe) return false;
    if (vmaMin !== null && (p.vma == null || p.vma < vmaMin)) return false;
    if (vmaMax !== null && (p.vma == null || p.vma > vmaMax)) return false;
    if (classe && p.classe !== classe) return false;
    if (etab && p.etablissement !== etab) return false;
    return true;
  });
}

async function confirmerAjoutRapide() {
  const inscritIds = new Set(courseParticipants.map(p => p.id));
  const toAdd = filteredAjoutRapide(inscritIds);
  if (!toAdd.length) { toast('Aucun participant à ajouter', 'error'); return; }

  const btn = document.getElementById('ar-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Ajout en cours...'; }

  let count = 0;
  for (const p of toAdd) {
    const res = await call('add_participant_to_course', ajoutRapideCourseId, p.id);
    if (res?.success !== false) count++;
  }

  if (btn) { btn.disabled = false; btn.textContent = '✅ Ajouter les participants'; }

  closeModal('modal-ajout-rapide');
  toast(`${count} participant(s) ajouté(s)`);
  courseParticipants = (await call('get_course_participants', ajoutRapideCourseId)) || [];
  renderCourses();
}

function openAddCourse() {
  state.editCourseId = null;
  document.getElementById('modal-course-title').textContent = 'Créer une course';
  ['nom','distance','vma-min','vma-max'].forEach(f => document.getElementById(`c-${f}`).value = '');
  openModal('modal-course');
}
function openEditCourse(id) {
  const c = state.courses.find(x => x.id === id);
  if (!c) return;
  state.editCourseId = id;
  document.getElementById('modal-course-title').textContent = 'Modifier la course';
  document.getElementById('c-nom').value      = c.nom || '';
  document.getElementById('c-distance').value = c.distance ?? '';
  document.getElementById('c-vma-min').value  = c.vma_min ?? '';
  document.getElementById('c-vma-max').value  = c.vma_max ?? '';
  openModal('modal-course');
}
async function saveCourse() {
  const nom = document.getElementById('c-nom').value.trim();
  if (!nom) { toast('Nom requis', 'error'); return; }
  const data = {
    nom,
    distance: parseFloat(document.getElementById('c-distance').value) || null,
    vma_min:  parseFloat(document.getElementById('c-vma-min').value)  || null,
    vma_max:  parseFloat(document.getElementById('c-vma-max').value)  || null,
  };
  const res = state.editCourseId
    ? await call('update_course', state.editCourseId, data)
    : await call('add_course', data);
  if (res?.success) {
    closeModal('modal-course');
    toast(state.editCourseId ? 'Course modifiée' : 'Course créée');
    await refreshData(); renderCourses();
  }
}
async function deleteCourse(id, name) {
  if (!confirm(`Supprimer "${name}" et toutes ses données ?`)) return;
  await call('delete_course', id);
  if (selectedCourseDetailId === id) selectedCourseDetailId = null;
  toast('Course supprimée');
  await refreshData(); renderCourses();
}
function statusBadge(s) {
  const map = { preparation:['gray','En préparation'], en_cours:['orange','En cours'], terminee:['green','Terminée'] };
  const [cls, lbl] = map[s] || ['gray', s];
  return `<span class="badge badge-${cls}">${lbl}</span>`;
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : LIVE
// ════════════════════════════════════════════════════════════════════════════════
let liveSelectedId = null;
let liveArrivees   = [];
let timerInterval  = null;
let timerStart     = null;
let timerElapsed   = 0;
let timerRunning   = false;

function selectCourseForLive(id) { liveSelectedId = id; renderLive(); }

async function renderLive() {
  document.getElementById('content').innerHTML = `
    <div class="course-select-bar">
      <label>Sélectionner une course</label>
      <select id="live-course-select" onchange="liveSelectedId=parseInt(this.value)||null;resetLiveState();loadLiveArrivees()">
        <option value="">— Choisir —</option>
        ${state.courses.filter(c=>c.statut!=='terminee').map(c=>
          `<option value="${c.id}" ${c.id===liveSelectedId?'selected':''}>${c.nom}</option>`
        ).join('')}
      </select>
    </div>
    <div id="live-body"></div>
  `;
  if (liveSelectedId) await loadLiveArrivees();
}

async function loadLiveArrivees() {
  if (!liveSelectedId) return;
  liveArrivees = (await call('get_arrivees', liveSelectedId)) || [];
  renderLiveBody(state.courses.find(c => c.id === liveSelectedId));
}

function resetLiveState() { stopTimer(); timerElapsed = 0; timerStart = null; liveArrivees = []; }

function renderLiveBody(course) {
  if (!course) { document.getElementById('live-body').innerHTML = ''; return; }
  const isStarted  = course.statut === 'en_cours' || course.statut === 'terminee';
  const isFinished = course.statut === 'terminee';

  document.getElementById('live-body').innerHTML = `
    <div class="race-dashboard">
      <div>
        <div class="timer-block">
          <div class="timer-label">Chronomètre</div>
          <div class="timer-display" id="timer-display">${formatTime(timerElapsed)}</div>
          <div class="timer-label">${course.nom}</div>
          <div class="timer-controls">
            ${!isStarted ? `<button class="btn btn-success" onclick="startRace()">Démarrer</button>` : ''}
            ${isStarted && !isFinished ? `
              ${timerRunning
                ? `<button class="btn btn-ghost" onclick="pauseTimer()">Pause</button>`
                : `<button class="btn btn-success" onclick="resumeTimer()">Reprendre</button>`}
              <button class="btn btn-danger" onclick="finishRace()">Terminer</button>
            ` : ''}
            ${isFinished ? `<span class="badge badge-green" style="font-size:14px;padding:8px 16px">Course terminée</span>` : ''}
          </div>
          ${isStarted && !isFinished ? `
          <div style="margin-top:24px">
            <div style="display:flex;align-items:stretch;gap:10px">
              <button class="btn-arrive-cancel" id="btn-cancel-arrive" onclick="cancelLastArrival()" ${liveArrivees.length === 0 ? 'disabled' : ''} title="Annuler la dernière arrivée">
                ✕ Annuler
              </button>
              <button class="btn-arrive" id="btn-arrive" onclick="recordArrival()">
                UN PARTICIPANT EST ARRIVÉ
              </button>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:8px;font-family:var(--font-mono)">
              Appuyez à chaque arrivée — dossard saisi après
            </div>
          </div>` : ''}
        </div>
        ${isStarted ? `
        <div class="card" style="margin-top:16px">
          <div class="card-header">
            <div class="card-title" style="margin-bottom:0">Arrivées enregistrées</div>
            <span class="badge badge-green" style="font-size:16px;padding:6px 14px">${liveArrivees.length}</span>
          </div>
          <div style="max-height:200px;overflow-y:auto">
            ${liveArrivees.map(a => `
              <div class="arrivee-row">
                <div class="arrivee-order">${a.ordre_arrivee}</div>
                <div style="flex:1">
                  <div class="arrivee-time">${formatTime(a.temps_secondes || 0)}</div>
                  ${a.nom ? `<div style="font-size:12px;color:var(--text)">${a.nom} ${a.prenom}</div>` : ''}
                </div>
              </div>`).join('') || `<div style="text-align:center;color:var(--text3);padding:16px;font-size:12px">Aucune arrivée</div>`}
          </div>
        </div>` : ''}
      </div>
      <div>
        <div class="card">
          <div class="card-title">Saisie des dossards</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.6">
            Récupérez la pile de dossards <strong style="color:var(--accent)">dans l'ordre inverse</strong>
            (dessus = 1er arrivé). Saisissez un par un.
          </div>
          ${liveArrivees.length ? `
          <div style="max-height:400px;overflow-y:auto">
            ${liveArrivees.map(a => `
              <div class="arrivee-row">
                <div class="arrivee-order">${a.ordre_arrivee}</div>
                <div style="flex:1">
                  <div class="arrivee-time">${formatTime(a.temps_secondes || 0)}</div>
                  ${a.nom ? `<div style="font-size:12px;color:var(--green)">✓ ${a.nom} ${a.prenom}</div>`
                           : '<div style="font-size:11px;color:var(--text3)">En attente...</div>'}
                </div>
                <div class="arrivee-dossard">
                  ${a.dossard_saisi
                    ? `<span class="badge badge-yellow">#${a.dossard_saisi}</span>`
                    : `<input type="number" placeholder="N°" id="dossard-input-${a.id}"
                          onkeydown="if(event.key==='Enter')assignDossard(${a.id},this.value)" style="width:70px">`}
                </div>
                ${!a.dossard_saisi ? `<button class="btn btn-primary btn-sm" onclick="assignDossard(${a.id},document.getElementById('dossard-input-${a.id}').value)">✓</button>` : ''}
              </div>`).join('')}
          </div>` : `<div class="empty" style="padding:24px"><p>Les arrivées apparaîtront ici</p></div>`}
        </div>
      </div>
    </div>
  `;
}

async function startRace() {
  const res = await call('start_course', liveSelectedId);
  if (res?.success) { startTimer(); await refreshData(); await loadLiveArrivees(); toast('Course démarrée !'); }
}
async function finishRace() {
  if (!confirm('Terminer la course ?')) return;
  stopTimer();
  await call('finish_course', liveSelectedId);
  await refreshData(); await loadLiveArrivees();
  toast('Course terminée !');
}
function startTimer() {
  timerStart = Date.now() - timerElapsed * 1000; timerRunning = true;
  timerInterval = setInterval(() => {
    timerElapsed = (Date.now() - timerStart) / 1000;
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatTime(timerElapsed);
  }, 200);
}
function pauseTimer() {
  timerRunning = false; clearInterval(timerInterval);
  renderLiveBody(state.courses.find(c => c.id === liveSelectedId));
}
function resumeTimer() {
  timerStart = Date.now() - timerElapsed * 1000; timerRunning = true;
  renderLiveBody(state.courses.find(c => c.id === liveSelectedId));
  timerInterval = setInterval(() => {
    timerElapsed = (Date.now() - timerStart) / 1000;
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatTime(timerElapsed);
  }, 200);
}
function stopTimer() { timerRunning = false; clearInterval(timerInterval); }
async function recordArrival() {
  const res = await call('enregistrer_arrivee', liveSelectedId, timerElapsed);
  if (res?.success) {
    const btn = document.getElementById('btn-arrive');
    if (btn) { btn.style.transform = 'scale(0.97)'; setTimeout(() => btn.style.transform='', 150); }
    await loadLiveArrivees();
  }
}
async function cancelLastArrival() {
  if (!liveArrivees.length) return;
  const last = liveArrivees[liveArrivees.length - 1];
  if (!confirm(`Annuler l'arrivée #${last.ordre_arrivee} (${formatTime(last.temps_secondes || 0)}) ?`)) return;
  const res = await call('supprimer_arrivee', last.id);
  if (res?.success) {
    const btn = document.getElementById('btn-cancel-arrive');
    if (btn) { btn.style.transform = 'scale(0.97)'; setTimeout(() => btn.style.transform='', 150); }
    toast('Dernière arrivée annulée');
    await loadLiveArrivees();
  } else { toast(res?.error || 'Erreur', 'error'); }
}
async function assignDossard(arriveeId, dossard) {
  const d = parseInt(dossard);
  if (!d) { toast('Dossard invalide', 'error'); return; }
  const res = await call('assigner_dossard_arrivee', arriveeId, d);
  if (res?.success) { await loadLiveArrivees(); toast(`Dossard #${d} assigné`); }
  else { toast(res?.error || 'Erreur', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : COURSES TERMINÉES
// ════════════════════════════════════════════════════════════════════════════════
let termineesSelectedId = null;

async function renderTerminees() {
  const courses = await call('get_courses_terminees') || [];
  document.getElementById('topbar-actions').innerHTML = '';
  document.getElementById('content').innerHTML = `
    <div class="two-col">
      <div>
        <div class="card">
          <div class="card-title">Courses terminées</div>
          ${courses.length ? `<table>
            <thead><tr><th>Nom</th><th>Distance</th><th>Date</th><th></th></tr></thead>
            <tbody>${courses.map(c => `
              <tr style="cursor:pointer;${c.id===termineesSelectedId?'background:rgba(214,10,60,.05)':''}" onclick="selectTerminee(${c.id})">
                <td><strong>${c.nom}</strong></td>
                <td style="font-family:var(--font-mono)">${c.distance ? c.distance+'m' : '—'}</td>
                <td style="font-size:12px;color:var(--text3)">${c.finished_at ? c.finished_at.slice(0,16).replace('T',' ') : '—'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();toggleMasquerTerminee(${c.id},${c.masquee})">${c.masquee?'Afficher':'Masquer'}</button></td>
              </tr>`).join('')}
            </tbody>
          </table>` : `<div class="empty"><div class="empty-icon">✅</div><p>Aucune course terminée.</p></div>`}
        </div>
      </div>
      <div id="terminees-detail">
        <div class="card">
          <div class="empty"><div class="empty-icon">👈</div><p>Sélectionnez une course pour modifier ses résultats</p></div>
        </div>
      </div>
    </div>
  `;
  if (termineesSelectedId) await loadTermineesDetail();
}

async function selectTerminee(id) { termineesSelectedId = id; await renderTerminees(); }
async function toggleMasquerTerminee(cid) {
  const res = await call('toggle_masquer_course', cid);
  if (res?.success) { await refreshData(); await renderTerminees(); toast(res.masquee ? 'Masquée' : 'Affichée'); }
}

async function loadTermineesDetail() {
  const arrs   = (await call('get_arrivees', termineesSelectedId)) || [];
  const course = state.courses.find(c => c.id === termineesSelectedId)
              || ((await call('get_courses_terminees')) || []).find(c => c.id === termineesSelectedId);
  const el = document.getElementById('terminees-detail');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="margin-bottom:0">${course?.nom || ''}</div>
        <span class="badge badge-green">Terminée</span>
      </div>
      <div class="info-row" style="margin-bottom:16px">
        <div class="info-item"><div class="lbl">Distance</div><div class="val">${course?.distance ? course.distance+'m' : '—'}</div></div>
        <div class="info-item"><div class="lbl">Arrivées</div><div class="val">${arrs.length}</div></div>
      </div>
      <div style="background:var(--surface2);border-radius:var(--radius);padding:14px;margin-bottom:16px">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono);margin-bottom:10px">Ajouter une arrivée manquante</div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:80px"><label>Dossard</label><input type="number" id="t-dossard" placeholder="N°"></div>
          <div class="form-group" style="flex:1;min-width:100px"><label>Temps (mm:ss)</label><input type="text" id="t-temps" placeholder="12:34"></div>
          <button class="btn btn-success btn-sm" style="margin-bottom:1px" onclick="ajouterArriveeManuelle()">+ Ajouter</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono);margin-bottom:8px">Arrivées — modifier ou supprimer</div>
      <div style="max-height:420px;overflow-y:auto">
        ${arrs.length ? arrs.map(a => `
          <div class="arrivee-row">
            <div class="arrivee-order">${a.ordre_arrivee}</div>
            <div style="flex:1">
              <div class="arrivee-time">${formatTime(a.temps_secondes || 0)}</div>
              ${a.nom ? `<div style="font-size:12px;color:var(--green)">✓ ${a.nom} ${a.prenom}</div>`
                      : '<div style="font-size:11px;color:var(--text3)">Non assigné</div>'}
            </div>
            <div class="arrivee-dossard">
              <input type="number" value="${a.dossard_saisi || ''}" placeholder="${a.dossard_saisi || 'N°'}"
                id="tedit-${a.id}" style="width:70px"
                onkeydown="if(event.key==='Enter')modifierDossardArrivee(${a.id},this.value)">
            </div>
            <button class="btn btn-primary btn-sm" onclick="modifierDossardArrivee(${a.id},document.getElementById('tedit-${a.id}').value)">✓</button>
            <button class="btn btn-danger btn-sm" onclick="supprimerArrivee(${a.id})">Suppr.</button>
          </div>`).join('')
        : `<div class="empty" style="padding:24px"><p>Aucune arrivée.</p></div>`}
      </div>
    </div>
  `;
}

async function ajouterArriveeManuelle() {
  const dossard  = parseInt(document.getElementById('t-dossard').value);
  const tempsStr = document.getElementById('t-temps').value.trim();
  if (!dossard) { toast('Dossard requis', 'error'); return; }
  const parts = tempsStr.split(':').map(Number);
  let secs = 0;
  if (parts.length === 2)      secs = parts[0]*60 + parts[1];
  else if (parts.length === 3) secs = parts[0]*3600 + parts[1]*60 + parts[2];
  else { toast('Format invalide (mm:ss)', 'error'); return; }
  const res = await call('ajouter_arrivee_manuelle', termineesSelectedId, secs, dossard);
  if (res?.success) { toast('Arrivée ajoutée'); await loadTermineesDetail(); }
  else { toast(res?.error || 'Erreur', 'error'); }
}
async function modifierDossardArrivee(arriveeId, dossard) {
  const d = parseInt(dossard);
  if (!d) { toast('Dossard invalide', 'error'); return; }
  const res = await call('assigner_dossard_arrivee', arriveeId, d);
  if (res?.success) { toast(`Dossard #${d} assigné`); await loadTermineesDetail(); }
  else { toast(res?.error || 'Erreur', 'error'); }
}
async function supprimerArrivee(arriveeId) {
  if (!confirm("Supprimer cette arrivée ? L'ordre sera recalculé.")) return;
  const res = await call('supprimer_arrivee', arriveeId);
  if (res?.success) { toast('Supprimée'); await loadTermineesDetail(); }
  else { toast(res?.error || 'Erreur', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : CLASSEMENT
// ════════════════════════════════════════════════════════════════════════════════
let classementCourseId = null;
function selectCourseForClassement(id) { classementCourseId = id; renderClassement(); }

async function renderClassement() {
  document.getElementById('content').innerHTML = `
    <div class="course-select-bar">
      <label>Sélectionner une course</label>
      <select id="classement-course-select" onchange="classementCourseId=parseInt(this.value)||null;renderClassement()">
        <option value="">— Choisir —</option>
        ${state.courses.map(c => `<option value="${c.id}" ${c.id===classementCourseId?'selected':''}>${c.nom}</option>`).join('')}
      </select>
    </div>
    <div id="classement-body"></div>
  `;
  if (!classementCourseId) return;
  const classement = await call('get_classement', classementCourseId);
  const course = state.courses.find(c => c.id === classementCourseId);
  if (!classement?.length) {
    document.getElementById('classement-body').innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>Aucun résultat.<br>Vérifiez que les dossards ont été saisis.</p></div>`;
    return;
  }
  const top3 = classement.slice(0, 3);
  document.getElementById('classement-body').innerHTML = `
    ${top3.length >= 2 ? `
    <div class="card" style="text-align:center">
      <div class="card-title" style="text-align:center">Podium — ${course?.nom || ''}</div>
      <div class="podium">
        ${top3[1] ? `<div class="podium-item p2"><div class="podium-place">2</div><div class="podium-name">${top3[1].nom} ${top3[1].prenom}</div><div class="podium-info">${formatTime(top3[1].temps_secondes||0)}</div></div>` : ''}
        ${top3[0] ? `<div class="podium-item p1" style="margin-bottom:24px"><div class="podium-place">1</div><div class="podium-name" style="font-size:15px;font-weight:700">${top3[0].nom} ${top3[0].prenom}</div><div class="podium-info">${formatTime(top3[0].temps_secondes||0)}</div></div>` : ''}
        ${top3[2] ? `<div class="podium-item p3"><div class="podium-place">3</div><div class="podium-name">${top3[2].nom} ${top3[2].prenom}</div><div class="podium-info">${formatTime(top3[2].temps_secondes||0)}</div></div>` : ''}
      </div>
    </div>` : ''}
    <div class="card">
      <div class="card-title">Classement complet</div>
      <table>
        <thead><tr><th>#</th><th>Dossard</th><th>Nom</th><th>Classe</th><th>Temps</th><th>Vitesse</th><th>% VMA</th></tr></thead>
        <tbody>${classement.map((r,i) => `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:700;color:${i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--text)'}">${i+1}</td>
            <td><span class="badge badge-yellow">#${r.num_dossard ?? '?'}</span></td>
            <td><strong>${r.nom||'?'} ${r.prenom||''}</strong></td>
            <td>${r.classe||'—'}</td>
            <td style="font-family:var(--font-mono);color:var(--accent)">${formatTime(r.temps_secondes||0)}</td>
            <td style="font-family:var(--font-mono)">${r.vitesse_kmh ? r.vitesse_kmh+' km/h' : '—'}</td>
            <td>${r.pct_vma ? `<div class="pct-bar"><div class="pct-bar-track"><div class="pct-bar-fill" style="width:${Math.min(r.pct_vma,120)}%;background:${r.pct_vma>=100?'var(--accent)':r.pct_vma>=80?'var(--green)':'var(--blue)'}"></div></div><div class="pct-text">${r.pct_vma}%</div></div>` : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : STATISTIQUES
// ════════════════════════════════════════════════════════════════════════════════
function renderStatistiques() {
  const participants = state.participants;

  if (!participants.length) {
    document.getElementById('content').innerHTML = `
      <div class="empty"><div class="empty-icon">📊</div><p>Aucun participant enregistré.</p></div>`;
    return;
  }

  document.getElementById('content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">Répartition par sexe</div>
        <div style="display:flex;align-items:center;gap:24px;margin-top:8px">
          <canvas id="chart-sexe" width="160" height="160"></canvas>
          <div id="legend-sexe" style="flex:1"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Répartition par établissement</div>
        <div style="display:flex;align-items:center;gap:24px;margin-top:8px">
          <canvas id="chart-etab" width="160" height="160"></canvas>
          <div id="legend-etab" style="flex:1;max-height:160px;overflow-y:auto"></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Répartition par tranche de VMA (km/h)</div>
      <canvas id="chart-vma" height="200" style="width:100%;display:block"></canvas>
    </div>
  `;

  requestAnimationFrame(() => {
    drawSexeChart(participants);
    drawEtabChart(participants);
    drawVmaChart(participants);
  });
}

/* ── helpers ── */
function setupCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = cssWidth  * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width  = cssWidth  + 'px';
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function chartColors() {
  const light = document.body.classList.contains('theme-light');
  return {
    text:    light ? '#4a526b' : '#8a92a8',
    text2:   light ? '#1a1e2e' : '#e8ecf4',
    border:  light ? '#d0d5e2' : '#2a2f3d',
    surface2:light ? '#e8ebf2' : '#1e2230',
    accent:  '#d60a3c',
    palette: ['#d60a3c','#4a9eff','#3ecf6e','#e05a2b','#a78bfa','#f59e0b','#06b6d4','#ec4899','#84cc16','#f97316'],
  };
}

function drawSexeChart(participants) {
  const canvas = document.getElementById('chart-sexe');
  if (!canvas) return;
  const ctx = setupCanvas(canvas, 160, 160);
  const C = chartColors();

  const counts = { F: 0, M: 0, '—': 0 };
  participants.forEach(p => {
    if (p.sexe === 'F') counts['F']++;
    else if (p.sexe === 'M') counts['M']++;
    else counts['—']++;
  });

  const labels  = Object.keys(counts).filter(k => counts[k] > 0);
  const values  = labels.map(k => counts[k]);
  const total   = values.reduce((a, b) => a + b, 0);
  const colors  = ['#d60a3c', '#4a9eff', '#8a92a8'];
  const labelNames = { F: 'Féminin', M: 'Masculin', '—': 'Non renseigné' };

  const cx = canvas.width / 2, cy = canvas.height / 2, r = 65, ri = 38;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let angle = -Math.PI / 2;
  labels.forEach((lbl, i) => {
    const slice = (values[i] / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    angle += slice;
  });

  // Trou central (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#161920';
  ctx.fill();

  // Texte central
  ctx.fillStyle = C.text2;
  ctx.font = `600 22px IBM Plex Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 8);
  ctx.font = `10px IBM Plex Sans, sans-serif`;
  ctx.fillStyle = C.text;
  ctx.fillText('élèves', cx, cy + 10);

  // Légende
  const legend = document.getElementById('legend-sexe');
  if (legend) {
    legend.innerHTML = labels.map((lbl, i) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0"></div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text)">${labelNames[lbl]}</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${values[i]} (${Math.round(values[i]/total*100)}%)</div>
        </div>
      </div>`).join('');
  }
}

function drawEtabChart(participants) {
  const canvas = document.getElementById('chart-etab');
  if (!canvas) return;
  const ctx = setupCanvas(canvas, 160, 160);
  const C = chartColors();

  const counts = {};
  participants.forEach(p => {
    const k = p.etablissement || 'Non renseigné';
    counts[k] = (counts[k] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);

  const cx = canvas.width / 2, cy = canvas.height / 2, r = 65, ri = 38;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let angle = -Math.PI / 2;
  sorted.forEach(([, val], i) => {
    const slice = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = C.palette[i % C.palette.length];
    ctx.fill();
    angle += slice;
  });

  // Trou central (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#161920';
  ctx.fill();

  // Texte central
  ctx.fillStyle = C.text2;
  ctx.font = `600 22px IBM Plex Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sorted.length, cx, cy - 8);
  ctx.font = `10px IBM Plex Sans, sans-serif`;
  ctx.fillStyle = C.text;
  ctx.fillText('établ.', cx, cy + 10);

  // Légende
  const legend = document.getElementById('legend-etab');
  if (legend) {
    legend.innerHTML = sorted.map(([lbl, val], i) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:10px;height:10px;border-radius:2px;background:${C.palette[i % C.palette.length]};flex-shrink:0"></div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${val} (${Math.round(val/total*100)}%)</div>
        </div>
      </div>`).join('');
  }
}

function drawVmaChart(participants) {
  const canvas = document.getElementById('chart-vma');
  if (!canvas) return;
  const cssW = canvas.offsetWidth || 600;
  const cssH = 200;
  const ctx = setupCanvas(canvas, cssW, cssH);
  const C = chartColors();

  // Arrondi arithmétique → tranche = Math.round(vma)
  const withVma = participants.filter(p => p.vma != null);
  if (!withVma.length) {
    ctx.fillStyle = C.text;
    ctx.font = '13px IBM Plex Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune VMA renseignée', canvas.width / 2, canvas.height / 2);
    return;
  }

  const counts = {};
  withVma.forEach(p => {
    const k = Math.round(p.vma);
    counts[k] = (counts[k] || 0) + 1;
  });

  const minKey = Math.min(...Object.keys(counts).map(Number));
  const maxKey = Math.max(...Object.keys(counts).map(Number));
  const keys = [];
  for (let k = minKey; k <= maxKey; k++) keys.push(k);
  const values = keys.map(k => counts[k] || 0);
  const max = Math.max(...values);

  const pad = { top: 16, right: 20, bottom: 40, left: 36 };
  const W = cssW, H = cssH;
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = (chartW / keys.length) * 0.65;
  const slotW = chartW / keys.length;

  ctx.clearRect(0, 0, W, H);

  // Grille horizontale
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const y = pad.top + chartH - (s / steps) * chartH;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.text;
    ctx.font = '10px IBM Plex Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round((s / steps) * max), pad.left - 6, y);
  }

  // Barres
  keys.forEach((k, i) => {
    const val = values[i];
    const x = pad.left + i * slotW + (slotW - barW) / 2;
    const bh = val > 0 ? (val / max) * chartH : 0;
    const y = pad.top + chartH - bh;

    // Track
    ctx.fillStyle = C.surface2;
    ctx.beginPath(); ctx.roundRect(x, pad.top, barW, chartH, 4); ctx.fill();

    // Bar
    if (val > 0) {
      ctx.fillStyle = C.accent;
      ctx.beginPath(); ctx.roundRect(x, y, barW, bh, 4); ctx.fill();

      // Value on top
      if (bh > 18) {
        ctx.fillStyle = '#fff';
        ctx.font = `600 10px IBM Plex Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(val, x + barW / 2, y + 4);
      } else {
        ctx.fillStyle = C.text2;
        ctx.font = `600 10px IBM Plex Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(val, x + barW / 2, y - 3);
      }
    }

    // X label
    ctx.fillStyle = C.text;
    ctx.font = '11px IBM Plex Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(k, x + barW / 2, pad.top + chartH + 8);
  });

  // Axe X label
  ctx.fillStyle = C.text;
  ctx.font = '11px IBM Plex Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('VMA arrondie (km/h)', W / 2, H - 14);
}

// ════════════════════════════════════════════════════════════════════════════════
// OPTIONS AVANCÉES
// ════════════════════════════════════════════════════════════════════════════════
function openOptionsAvancees() {
  // Peupler la liste des établissements
  const etabs = [...new Set((state.participants || [])
    .map(p => p.etablissement).filter(Boolean))].sort();
  const sel = document.getElementById('opt-etab-select');
  sel.innerHTML = '<option value="">— Choisir un établissement —</option>'
    + etabs.map(e => `<option value="${e}">${e}</option>`).join('');
  document.getElementById('opt-etab-count').textContent = '';
  sel.onchange = () => {
    const etab = sel.value;
    if (!etab) { document.getElementById('opt-etab-count').textContent = ''; return; }
    const n = (state.participants || []).filter(p => p.etablissement === etab).length;
    document.getElementById('opt-etab-count').textContent = `${n} participant(s) concerné(s)`;
  };
  openModal('modal-options-avancees');
}

async function optionSupprimerTous() {
  const n = (state.participants || []).length;
  if (!n) { toast('Aucun participant à supprimer', 'error'); return; }
  if (!confirm(`Supprimer les ${n} participants ? Cette action est irréversible.`)) return;
  const res = await call('supprimer_tous_participants');
  if (res?.success) {
    toast(`${res.count} participant(s) supprimé(s)`);
    await refreshData();
    renderParticipants();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

async function optionResetDossards() {
  const n = (state.participants || []).filter(p => p.dossard != null).length;
  if (!n) { toast('Aucun dossard attribué', 'error'); return; }
  if (!confirm(`Réinitialiser les dossards de ${n} participant(s) ?`)) return;
  const res = await call('reset_dossards');
  if (res?.success) {
    toast(`Dossards réinitialisés (${res.count} participants)`);
    await refreshData();
    renderParticipants();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

async function optionSupprimerEtab() {
  const etab = document.getElementById('opt-etab-select').value;
  if (!etab) { toast('Sélectionnez un établissement', 'error'); return; }
  const n = (state.participants || []).filter(p => p.etablissement === etab).length;
  if (!confirm(`Supprimer les ${n} participants de "${etab}" ? Cette action est irréversible.`)) return;
  const res = await call('supprimer_participants_etab', etab);
  if (res?.success) {
    toast(`${res.count} participant(s) de "${etab}" supprimé(s)`);
    await refreshData();
    openOptionsAvancees(); // rafraîchir le select
    renderParticipants();
  } else {
    toast(res?.error || 'Erreur', 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORT (participants + course)
// ════════════════════════════════════════════════════════════════════════════════
let _exportCourseId = null;

// ── Participants ──────────────────────────────────────────────────────────────
async function openExportParticipants() {
  // Peupler les selects depuis les données en mémoire
  const parts = state.participants || [];
  _populateExportSelects('exp-p-etab', 'exp-p-classe', parts);
  _updateExportCount('exp-p', parts, null);
  // Écouter les changements de filtres
  ['exp-p-sexe','exp-p-etab','exp-p-classe'].forEach(id => {
    document.getElementById(id).onchange = () => _updateExportCount('exp-p', parts, null);
  });
  openModal('modal-export-participants');
}

async function doExportParticipants() {
  const filters = _getExportFilters('exp-p');
  const format  = document.querySelector('input[name="exp-p-format"]:checked')?.value || 'pdf';
  toast('Export en cours…');
  const res = await call('export_file', JSON.stringify({ context: 'participants', format, filters }));
  _handleExportResult(res, format);
  if (res?.success) closeModal('modal-export-participants');
}

// ── Course ────────────────────────────────────────────────────────────────────
async function openExportCourse(courseId) {
  _exportCourseId = courseId;
  const course = (state.courses || []).find(c => c.id === courseId);
  document.getElementById('exp-c-course-name').textContent = course ? course.nom : '';
  // Participants de cette course uniquement
  const res = await call('get_course_participants', courseId);
  const parts = Array.isArray(res) ? res : [];
  _populateExportSelects('exp-c-etab', 'exp-c-classe', parts);
  _updateExportCount('exp-c', parts, courseId);
  ['exp-c-sexe','exp-c-etab','exp-c-classe'].forEach(id => {
    document.getElementById(id).onchange = () => _updateExportCount('exp-c', parts, courseId);
  });
  openModal('modal-export-course');
}

async function doExportCourse() {
  const filters = _getExportFilters('exp-c');
  const format  = document.querySelector('input[name="exp-c-format"]:checked')?.value || 'pdf';
  toast('Export en cours…');
  const res = await call('export_file', JSON.stringify({ context: 'course', course_id: _exportCourseId, format, filters }));
  _handleExportResult(res, format);
  if (res?.success) closeModal('modal-export-course');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _populateExportSelects(etabId, classeId, parts) {
  const etabs   = [...new Set(parts.map(p => p.etablissement).filter(Boolean))].sort();
  const classes = [...new Set(parts.map(p => p.classe).filter(Boolean))].sort();
  const etabEl   = document.getElementById(etabId);
  const classeEl = document.getElementById(classeId);
  etabEl.innerHTML   = '<option value="">Tous</option>' + etabs.map(e => `<option value="${e}">${e}</option>`).join('');
  classeEl.innerHTML = '<option value="">Toutes</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
}

function _getExportFilters(prefix) {
  return {
    sexe:          document.getElementById(`${prefix}-sexe`)?.value || '',
    etablissement: document.getElementById(`${prefix}-etab`)?.value || '',
    classe:        document.getElementById(`${prefix}-classe`)?.value || '',
  };
}

function _applyFilters(parts, filters) {
  return parts.filter(p => {
    if (filters.sexe          && p.sexe          !== filters.sexe)          return false;
    if (filters.etablissement && p.etablissement !== filters.etablissement) return false;
    if (filters.classe        && p.classe        !== filters.classe)        return false;
    return true;
  });
}

function _updateExportCount(prefix, parts, courseId) {
  const filters   = _getExportFilters(prefix);
  const filtered  = _applyFilters(parts, filters);
  const el = document.getElementById(`${prefix}-count`);
  if (el) el.textContent = `${filtered.length} participant(s) dans cet export`;
}

function _handleExportResult(res, format) {
  if (res?.success) {
    toast(`Export ${format.toUpperCase()} généré et ouvert`);
  } else {
    toast(res?.error || "Erreur export", 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// IMPORT PARTICIPANTS
// ════════════════════════════════════════════════════════════════════════════════
let importParsedRows = [];
let importCurrentFile = null;

function openImportModal() {
  importParsedRows = [];
  importCurrentFile = null;
  document.getElementById('import-file-info').textContent = '';
  document.getElementById('import-etab-override').value = '';
  document.getElementById('import-step-1').classList.remove('hidden');
  document.getElementById('import-step-2').classList.add('hidden');
  document.getElementById('import-confirm-btn').classList.add('hidden');
  document.getElementById('import-back-btn').classList.add('hidden');
  const dz = document.getElementById('import-dropzone');
  dz.style.borderColor = '';
  dz.style.background = '';
  openModal('modal-import');
}

function handleImportDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('import-dropzone');
  dz.style.borderColor = '';
  dz.style.background = '';
  const file = e.dataTransfer.files[0];
  if (file) handleImportFile(file);
}

function handleImportFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    toast('Format non supporté. Utilisez CSV ou XLSX.', 'error');
    return;
  }
  importCurrentFile = file;
  document.getElementById('import-file-info').textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)} Ko)`;
  parseImportFile();
}

function onImportEtabChange() {
  if (importCurrentFile) parseImportFile();
}

async function parseImportFile() {
  if (!importCurrentFile) return;
  const etab = document.getElementById('import-etab-override').value.trim();
  const info = document.getElementById('import-file-info');
  info.textContent = `⏳ Analyse de ${importCurrentFile.name}…`;

  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(importCurrentFile);
  });

  const res = await call('parse_import_file', b64, importCurrentFile.name, etab);

  if (!res?.success) {
    info.textContent = `❌ ${res?.error || 'Erreur lors de l\'analyse'}`;
    toast(res?.error || 'Erreur', 'error');
    return;
  }

  importParsedRows = res.rows;
  info.textContent = `✓ ${importCurrentFile.name}`;
  renderImportPreview(res.rows, res.counts);
}

function renderImportPreview(rows, counts) {
  // Résumé
  const summary = document.getElementById('import-summary');
  summary.innerHTML = [
    ['total',   `${counts.total} lignes`,          'badge-gray'],
    ['ok',      `${counts.ok} valides`,             'badge-green'],
    ['warning', `${counts.warning} avertissements`, 'badge-yellow'],
    ['doublon', `${counts.doublon} doublons`,        'badge-orange'],
    ['erreur',  `${counts.erreur} erreurs`,          'badge-red'],
  ].filter(([k]) => k === 'total' || counts[k] > 0)
   .map(([, lbl, cls]) => `<span class="badge ${cls}" style="font-size:12px;padding:5px 10px">${lbl}</span>`)
   .join('');

  // Couleur de ligne par statut
  const rowColor = { ok: '', warning: 'rgba(214,10,60,.04)', doublon: 'rgba(224,90,43,.08)', erreur: 'rgba(224,90,90,.1)' };
  const statusIcon = { ok: '', warning: '⚠️', doublon: '🔁', erreur: '❌' };

  const tbody = document.getElementById('import-preview-body');
  tbody.innerHTML = rows.map(r => `
    <tr style="background:${rowColor[r.statut] || ''}">
      <td style="text-align:center;font-size:14px">${statusIcon[r.statut] || ''}</td>
      <td><strong>${r.nom || '<span style="color:var(--red)">—</span>'}</strong></td>
      <td>${r.prenom || '<span style="color:var(--red)">—</span>'}</td>
      <td>${r.classe || '<span style="color:var(--text3)">—</span>'}</td>
      <td>${r.etablissement || '<span style="color:var(--text3)">—</span>'}</td>
      <td>${r.sexe || '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-family:var(--font-mono)">${r.vma != null ? r.vma : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-family:var(--font-mono)">${r.dossard != null ? r.dossard : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:11px;color:var(--text3)">${r.warnings.join(', ')}</td>
    </tr>`).join('');

  // Afficher étape 2
  document.getElementById('import-step-1').classList.add('hidden');
  document.getElementById('import-step-2').classList.remove('hidden');
  document.getElementById('import-confirm-btn').classList.remove('hidden');
  document.getElementById('import-back-btn').classList.remove('hidden');

  const canImport = counts.ok + counts.warning + counts.doublon > 0;
  document.getElementById('import-confirm-btn').disabled = !canImport;
}

function importGoBack() {
  document.getElementById('import-step-1').classList.remove('hidden');
  document.getElementById('import-step-2').classList.add('hidden');
  document.getElementById('import-confirm-btn').classList.add('hidden');
  document.getElementById('import-back-btn').classList.add('hidden');
}

async function confirmImport() {
  const skipDoublons = document.getElementById('import-skip-doublons').checked;
  const btn = document.getElementById('import-confirm-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Import en cours…';

  const res = await call('confirm_import', importParsedRows, skipDoublons);

  btn.disabled = false;
  btn.textContent = '✅ Importer';

  if (res?.success) {
    closeModal('modal-import');
    const msg = `${res.imported} participant(s) importé(s)${res.skipped ? `, ${res.skipped} ignoré(s)` : ''}${res.errors?.length ? ` — ${res.errors.length} erreur(s)` : ''}`;
    toast(msg);
    if (res.errors?.length) res.errors.forEach(e => console.warn('[Import]', e));
    await refreshData();
    renderParticipants();
  } else {
    toast(res?.error || 'Erreur lors de l\'import', 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE : PARAMÈTRES
// ════════════════════════════════════════════════════════════════════════════════
function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  localStorage.setItem('cc-theme', theme);
}

function renderParametres() {
  const currentTheme = localStorage.getItem('cc-theme') || 'dark';
  document.getElementById('content').innerHTML = `
    <div style="max-width:560px">
      <div class="card">
        <div class="card-title">Apparence</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:20px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:1px">Thème de l'interface</div>
        <div style="display:flex;gap:16px">

          <!-- Thème sombre -->
          <div id="theme-opt-dark" onclick="applyTheme('dark');renderParametres()"
            style="flex:1;border:2px solid ${currentTheme==='dark' ? 'var(--accent)' : 'var(--border)'};border-radius:8px;padding:16px;cursor:pointer;transition:border-color .15s;background:${currentTheme==='dark' ? 'rgba(214,10,60,.05)' : 'transparent'}">
            <div style="background:#0d0f14;border-radius:6px;height:80px;margin-bottom:12px;border:1px solid #2a2f3d;display:flex;flex-direction:column;overflow:hidden">
              <div style="background:#161920;height:18px;border-bottom:1px solid #2a2f3d;display:flex;align-items:center;padding:0 8px;gap:4px">
                <div style="width:24px;height:6px;background:#d60a3c;border-radius:2px"></div>
                <div style="flex:1;height:4px;background:#2a2f3d;border-radius:2px"></div>
              </div>
              <div style="display:flex;flex:1">
                <div style="width:36px;background:#161920;border-right:1px solid #2a2f3d"></div>
                <div style="flex:1;padding:6px;display:flex;flex-direction:column;gap:4px">
                  <div style="height:6px;background:#2a2f3d;border-radius:2px;width:70%"></div>
                  <div style="height:6px;background:#2a2f3d;border-radius:2px;width:50%"></div>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${currentTheme==='dark' ? 'var(--accent)' : 'var(--border)'};display:flex;align-items:center;justify-content:center">
                ${currentTheme==='dark' ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>' : ''}
              </div>
              <span style="font-weight:600;font-size:13px">Sombre</span>
            </div>
          </div>

          <!-- Thème clair -->
          <div id="theme-opt-light" onclick="applyTheme('light');renderParametres()"
            style="flex:1;border:2px solid ${currentTheme==='light' ? 'var(--accent)' : 'var(--border)'};border-radius:8px;padding:16px;cursor:pointer;transition:border-color .15s;background:${currentTheme==='light' ? 'rgba(214,10,60,.05)' : 'transparent'}">
            <div style="background:#f0f2f7;border-radius:6px;height:80px;margin-bottom:12px;border:1px solid #d0d5e2;display:flex;flex-direction:column;overflow:hidden">
              <div style="background:#ffffff;height:18px;border-bottom:1px solid #d0d5e2;display:flex;align-items:center;padding:0 8px;gap:4px">
                <div style="width:24px;height:6px;background:#d60a3c;border-radius:2px"></div>
                <div style="flex:1;height:4px;background:#d0d5e2;border-radius:2px"></div>
              </div>
              <div style="display:flex;flex:1">
                <div style="width:36px;background:#ffffff;border-right:1px solid #d0d5e2"></div>
                <div style="flex:1;padding:6px;display:flex;flex-direction:column;gap:4px">
                  <div style="height:6px;background:#d0d5e2;border-radius:2px;width:70%"></div>
                  <div style="height:6px;background:#d0d5e2;border-radius:2px;width:50%"></div>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${currentTheme==='light' ? 'var(--accent)' : 'var(--border)'};display:flex;align-items:center;justify-content:center">
                ${currentTheme==='light' ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>' : ''}
              </div>
              <span style="font-weight:600;font-size:13px">Clair</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════════
async function init() {
  // Restaurer le thème sauvegardé
  const savedTheme = localStorage.getItem('cc-theme') || 'dark';
  applyTheme(savedTheme);
  showScreen('events');
  await renderEvents();
}

window.addEventListener('pywebviewready', () => {
  api = window.pywebview.api;
  init();
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!api) {
      if (window.pywebview?.api) { api = window.pywebview.api; init(); }
      else { init(); }
    }
  }, 500);
});
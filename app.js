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
  };
  document.getElementById('page-title').textContent       = titles[state.page] || '';
  document.getElementById('topbar-actions').innerHTML     = '';
  const pages = {
    dashboard:    renderDashboard,
    participants: renderParticipants,
    courses:      renderCourses,
    live:         renderLive,
    terminees:    renderTerminees,
    classement:   renderClassement,
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
function renderParticipants() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="autoAssignDossards()">Auto-dossards</button>
    <button class="btn btn-primary" onclick="openAddParticipant()">+ Ajouter</button>
  `;
  const filtered = state.participants.filter(p => {
    const q = state.filterSearch.toLowerCase();
    return !q || `${p.nom} ${p.prenom} ${p.classe} ${p.etablissement}`.toLowerCase().includes(q);
  });
  document.getElementById('content').innerHTML = `
    <div class="search-bar">
      <input type="text" placeholder="Rechercher…" value="${state.filterSearch}"
        oninput="state.filterSearch=this.value;renderParticipants()">
      <span style="font-size:12px;color:var(--text3);align-self:center;white-space:nowrap">${filtered.length} / ${state.participants.length}</span>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Dossard</th><th>Nom</th><th>Prénom</th><th>Classe</th><th>Établissement</th><th>Sexe</th><th>VMA</th><th></th></tr></thead>
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
    </div>
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
            <button class="btn-arrive" id="btn-arrive" onclick="recordArrival()">
              UN PARTICIPANT EST ARRIVÉ
            </button>
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
// INIT
// ════════════════════════════════════════════════════════════════════════════════
async function init() {
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
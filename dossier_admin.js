// ══════════════════════════════════════════════════════════════════
// DOSSIER ADMINISTRATIF — réservé au Président
// Tuile « Dossier administratif » en haut de l'accueil → code secret à 6 chiffres
// VÉRIFIÉ PAR LE SERVEUR (fonctions da_*, code défini par l'admin, enregistré
// chiffré, 5 erreurs = blocage 15 min) → 3 pôles + échéances.
// Le code n'est jamais stocké : il reste en mémoire le temps de la consultation
// et s'efface au verrouillage (bouton ou 5 minutes sans activité).
// Fichier séparé de script.js : n'interfère avec aucun module HACCP.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var VERROU_MS = 5 * 60 * 1000;
  var deverrouilleJusqua = 0;
  var pinSession = '';
  var cacheSalaries = null;

  var POLES = [
    { id: 'personnel', ico: '👥', titre: 'Dossier du personnel', sous: 'Salariés, embauche, paie, procédures',
      rub: [
        ['Salariés', 'Une fiche par salarié : identité, contrat, horaires, salaire, période d\'essai', 'salaries'],
        ['Embauche', 'Contrats, avenants, déclarations d\'embauche, pièces d\'identité, titres de séjour, autorisations de travail'],
        ['Paie', 'Bulletins de salaire'],
        ['Santé et formation', 'Visites médicales, formations hygiène'],
        ['Procédures', 'Rappel à l\'ordre, mise en garde, avertissement, blâme, mise à pied, licenciement'],
        ['Registre unique du personnel', 'Entrées et sorties']
      ] },
    { id: 'associes', ico: '🏛️', titre: 'Dossier des associés', sous: 'Statuts, assemblées, dirigeants',
      rub: [
        ['Statuts', 'Version en vigueur et anciennes versions'],
        ['Procès-verbaux d\'assemblée', 'Décisions des associés'],
        ['Président', 'Nomination, démission'],
        ['Annonce légale', 'Attestations de parution'],
        ['Kbis', 'Extrait à jour'],
        ['Formalités INPI', 'Dépôts et récépissés'],
        ['Pouvoirs et pièces d\'identité des dirigeants', ''],
        ['Cessions de parts', 'S\'il y en a']
      ] },
    { id: 'declarations', ico: '📋', titre: 'Déclarations et obligations', sous: 'DDPP, URSSAF, assurances, contrats',
      rub: [
        ['Déclaration d\'activité (DDPP)', 'Récépissé Cerfa 13984'],
        ['Plan de maîtrise sanitaire (PMS)', ''],
        ['Convention collective HCR', 'À tenir à la disposition des salariés'],
        ['URSSAF', 'Immatriculation, attestations de vigilance'],
        ['Médecine du travail', 'Adhésion'],
        ['Assurances', 'Responsabilité civile, multirisque'],
        ['Bail commercial', ''],
        ['Licence et permis d\'exploitation', ''],
        ['Contrats nuisibles et biodéchets', ''],
        ['Affichages obligatoires', '']
      ] },
    { id: 'echeances', ico: '⏰', titre: 'Échéances', sous: 'Alertes automatiques',
      rub: [
        ['Fins de période d\'essai', ''],
        ['Titres de séjour à renouveler', ''],
        ['Visites médicales', ''],
        ['Entretiens préalables et lettres à envoyer', 'Calcul automatique des délais légaux'],
        ['Formalités à mettre à jour', 'Ex. : déclaration d\'activité après un changement de Président']
      ] }
  ];

  // Champs de la fiche salarié (modèle « FICHE RENSEIGNEMENT » de BLU BLU)
  var CHAMPS = [
    ['statut', 'Statut', 'select', [['actif', 'En activité'], ['ancien', 'Ancien salarié']]],
    ['nom', 'Nom', 'text'], ['prenom', 'Prénom', 'text'],
    ['naissance_date', 'Date de naissance', 'date'], ['naissance_lieu', 'Lieu de naissance', 'text'],
    ['nationalite', 'Nationalité', 'text'], ['adresse', 'Adresse', 'text'], ['telephone', 'Téléphone', 'tel'],
    ['nir', 'N° de sécurité sociale', 'text'],
    ['poste', 'Poste', 'text'], ['qualification', 'Qualification (statut, niveau, échelon)', 'text'],
    ['date_embauche', 'Date d\'embauche', 'date'], ['date_sortie', 'Date de sortie', 'date'],
    ['contrat', 'Contrat', 'text'], ['heures_hebdo', 'Heures par semaine', 'number'], ['salaire_brut', 'Salaire brut mensuel (€)', 'number'],
    ['essai_fin', 'Fin de période d\'essai', 'date'], ['repos', 'Jours de repos', 'text'],
    ['horaires', 'Horaires (une ligne par jour)', 'textarea'],
    ['titre_sejour_fin', 'Fin de validité du titre de séjour', 'date'], ['notes', 'Notes', 'textarea']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function codeCompte() { try { return (localStorage.getItem('haccp_last_code') || '').toUpperCase(); } catch (e) { return ''; } }
  function dateFr(v) { if (!v) return ''; var p = String(v).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : v; }

  // Appel d'une fonction serveur du dossier (le code secret est envoyé à chaque fois)
  function rpc(nom, params) {
    var url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/rest/v1/rpc/' + nom;
    var cle = (typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : '');
    return fetch(url, { method: 'POST', headers: { 'apikey': cle, 'Authorization': 'Bearer ' + cle, 'Content-Type': 'application/json' }, body: JSON.stringify(params) })
      .then(function (r) { return r.json(); });
  }
  function messageRefus(r) {
    var x = (r && r.raison) || '';
    if (x === 'code_non_defini') return 'Aucun code n\'a encore été créé pour ce compte. Demandez-le à Nomos Traça.';
    if (x === 'bloque') return 'Trop d\'essais. Réessayez dans 15 minutes.';
    if (x === 'code_incorrect') return 'Code incorrect.';
    if (x === 'acces_refuse') return 'Compte non reconnu. Reconnectez-vous à l\'application.';
    return 'Accès impossible. Vérifiez la connexion internet.';
  }

  function css() {
    if (document.getElementById('daCss')) return;
    var s = document.createElement('style');
    s.id = 'daCss';
    s.textContent =
      '#daOverlay{position:fixed;inset:0;z-index:99990;background:#f4f5fb;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:Outfit,Inter,system-ui,sans-serif;color:#1b1a33}'
      + '#daOverlay .da-wrap{max-width:560px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 90px;display:flex;flex-direction:column;gap:12px}'
      + '#daOverlay .da-top{display:flex;align-items:center;gap:10px}'
      + '#daOverlay .da-btn{border:1px solid #d9dbe8;background:#fff;color:#1b1a33;border-radius:999px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}'
      + '#daOverlay .da-main{border:none;background:#1e3a5f;color:#fff;border-radius:12px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%}'
      + '#daOverlay .da-head{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:18px;padding:16px;display:flex;gap:12px;align-items:center}'
      + '#daOverlay .da-head b{display:block;font-size:18px;font-weight:900}#daOverlay .da-head small{opacity:.75;font-size:12px}'
      + '#daOverlay .da-item{background:#fff;border:1px solid #e3e4ef;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;text-align:left;width:100%;font-family:inherit;color:inherit}'
      + '#daOverlay .da-item .i{font-size:24px}#daOverlay .da-item b{display:block;font-size:15px}#daOverlay .da-item small{display:block;color:#5b5e78;font-size:12px;font-family:Inter,system-ui,sans-serif}'
      + '#daOverlay .da-item .ch{margin-left:auto;color:#9aa0b8;font-size:18px}'
      + '#daOverlay .da-rub{background:#fff;border:1px solid #e3e4ef;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;gap:10px;align-items:center;width:100%;text-align:left;font-family:inherit;color:inherit}'
      + '#daOverlay button.da-rub{cursor:pointer;border-color:#93c5fd}'
      + '#daOverlay .da-rub b{font-size:14px}#daOverlay .da-rub small{display:block;color:#5b5e78;font-size:12px;font-family:Inter,system-ui,sans-serif;margin-top:2px}'
      + '#daOverlay .da-soon{font-size:11px;font-weight:800;color:#b45309;background:#fff4e0;border-radius:999px;padding:3px 8px;white-space:nowrap}'
      + '#daOverlay .da-go{font-size:11px;font-weight:800;color:#1d4ed8;background:#e0ecff;border-radius:999px;padding:3px 8px;white-space:nowrap}'
      + '#daOverlay .da-pin{background:#fff;border:1px solid #e3e4ef;border-radius:18px;padding:20px;text-align:center;display:flex;flex-direction:column;gap:12px}'
      + '#daOverlay .da-dots{display:flex;justify-content:center;gap:10px}#daOverlay .da-dots span{width:14px;height:14px;border-radius:50%;border:2px solid #4338ca}#daOverlay .da-dots span.on{background:#4338ca}'
      + '#daOverlay .da-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:260px;margin:0 auto;width:100%}'
      + '#daOverlay .da-pad button{border:none;background:#eef0ff;color:#1b1a33;border-radius:14px;padding:14px 0;font-size:20px;font-weight:800;font-family:inherit;cursor:pointer}'
      + '#daOverlay .da-err{color:#b91c1c;font-weight:700;min-height:18px;font-size:13px}'
      + '#daOverlay .da-note{font-size:12px;color:#5b5e78;font-family:Inter,system-ui,sans-serif;margin:0}'
      + '#daOverlay .da-sect{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b5e78;margin:8px 2px 0}'
      + '#daOverlay .da-form{background:#fff;border:1px solid #e3e4ef;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}'
      + '#daOverlay .da-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#5b5e78}'
      + '#daOverlay .da-form input,#daOverlay .da-form select,#daOverlay .da-form textarea{font:inherit;font-size:16px;color:#1b1a33;border:1px solid #d9dbe8;border-radius:10px;padding:10px;background:#f8f9fc;width:100%;box-sizing:border-box}'
      + '#daOverlay .da-form textarea{min-height:70px}'
      + '#daOverlay .da-av{width:40px;height:40px;border-radius:50%;background:#e0ecff;color:#1d4ed8;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}'
      + '#daOverlay .da-warn{font-size:11px;font-weight:800;color:#b45309;background:#fff4e0;border-radius:999px;padding:3px 8px;white-space:nowrap;margin-left:auto}'
      + '#daOverlay button:focus-visible,#daOverlay input:focus-visible,#daOverlay select:focus-visible,#daOverlay textarea:focus-visible{outline:3px solid #4338ca;outline-offset:2px}';
    document.head.appendChild(s);
  }

  function overlay() {
    var o = document.getElementById('daOverlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'daOverlay';
      o.setAttribute('role', 'dialog');
      o.setAttribute('aria-label', 'Dossier administratif');
      document.body.appendChild(o);
    }
    return o;
  }
  function fermer() { var o = document.getElementById('daOverlay'); if (o) o.remove(); }
  function verrouiller() { deverrouilleJusqua = 0; pinSession = ''; cacheSalaries = null; fermer(); }
  function entete(retour) {
    return '<div class="da-top">'
      + (retour ? '<button class="da-btn" type="button" data-da="' + retour + '">← Retour</button>' : '<button class="da-btn" type="button" data-da="fermer">← Accueil</button>')
      + '<button class="da-btn" type="button" data-da="verrou" style="margin-left:auto">🔒 Verrouiller</button></div>'
      + '<div class="da-head"><span style="font-size:28px">🗂️</span><span><b>Dossier administratif</b><small>Réservé au Président · se verrouille après 5 minutes</small></span></div>';
  }
  function brancher(o) {
    o.querySelectorAll('[data-da]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-da');
        if (a === 'fermer') fermer();
        else if (a === 'verrou') verrouiller();
        else if (a === 'menu') vueMenu();
        else if (a === 'salaries') vueSalaries();
        else if (a === 'nouveau') vueFiche(null);
        else if (a.indexOf('fiche:') === 0) vueFiche(a.slice(6));
        else if (a.indexOf('doc:') === 0) { var q = a.split(':'); vueDocs(q[1], +q[2]); }
        else if (a.indexOf('voir:') === 0) voirDocument(a.slice(5));
        else if (a.indexOf('suppr:') === 0) supprimerDocument(a.slice(6), b);
        else if (a.indexOf('ajout:') === 0) { var q2 = a.split(':'); vueAjoutDoc(q2[1], +q2[2]); }
        else if (a === 'echeances') vueEcheances();
        else vuePole(a);
      });
    });
  }
  function actif() { deverrouilleJusqua = Date.now() + VERROU_MS; }
  function encoreOuvert() {
    if (pinSession && Date.now() < deverrouilleJusqua) { actif(); return true; }
    verrouiller(); return false;
  }

  function vueMenu() {
    if (!encoreOuvert()) return;
    var o = overlay();
    var h = '<div class="da-wrap">' + entete(null);
    POLES.forEach(function (p) {
      h += '<button class="da-item" type="button" data-da="' + p.id + '"><span class="i">' + p.ico + '</span><span><b>' + esc(p.titre) + '</b><small>' + esc(p.sous) + '</small></span><span class="ch">›</span></button>';
    });
    h += '</div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
  }
  function vuePole(id) {
    if (!encoreOuvert()) return;
    var p = POLES.filter(function (x) { return x.id === id; })[0];
    if (!p) return vueMenu();
    var o = overlay();
    var h = '<div class="da-wrap">' + entete('menu')
      + '<div class="da-item" style="cursor:default"><span class="i">' + p.ico + '</span><span><b>' + esc(p.titre) + '</b><small>' + esc(p.sous) + '</small></span></div>';
    p.rub.forEach(function (r, i) {
      var inner = '<span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span>';
      // Rubriques de documents : tous les pôles sauf Échéances, hors « Procédures » (à venir)
      var action = r[2] || ((p.id !== 'echeances' && r[0] !== 'Procédures') ? 'doc:' + p.id + ':' + i : '');
      h += action ? '<button class="da-rub" type="button" data-da="' + action + '">' + inner + '<span class="da-go">Ouvrir ›</span></button>'
                  : '<div class="da-rub">' + inner + '<span class="da-soon">bientôt</span></div>';
    });
    h += '</div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
  }

  // ── Salariés ──
  function manquants(s) {
    return ['nom', 'prenom', 'naissance_date', 'nationalite', 'adresse', 'nir', 'poste', 'date_embauche', 'contrat', 'salaire_brut']
      .filter(function (k) { return s[k] == null || s[k] === ''; }).length;
  }
  function ligneSalarie(s) {
    var init = ((s.prenom || ' ')[0] + (s.nom || ' ')[0]).toUpperCase();
    var m = manquants(s);
    return '<button class="da-item" type="button" data-da="fiche:' + esc(s.id) + '"><span class="da-av">' + esc(init) + '</span>'
      + '<span><b>' + esc((s.prenom || '') + ' ' + (s.nom || '')) + '</b><small>' + esc(s.poste || 'Poste à compléter') + (s.date_embauche ? ' · entré le ' + dateFr(s.date_embauche) : '') + '</small></span>'
      + (m ? '<span class="da-warn">' + m + ' à compléter</span>' : '<span class="ch">›</span>') + '</button>';
  }
  function vueSalaries() {
    if (!encoreOuvert()) return;
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-note">Chargement…</p></div>';
    brancher(o);
    rpc('da_salaries', { p_code: codeCompte(), p_pin: pinSession }).then(function (r) {
      if (!r || r.ok !== true) { o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-err">' + esc(messageRefus(r)) + '</p></div>'; brancher(o); return; }
      cacheSalaries = r.salaries || [];
      var actifs = cacheSalaries.filter(function (s) { return s.statut !== 'ancien'; });
      var anciens = cacheSalaries.filter(function (s) { return s.statut === 'ancien'; });
      var h = '<div class="da-wrap">' + entete('personnel')
        + '<button class="da-main" type="button" data-da="nouveau">＋ Ajouter un salarié</button>'
        + '<div class="da-sect">En activité · ' + actifs.length + '</div>';
      h += actifs.length ? actifs.map(ligneSalarie).join('') : '<p class="da-note">Aucun salarié enregistré.</p>';
      if (anciens.length) h += '<div class="da-sect">Anciens salariés · ' + anciens.length + '</div>' + anciens.map(ligneSalarie).join('');
      h += '</div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
    }, function () { o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-err">Pas de connexion internet.</p></div>'; brancher(o); });
  }
  function vueFiche(id) {
    if (!encoreOuvert()) return;
    var s = id ? ((cacheSalaries || []).filter(function (x) { return x.id === id; })[0] || {}) : { statut: 'actif' };
    var o = overlay();
    var h = '<div class="da-wrap">' + entete('salaries') + '<form class="da-form" id="daFiche">'
      + '<b style="font-size:17px">' + (id ? esc((s.prenom || '') + ' ' + (s.nom || '')) : 'Nouveau salarié') + '</b>';
    CHAMPS.forEach(function (c) {
      var v = s[c[0]];
      if (c[0] === 'horaires' && v) v = Array.isArray(v) ? v.join('\n') : String(v);
      var idc = 'da_' + c[0];
      if (c[2] === 'select') {
        h += '<label for="' + idc + '">' + esc(c[1]) + '<select id="' + idc + '" name="' + c[0] + '">' + c[3].map(function (o2) { return '<option value="' + o2[0] + '"' + (v === o2[0] ? ' selected' : '') + '>' + esc(o2[1]) + '</option>'; }).join('') + '</select></label>';
      } else if (c[2] === 'textarea') {
        h += '<label for="' + idc + '">' + esc(c[1]) + '<textarea id="' + idc + '" name="' + c[0] + '">' + esc(v || '') + '</textarea></label>';
      } else {
        h += '<label for="' + idc + '">' + esc(c[1]) + '<input id="' + idc + '" name="' + c[0] + '" type="' + c[2] + '"' + (c[2] === 'number' ? ' step="0.01" inputmode="decimal"' : '') + ' value="' + esc(v == null ? '' : (c[2] === 'date' ? String(v).slice(0, 10) : v)) + '"></label>';
      }
    });
    h += '<p class="da-err" id="daMsg"></p><button class="da-main" type="submit">💾 Enregistrer</button></form></div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
    o.querySelector('#daFiche').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!encoreOuvert()) return;
      var data = { id: id || null };
      CHAMPS.forEach(function (c) {
        var el = o.querySelector('#da_' + c[0]); var v = el ? el.value.trim() : '';
        if (c[0] === 'horaires') data[c[0]] = v ? v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : null;
        else if (c[2] === 'number') data[c[0]] = v === '' ? null : Number(v.replace(',', '.'));
        else data[c[0]] = v === '' ? null : v;
      });
      if (!data.nom && !data.prenom) { o.querySelector('#daMsg').textContent = 'Indiquez au moins le nom ou le prénom.'; return; }
      var msg = o.querySelector('#daMsg'); msg.style.color = '#5b5e78'; msg.textContent = 'Enregistrement…';
      rpc('da_enregistrer_salarie', { p_code: codeCompte(), p_pin: pinSession, p_s: data }).then(function (r) {
        if (!r || r.ok !== true) { msg.style.color = '#b91c1c'; msg.textContent = messageRefus(r); return; }
        vueSalaries();
      }, function () { msg.style.color = '#b91c1c'; msg.textContent = 'Pas de connexion internet : rien n\'a été enregistré.'; });
    });
  }

  // ── Documents du coffre-fort (fichiers gardés dans la base, lus avec le code) ──
  var cacheDocs = null, docCourant = null;
  function rubrique(pole, i) { var p = POLES.filter(function (x) { return x.id === pole; })[0]; return p ? p.rub[i] : null; }
  function nomSalarie(id) { var s = (cacheSalaries || []).filter(function (x) { return x.id === id; })[0]; return s ? ((s.prenom || '') + ' ' + (s.nom || '')).trim() : ''; }
  function chargerSalariesSiBesoin() {
    if (cacheSalaries) return Promise.resolve(cacheSalaries);
    return rpc('da_salaries', { p_code: codeCompte(), p_pin: pinSession }).then(function (r) { cacheSalaries = (r && r.ok) ? (r.salaries || []) : []; return cacheSalaries; });
  }
  function taille(n) { n = +n || 0; return n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko'; }
  function vueDocs(pole, i) {
    if (!encoreOuvert()) return;
    var r = rubrique(pole, i); if (!r) return vueMenu();
    docCourant = { pole: pole, i: i };
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete(pole) + '<p class="da-note">Chargement…</p></div>'; brancher(o);
    chargerSalariesSiBesoin().then(function () { return rpc('da_documents_liste', { p_code: codeCompte(), p_pin: pinSession }); }).then(function (res) {
      if (!res || res.ok !== true) { o.innerHTML = '<div class="da-wrap">' + entete(pole) + '<p class="da-err">' + esc(messageRefus(res)) + '</p></div>'; brancher(o); return; }
      cacheDocs = res.documents || [];
      var docs = cacheDocs.filter(function (d) { return d.pole === pole && d.categorie === r[0]; });
      var h = '<div class="da-wrap">' + entete(pole)
        + '<div class="da-item" style="cursor:default"><span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span></div>'
        + '<button class="da-main" type="button" data-da="ajout:' + pole + ':' + i + '">＋ Ajouter un document</button>';
      if (!docs.length) h += '<p class="da-note">Aucun document pour l\'instant.</p>';
      docs.forEach(function (d) {
        var sal = d.salarie_id ? nomSalarie(d.salarie_id) : '';
        h += '<div class="da-rub"><span><b>' + esc(d.titre || d.nom_fichier || 'Document') + '</b><small>'
          + esc([sal, d.date_doc ? dateFr(d.date_doc) : '', taille(d.taille)].filter(Boolean).join(' · ')) + '</small></span>'
          + '<span style="display:flex;gap:6px"><button class="da-btn" type="button" data-da="voir:' + esc(d.id) + '">Voir</button>'
          + '<button class="da-btn" type="button" data-da="suppr:' + esc(d.id) + '" aria-label="Supprimer">🗑️</button></span></div>';
      });
      h += '</div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
    }, function () { o.innerHTML = '<div class="da-wrap">' + entete(pole) + '<p class="da-err">Pas de connexion internet.</p></div>'; brancher(o); });
  }
  // Photo réduite (1600 px, JPEG) pour ne pas alourdir la base ; PDF envoyé tel quel.
  function lireFichier(f) {
    return new Promise(function (ok, ko) {
      var rd = new FileReader();
      rd.onerror = function () { ko(new Error('lecture')); };
      if (/^image\//.test(f.type)) {
        rd.onload = function () {
          var img = new Image();
          img.onload = function () {
            var max = 1600, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
            var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var url = c.toDataURL('image/jpeg', 0.82);
            ok({ type: 'image/jpeg', b64: url.split(',')[1], nom: f.name.replace(/\.[^.]+$/, '') + '.jpg' });
          };
          img.onerror = function () { ko(new Error('image')); };
          img.src = rd.result;
        };
      } else {
        rd.onload = function () { ok({ type: f.type || 'application/octet-stream', b64: String(rd.result).split(',')[1], nom: f.name }); };
      }
      rd.readAsDataURL(f);
    });
  }
  function vueAjoutDoc(pole, i) {
    if (!encoreOuvert()) return;
    var r = rubrique(pole, i); if (!r) return vueMenu();
    var o = overlay();
    chargerSalariesSiBesoin().then(function (sal) {
      var optSal = '<option value="">— Aucun (document de la société) —</option>' + sal.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + (s.statut === 'ancien' ? ' (ancien)' : '') + '</option>'; }).join('');
      o.innerHTML = '<div class="da-wrap">' + entete('doc:' + pole + ':' + i) + '<form class="da-form" id="daDoc">'
        + '<b style="font-size:17px">Ajouter : ' + esc(r[0]) + '</b>'
        + '<label for="daf_fichier">Fichier (photo ou PDF)<input id="daf_fichier" type="file" accept="image/*,application/pdf" required></label>'
        + '<label for="daf_titre">Titre<input id="daf_titre" placeholder="Ex. : Contrat CDI signé"></label>'
        + (pole === 'personnel' ? '<label for="daf_sal">Salarié concerné<select id="daf_sal">' + optSal + '</select></label>' : '')
        + '<label for="daf_date">Date du document<input id="daf_date" type="date"></label>'
        + '<p class="da-err" id="dafMsg"></p><button class="da-main" type="submit">💾 Enregistrer le document</button></form></div>';
      brancher(o); o.scrollTop = 0;
      o.querySelector('#daDoc').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!encoreOuvert()) return;
        var f = o.querySelector('#daf_fichier').files[0], msg = o.querySelector('#dafMsg');
        if (!f) { msg.textContent = 'Choisissez un fichier.'; return; }
        msg.style.color = '#5b5e78'; msg.textContent = 'Préparation du fichier…';
        lireFichier(f).then(function (x) {
          if (x.b64.length > 9000000) { msg.style.color = '#b91c1c'; msg.textContent = 'Fichier trop gros (6 Mo maximum).'; return; }
          msg.textContent = 'Envoi…';
          var sel = o.querySelector('#daf_sal');
          return rpc('da_document_ajouter', { p_code: codeCompte(), p_pin: pinSession, p_d: {
            pole: pole, categorie: r[0], titre: o.querySelector('#daf_titre').value.trim() || x.nom,
            salarie_id: sel && sel.value ? sel.value : null, date_doc: o.querySelector('#daf_date').value || null,
            nom_fichier: x.nom, type_mime: x.type, taille: Math.round(x.b64.length * 0.75), contenu: x.b64 } }).then(function (res) {
            if (!res || res.ok !== true) { msg.style.color = '#b91c1c'; msg.textContent = res && res.raison === 'fichier_trop_gros' ? 'Fichier trop gros (6 Mo maximum).' : messageRefus(res); return; }
            vueDocs(pole, i);
          });
        }).catch(function () { msg.style.color = '#b91c1c'; msg.textContent = 'Envoi impossible. Vérifiez la connexion internet.'; });
      });
    });
  }
  function voirDocument(id) {
    if (!encoreOuvert()) return;
    rpc('da_document_lire', { p_code: codeCompte(), p_pin: pinSession, p_id: id }).then(function (r) {
      if (!r || r.ok !== true) { alert(messageRefus(r)); return; }
      var bin = atob(r.contenu), arr = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
      var url = URL.createObjectURL(new Blob([arr], { type: r.type_mime || 'application/octet-stream' }));
      var o = overlay(), retour = docCourant ? 'doc:' + docCourant.pole + ':' + docCourant.i : 'menu';
      var vue = /^image\//.test(r.type_mime) ? '<img src="' + url + '" alt="' + esc(r.nom_fichier) + '" style="width:100%;border-radius:12px;background:#fff">'
        : '<iframe src="' + url + '" title="' + esc(r.nom_fichier) + '" style="width:100%;height:70vh;border:1px solid #e3e4ef;border-radius:12px;background:#fff"></iframe>';
      o.innerHTML = '<div class="da-wrap">' + entete(retour) + '<b>' + esc(r.nom_fichier) + '</b>' + vue
        + '<a class="da-main" style="text-align:center;text-decoration:none" href="' + url + '" download="' + esc(r.nom_fichier) + '" target="_blank" rel="noopener">⬇️ Télécharger / ouvrir</a></div>';
      brancher(o); o.scrollTop = 0;
    }, function () { alert('Pas de connexion internet.'); });
  }
  // Suppression en deux touchers (le premier demande confirmation)
  function supprimerDocument(id, btn) {
    if (!encoreOuvert()) return;
    if (btn.getAttribute('data-confirme') !== '1') { btn.setAttribute('data-confirme', '1'); btn.textContent = 'Confirmer ?'; btn.style.color = '#b91c1c'; return; }
    rpc('da_document_supprimer', { p_code: codeCompte(), p_pin: pinSession, p_id: id }).then(function () {
      if (docCourant) vueDocs(docCourant.pole, docCourant.i); else vueMenu();
    });
  }

  // ── Échéances calculées à partir des fiches salariés ──
  function vueEcheances() {
    if (!encoreOuvert()) return;
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('menu') + '<p class="da-note">Chargement…</p></div>'; brancher(o);
    cacheSalaries = null;
    chargerSalariesSiBesoin().then(function (sal) {
      var auj = new Date(); auj.setHours(0, 0, 0, 0);
      var items = [];
      sal.filter(function (s) { return s.statut !== 'ancien'; }).forEach(function (s) {
        var nom = ((s.prenom || '') + ' ' + (s.nom || '')).trim();
        [['essai_fin', 'Fin de période d\'essai'], ['titre_sejour_fin', 'Fin du titre de séjour']].forEach(function (c) {
          if (!s[c[0]]) return;
          var d = new Date(String(s[c[0]]).slice(0, 10) + 'T00:00:00'), j = Math.round((d - auj) / 86400000);
          if (j < -30) return; // échéance passée depuis plus d'un mois : terminée
          items.push({ j: j, txt: c[1] + ' — ' + nom, date: dateFr(s[c[0]]) });
        });
      });
      items.sort(function (a, b) { return a.j - b.j; });
      var h = '<div class="da-wrap">' + entete('menu') + '<div class="da-item" style="cursor:default"><span class="i">⏰</span><span><b>Échéances</b><small>Calculées à partir des fiches salariés</small></span></div>';
      if (!items.length) h += '<p class="da-note">Aucune échéance à venir.</p>';
      items.forEach(function (it) {
        var etat = it.j < 0 ? 'passée' : (it.j === 0 ? 'aujourd\'hui' : 'dans ' + it.j + ' j');
        h += '<div class="da-rub"><span><b>' + esc(it.txt) + '</b><small>' + esc(it.date) + '</small></span><span class="' + (it.j <= 15 ? 'da-warn' : 'da-go') + '">' + esc(etat) + '</span></div>';
      });
      h += '<p class="da-note">Les visites médicales et les entretiens s\'ajouteront avec les prochaines rubriques.</p></div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
    });
  }

  // ── Code secret à 6 chiffres, vérifié par le serveur ──
  function vueCode() {
    var code = '';
    var o = overlay();
    o.innerHTML = '<div class="da-wrap"><div class="da-top"><button class="da-btn" type="button" data-da="fermer">← Accueil</button></div>'
      + '<div class="da-pin"><div style="font-size:30px">🔒</div><b style="font-size:18px">Dossier administratif</b>'
      + '<span class="da-note">Entrez votre code secret à 6 chiffres</span><div class="da-dots" id="daDots">' + '<span></span>'.repeat(6) + '</div>'
      + '<div class="da-err" id="daErr"></div><div class="da-pad" id="daPad"></div>'
      + '<p class="da-note">Le code est donné par Nomos Traça au Président. Ne le communiquez pas aux salariés.</p></div></div>';
    brancher(o);
    var pad = o.querySelector('#daPad');
    function maj() { o.querySelectorAll('#daDots span').forEach(function (s, i) { s.classList.toggle('on', i < code.length); }); }
    function valider() {
      var err = o.querySelector('#daErr');
      err.style.color = '#5b5e78'; err.textContent = 'Vérification…';
      rpc('da_ouvrir', { p_code: codeCompte(), p_pin: code }).then(function (r) {
        if (r && r.ok === true) { pinSession = code; actif(); vueMenu(); return; }
        err.style.color = '#b91c1c'; err.textContent = messageRefus(r); code = ''; maj();
      }, function () { err.style.color = '#b91c1c'; err.textContent = 'Pas de connexion internet.'; code = ''; maj(); });
    }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = k;
      if (!k) { b.style.visibility = 'hidden'; }
      else {
        b.setAttribute('aria-label', k === '⌫' ? 'Effacer' : 'Chiffre ' + k);
        b.addEventListener('click', function () {
          o.querySelector('#daErr').textContent = '';
          if (k === '⌫') { code = code.slice(0, -1); maj(); return; }
          if (code.length < 6) { code += k; maj(); }
          if (code.length === 6) setTimeout(valider, 120);
        });
      }
      pad.appendChild(b);
    });
    maj();
  }

  window.ouvrirDossierAdministratif = function () {
    css();
    if (pinSession && Date.now() < deverrouilleJusqua) vueMenu(); else { pinSession = ''; vueCode(); }
  };
  // Verrouillage automatique même si l'écran reste ouvert
  setInterval(function () { if (pinSession && Date.now() >= deverrouilleJusqua) verrouiller(); }, 15000);

  // Tuile tout en haut de l'accueil (mode simple et mode expert), vue du premier coup.
  function installerTuile() {
    try {
      if (typeof FORMULE_ACTIVE !== 'undefined' && FORMULE_ACTIVE === 'rth') return;
      var bouton = '<button type="button" onclick="ouvrirDossierAdministratif()" style="width:100%;display:flex;align-items:center;gap:14px;border:none;border-radius:16px;padding:16px;margin:6px 0 14px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;text-align:left;cursor:pointer;font-family:Outfit,Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(15,23,42,.25)">'
        + '<span style="font-size:28px">🗂️</span><span style="flex:1"><b style="display:block;font-size:16px;font-weight:900">Dossier administratif</b><small style="display:block;opacity:.75;font-size:12px">Personnel · associés · déclarations</small></span><span style="font-size:18px" aria-hidden="true">🔒</span></button>';
      var body = document.querySelector('#page-guide .pg-body') || (document.getElementById('barometreHaccp') || {}).parentNode;
      if (body && !document.getElementById('daTuile')) {
        var w = document.createElement('div');
        w.id = 'daTuile';
        w.innerHTML = bouton;
        body.insertBefore(w, body.firstChild);
      }
      var tete = document.querySelector('#page-home .ph4-row1');
      var hote = tete ? tete.parentNode : document.querySelector('#page-home .ph4-wrap');
      if (hote && !document.getElementById('daTuileExpert')) {
        var w2 = document.createElement('div');
        w2.id = 'daTuileExpert';
        w2.style.cssText = 'margin-top:44px'; // laisse la place au bouton flottant « Mes rapports »
        w2.innerHTML = bouton;
        hote.insertBefore(w2, tete ? tete.nextSibling : hote.firstChild);
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(installerTuile, 300); });
  else setTimeout(installerTuile, 300);
})();

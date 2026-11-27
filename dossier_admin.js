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
    p.rub.forEach(function (r) {
      var inner = '<span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span>';
      h += r[2] ? '<button class="da-rub" type="button" data-da="' + r[2] + '">' + inner + '<span class="da-go">Ouvrir ›</span></button>'
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

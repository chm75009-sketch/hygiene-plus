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
        ['Embauche', 'Contrats, avenants, déclarations d\'embauche, pièces d\'identité, titres de séjour'],
        ['Paie', 'Bulletins de salaire'],
        ['Santé et formation', 'Visites médicales, formations hygiène'],
        ['Procédures', 'Rappel à l\'ordre, mise en garde, avertissement, blâme, mise à pied, licenciement', 'procs'],
        ['Registre unique du personnel', 'Obligatoire : tous les salariés, dans l\'ordre des embauches', 'registre']
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
        ['Affichages obligatoires', '16 affiches prêtes à imprimer, une par fichier', 'affichages']
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
    ['sexe', 'Sexe', 'select', [['', '—'], ['Homme', 'Homme'], ['Femme', 'Femme']]],
    ['nir', 'N° de sécurité sociale', 'text'],
    ['poste', 'Poste', 'text'], ['qualification', 'Qualification (statut, niveau, échelon)', 'text'],
    ['date_embauche', 'Date d\'embauche', 'date'], ['date_sortie', 'Date de sortie', 'date'],
    ['contrat', 'Contrat', 'text'], ['heures_hebdo', 'Heures par semaine', 'number'], ['salaire_brut', 'Salaire brut mensuel (€)', 'number'],
    ['essai_fin', 'Fin de période d\'essai', 'date'], ['repos', 'Jours de repos', 'text'],
    ['horaires', 'Horaires (une ligne par jour)', 'textarea'],
    ['titre_travail_type', 'Titre de séjour : type (ex. : carte de résident, carte pluriannuelle)', 'text'], ['titre_travail_num', 'Titre de séjour : numéro', 'text'],
    ['titre_sejour_fin', 'Fin de validité du titre de séjour', 'date'], ['notes', 'Notes', 'textarea']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function codeCompte() { try { return (localStorage.getItem('haccp_last_code') || '').toUpperCase(); } catch (e) { return ''; } }
  function dateFr(v) { if (!v) return ''; var p = String(v).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : v; }

  // Appel d'une fonction serveur du dossier (le code secret est envoyé à chaque fois)
  // Envoi d'un gros fichier avec suivi de la progression (pourcentage affiché pendant l'envoi)
  function rpcAvecProgression(nom, params, surProgression) {
    return new Promise(function (ok, ko) {
      var cle = (typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : '');
      var x = new XMLHttpRequest();
      x.open('POST', (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/rest/v1/rpc/' + nom);
      x.setRequestHeader('apikey', cle); x.setRequestHeader('Authorization', 'Bearer ' + cle); x.setRequestHeader('Content-Type', 'application/json');
      if (x.upload && surProgression) x.upload.onprogress = function (e) { if (e.lengthComputable) surProgression(Math.round(e.loaded * 100 / e.total)); };
      x.onload = function () { try { ok(JSON.parse(x.responseText)); } catch (e) { ko(e); } };
      x.onerror = function () { ko(new Error('reseau')); };
      x.send(JSON.stringify(params));
    });
  }
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
      b.addEventListener('click', function () { allerA(b.getAttribute('data-da'), b); });
    });
  }
  function allerA(a, b) {
        if (a === 'fermer') fermer();
        else if (a === 'coffre') vueCoffre();
        else if (a === 'import') vueImport();
        else if (a.indexOf('ajoutsal:') === 0) { var q3 = a.split(':'); var t = TYPES_PERSO[+q3[2]]; vueAjoutDoc('personnel', rubIndex('personnel', t[1]), q3[1], t[0], q3[3] === 'c' ? 'coffre' : 'fiche:' + q3[1]); }
        else if (a.indexOf('ajoutsoc:') === 0) { var q4 = a.split(':'); vueAjoutDoc(q4[1], +q4[2], null, null, 'coffre'); }
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
        else if (a === 'procs') vueProcs();
        else if (a === 'registre') vueRegistre();
        else if (a === 'affichages') vueAffichages();
        else if (a.indexOf('voirrub:') === 0) { var q5 = a.split(':'); docCourant = { pole: q5[1], i: +q5[2] }; voirDocument(q5[3]); }
        else if (a.indexOf('procmod:') === 0) vueProcNouvelle((cacheProcs || []).filter(function (x) { return x.id === a.slice(8); })[0]);
        else if (a.indexOf('procarch:') === 0) archiverProc(a.slice(9));
        else if (a.indexOf('docmod:') === 0) vueDocModifier(a.slice(7));
        else if (a.indexOf('docarch:') === 0) archiverDocument(a.slice(8));
        else if (a.indexOf('salarch:') === 0) archiverSalarie(a.slice(8));
        else if (a.indexOf('salsuppr:') === 0) supprimerSalarie(a.slice(9), b);
        else if (a === 'procnew') vueProcNouvelle();
        else if (a.indexOf('procvoir:') === 0) vueProcVoir(a.slice(9));
        else if (a.indexOf('procsuppr:') === 0) supprimerProc(a.slice(10), b);
        else vuePole(a);
  }
  function actif() { deverrouilleJusqua = Date.now() + VERROU_MS; }
  function encoreOuvert() {
    if (pinSession && Date.now() < deverrouilleJusqua) { actif(); return true; }
    verrouiller(); return false;
  }

  function vueMenu() {
    if (!encoreOuvert()) return;
    var o = overlay();
    var h = '<div class="da-wrap">' + entete(null)
      + '<button class="da-item" type="button" data-da="coffre" style="border-color:#93c5fd"><span class="i">🗄️</span><span><b>Coffre-fort</b><small>Documents reçus et manquants : société et chaque salarié</small></span><span class="ch">›</span></button>'
      + '<button class="da-item" type="button" data-da="import" style="border-color:#93c5fd"><span class="i">📥</span><span><b>Importer des documents</b><small>Plusieurs fichiers d\'un coup : contrats, DPAE, titres de séjour, statuts…</small></span><span class="ch">›</span></button>'
      + '<button class="da-item" type="button" data-da="registre" style="border-color:#93c5fd"><span class="i">📒</span><span><b>Registre unique du personnel</b><small>Tous les salariés, entrées et sorties · imprimer, exporter</small></span><span class="ch">›</span></button>';
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
      + '<div class="da-item" style="cursor:default"><span class="i">' + p.ico + '</span><span><b>' + esc(p.titre) + '</b><small>' + esc(p.sous) + '</small></span></div>'
      + (p.id !== 'echeances' ? '<p class="da-note" id="daPoleResume" style="margin:0">Chargement…</p>' : '');
    p.rub.forEach(function (r, i) {
      var inner = '<span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span>';
      // Rubriques de documents : tous les pôles sauf Échéances, hors « Procédures » (à venir)
      var action = r[2] || ((p.id !== 'echeances' && r[0] !== 'Procédures') ? 'doc:' + p.id + ':' + i : '');
      h += action ? '<button class="da-rub" type="button" data-da="' + action + '">' + inner + '<span class="da-go"' + (action.indexOf('doc:') === 0 ? ' data-compte="' + esc(r[0]) + '"' : '') + '>Ouvrir ›</span></button>'
                  : '<div class="da-rub">' + inner + '<span class="da-soon">bientôt</span></div>';
    });
    h += '</div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
    // Pour chaque rubrique : ✓ Voir (présent) · ⚠ À importer (obligatoire absent) · ＋ Importer (facultatif absent)
    cacheDocs = null;
    chargerDocs().then(function (docs) {
      var total = 0, manquants = 0;
      o.querySelectorAll('[data-compte]').forEach(function (sp) {
        var titre = sp.getAttribute('data-compte'), i = rubIndex(id, titre), row = sp.parentNode;
        var L = docs.filter(function (d) { return !d.archive && docDansRubrique(d, id, titre); });
        var oblig = OBLIG_SOC.some(function (x) { return x[0] === id && x[1] === titre; });
        total += L.length;
        if (L.length) {
          sp.textContent = '✓ Voir' + (L.length > 1 ? ' (' + L.length + ')' : ''); sp.style.background = '#e8f6ed'; sp.style.color = '#15803d';
          if (L.length === 1) row.setAttribute('data-da', 'voirrub:' + id + ':' + i + ':' + L[0].id);
        } else {
          if (oblig) manquants++;
          sp.textContent = oblig ? '⚠ À importer' : '＋ Importer';
          sp.style.background = oblig ? '#fff4e5' : '#f1f2f6'; sp.style.color = oblig ? '#b45309' : '#5b5e78';
          row.setAttribute('data-da', 'ajout:' + id + ':' + i);
        }
      });
      var res = o.querySelector('#daPoleResume');
      if (res) res.innerHTML = total + ' document' + (total > 1 ? 's' : '') + (manquants ? ' · <b style="color:#b45309">' + manquants + ' obligatoire' + (manquants > 1 ? 's' : '') + ' manquant' + (manquants > 1 ? 's' : '') + '</b>' : (id === 'personnel' ? '' : ' · <b style="color:#15803d">obligatoires complets</b>'));
    }).catch(function () {});
  }

  // ── Salariés ──
  // Champs obligatoires (registre unique du personnel, DPAE, paie). Le titre de travail
  // n'est exigé que pour un salarié étranger hors UE/EEE/Suisse, la date de sortie que pour un ancien salarié.
  var CHAMPS_OBLIG = ['nom', 'prenom', 'sexe', 'naissance_date', 'nationalite', 'adresse', 'nir', 'poste', 'qualification', 'date_embauche', 'contrat', 'heures_hebdo', 'salaire_brut'];
  function champsObligatoires(s) {
    var L = CHAMPS_OBLIG.slice();
    if (autorisationRequise(s) === true) L.push('titre_travail_type', 'titre_travail_num');
    if (s.statut === 'ancien') L.push('date_sortie');
    return L;
  }
  function vide(v) { return v == null || v === '' || (Array.isArray(v) && !v.length); }
  function champsManquants(s) { return champsObligatoires(s).filter(function (k) { return vide(s[k]); }); }
  function libelleChamp(k) { var c = CHAMPS.filter(function (x) { return x[0] === k; })[0]; return c ? c[1].replace(/ \(.*\)$/, '') : k; }
  function manquants(s) { return champsManquants(s).length; }
  function ligneSalarie(s) {
    var init = ((s.prenom || ' ')[0] + (s.nom || ' ')[0]).toUpperCase();
    var M = champsManquants(s), m = M.length;
    return '<button class="da-item" type="button" data-da="fiche:' + esc(s.id) + '"><span class="da-av">' + esc(init) + '</span>'
      + '<span><b>' + esc((s.prenom || '') + ' ' + (s.nom || '')) + '</b><small>' + esc(s.poste || 'Poste à compléter') + (s.date_embauche ? ' · entré le ' + dateFr(s.date_embauche) : '') + '</small>'
      + (m ? '<small style="color:#b45309">Manque : ' + esc(M.map(libelleChamp).join(', ')) + '</small>' : '') + '</span>'
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
    docCourant = null;
    var s = id ? ((cacheSalaries || []).filter(function (x) { return x.id === id; })[0] || {}) : { statut: 'actif' };
    var o = overlay();
    var h = '<div class="da-wrap">' + entete('salaries') + '<form class="da-form" id="daFiche">'
      + '<b style="font-size:17px">' + (id ? esc((s.prenom || '') + ' ' + (s.nom || '')) : 'Nouveau salarié') + '</b>';
    var oblig = champsObligatoires(s), manq = id ? champsManquants(s) : [];
    h += manq.length
      ? '<div style="border:2px solid #f59e0b;background:#fff7e6;border-radius:12px;padding:10px;font-size:13.5px"><b style="color:#b45309">⚠ ' + manq.length + ' information' + (manq.length > 1 ? 's' : '') + ' obligatoire' + (manq.length > 1 ? 's' : '') + ' à compléter :</b><br>'
        + manq.map(function (k) { return '<button type="button" class="da-btn" data-aller="' + k + '" style="margin:4px 4px 0 0;color:#b45309">' + esc(libelleChamp(k)) + '</button>'; }).join('') + '</div>'
      : (id ? '<div style="border:2px solid #86efac;background:#ecfdf3;border-radius:12px;padding:10px;font-size:13.5px;color:#15803d"><b>✓ Fiche complète</b></div>' : '');
    h += '<p class="da-note" style="margin:0"><b style="color:#dc2626">*</b> obligatoire (registre du personnel, déclaration d\'embauche, paie)</p>';
    CHAMPS.forEach(function (c) {
      var v = s[c[0]];
      if (c[0] === 'horaires' && v) v = Array.isArray(v) ? v.join('\n') : String(v);
      var idc = 'da_' + c[0];
      var etoile = oblig.indexOf(c[0]) > -1 ? ' <b style="color:#dc2626">*</b>' : '';
      var styleManq = manq.indexOf(c[0]) > -1 ? ' style="border:2px solid #f59e0b;background:#fff7e6"' : '';
      if (c[2] === 'select') {
        h += '<label for="' + idc + '">' + '<span>' + esc(c[1]) + etoile + '</span><select' + styleManq + ' id="' + idc + '" name="' + c[0] + '">' + c[3].map(function (o2) { return '<option value="' + o2[0] + '"' + (v === o2[0] ? ' selected' : '') + '>' + esc(o2[1]) + '</option>'; }).join('') + '</select></label>';
      } else if (c[2] === 'textarea') {
        h += '<label for="' + idc + '">' + '<span>' + esc(c[1]) + etoile + '</span><textarea' + styleManq + ' id="' + idc + '" name="' + c[0] + '">' + esc(v || '') + '</textarea></label>';
      } else {
        h += '<label for="' + idc + '">' + '<span>' + esc(c[1]) + etoile + '</span><input' + styleManq + ' id="' + idc + '" name="' + c[0] + '" type="' + c[2] + '"' + (c[2] === 'number' ? ' step="0.01" inputmode="decimal"' : '') + ' value="' + esc(v == null ? '' : (c[2] === 'date' ? String(v).slice(0, 10) : v)) + '"></label>';
      }
    });
    h += '<p class="da-err" id="daMsg"></p><button class="da-main" type="submit">💾 Enregistrer</button></form>'
      + (id ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        + (s.statut === 'ancien' ? '<button class="da-btn" type="button" data-da="salarch:' + esc(id) + '">📤 Réintégrer (en activité)</button>'
                                 : '<button class="da-btn" type="button" data-da="salarch:' + esc(id) + '">📦 Archiver (départ)</button>')
        + '<button class="da-btn" type="button" data-da="salsuppr:' + esc(id) + '" style="color:#b91c1c">🗑️ Supprimer</button></div>'
        + '<p class="da-note">Un salarié qui part s\'archive : il reste au registre du personnel 5 ans. « Supprimer » sert uniquement à effacer une fiche créée par erreur.</p>' : '')
      + (id ? '<div class="da-sect">🗄️ Coffre-fort du salarié</div><div id="daFicheCoffre"><p class="da-note">Chargement…</p></div>'
            + '<div class="da-sect">⚖️ Procédures du salarié</div><div id="daFicheProcs"><p class="da-note">Chargement…</p></div>' : '') + '</div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
    // Toucher un manquant : aller au champ ; un champ rempli perd sa couleur orange
    o.querySelectorAll('[data-aller]').forEach(function (b) {
      b.addEventListener('click', function () { var el = o.querySelector('#da_' + b.getAttribute('data-aller')); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { try { el.focus(); } catch (e) {} }, 300); } });
    });
    manq.forEach(function (k) {
      var el = o.querySelector('#da_' + k); if (!el) return;
      ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { var ok = el.value.trim() !== ''; el.style.border = ok ? '' : '2px solid #f59e0b'; el.style.background = ok ? '' : '#fff7e6'; }); });
    });
    if (id) rpc('da_procedures_liste', { p_code: codeCompte(), p_pin: pinSession }).then(function (r) {
      var box = o.querySelector('#daFicheProcs'); if (!box) return;
      if (!r || r.ok !== true) { box.innerHTML = '<p class="da-err">Procédures indisponibles.</p>'; return; }
      cacheProcs = r.procedures || [];
      var L = cacheProcs.filter(function (p) { return p.salarie_id === id; });
      box.innerHTML = (L.length ? L.map(function (p) {
        var t = TYPES_PROC[p.type] || { titre: p.type };
        return '<button class="da-item" type="button" data-da="procvoir:' + esc(p.id) + '"><span class="i">' + (p.statut === 'archivee' ? '📦' : (t.lourd ? '🔴' : '🟠')) + '</span><span><b>' + esc(t.titre) + '</b><small>Lettre du ' + esc(dateFr(p.date_lettre)) + '</small></span><span class="ch">›</span></button>';
      }).join('') : '<p class="da-note">Aucune procédure.</p>') + '<button class="da-btn" type="button" data-da="procnew">＋ Nouvelle procédure</button>';
      brancher(box);
    }, function () { var box = o.querySelector('#daFicheProcs'); if (box) box.innerHTML = '<p class="da-err">Pas de connexion internet.</p>'; });
    if (id) chargerDocs().then(function () {
      var box = o.querySelector('#daFicheCoffre'); if (!box) return;
      box.innerHTML = blocCoffreSalarie(s, '') ; brancher(box);
    }, function () { var box = o.querySelector('#daFicheCoffre'); if (box) box.innerHTML = '<p class="da-err">Documents indisponibles.</p>'; });
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
      var tous = cacheDocs.filter(function (d) { return docDansRubrique(d, pole, r[0]); });
      var docs = tous.filter(function (d) { return !d.archive; }), archives = tous.filter(function (d) { return d.archive; });
      var h = '<div class="da-wrap">' + entete(pole)
        + '<div class="da-item" style="cursor:default"><span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span></div>'
        + '<button class="da-main" type="button" data-da="ajout:' + pole + ':' + i + '">＋ Ajouter un document</button>';
      if (!docs.length) h += '<p class="da-note">Aucun document pour l\'instant.</p>';
      var finArchives = archives.length ? '<details class="da-form"><summary style="cursor:pointer;font-weight:800">📦 Archivés · ' + archives.length + '</summary>' + archives.map(ligneDoc).join('') + '</details>' : '';
      docs.forEach(function (d) {
        var sal = d.salarie_id ? nomSalarie(d.salarie_id) : '';
        h += '<div class="da-rub"><span><b>' + esc(d.titre || d.nom_fichier || 'Document') + '</b><small>'
          + esc([sal, d.date_doc ? dateFr(d.date_doc) : '', taille(d.taille)].filter(Boolean).join(' · ')) + '</small></span>'
          + '<span style="display:flex;gap:6px"><button class="da-btn" type="button" data-da="voir:' + esc(d.id) + '">Voir</button>'
          + '<button class="da-btn" type="button" data-da="docmod:' + esc(d.id) + '" aria-label="Modifier">✏️</button>'
          + '<button class="da-btn" type="button" data-da="docarch:' + esc(d.id) + '" aria-label="' + (d.archive ? 'Désarchiver' : 'Archiver') + '">' + (d.archive ? '📤' : '📦') + '</button>'
          + '<button class="da-btn" type="button" data-da="suppr:' + esc(d.id) + '" aria-label="Supprimer">🗑️</button></span></div>';
      });
      h += finArchives + '</div>';
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
  // pole/i = rubrique d'origine ; salId/typeDefaut = pré-remplissage (depuis la fiche ou le coffre-fort)
  function vueAjoutDoc(pole, i, salId, typeDefaut, retour) {
    if (!encoreOuvert()) return;
    var r = rubrique(pole, i); if (!r) return vueMenu();
    var o = overlay();
    retour = retour || ('doc:' + pole + ':' + i);
    chargerSalariesSiBesoin().then(function (sal) {
      var optSal = '<option value="">— Aucun (document de la société) —</option>' + sal.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === salId ? ' selected' : '') + '>' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + (s.statut === 'ancien' ? ' (ancien)' : '') + '</option>'; }).join('');
      var types = pole === 'personnel' ? TYPES_PERSO.filter(function (t) { return t[1] === r[0]; }).map(function (t) { return t[0]; }) : [];
      if (pole === 'personnel' && !types.length) types = TYPES_PERSO.map(function (t) { return t[0]; });
      var optType = types.map(function (t) { return '<option' + (t === typeDefaut ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
      o.innerHTML = '<div class="da-wrap">' + entete(retour) + '<form class="da-form" id="daDoc">'
        + '<b style="font-size:17px">Ajouter : ' + esc(typeDefaut || r[0]) + '</b>'
        + '<label for="daf_fichier">Fichier (photo, PDF ou Word)<input id="daf_fichier" type="file" accept="image/*,application/pdf,.doc,.docx" required></label>'
        + (pole === 'personnel' ? '<label for="daf_type">Type de document<select id="daf_type">' + optType + '</select></label>' : '')
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
          msg.textContent = 'Envoi… 0 %';
          var sel = o.querySelector('#daf_sal'), ty = o.querySelector('#daf_type');
          return rpcAvecProgression('da_document_ajouter', { p_code: codeCompte(), p_pin: pinSession, p_d: {
            pole: pole, categorie: ty ? ty.value : r[0], titre: o.querySelector('#daf_titre').value.trim() || x.nom,
            salarie_id: sel && sel.value ? sel.value : null, date_doc: o.querySelector('#daf_date').value || null,
            nom_fichier: x.nom, type_mime: x.type, taille: Math.round(x.b64.length * 0.75), contenu: x.b64 } },
            function (pc) { msg.textContent = pc < 100 ? 'Envoi… ' + pc + ' %' : 'Enregistrement dans le coffre-fort…'; }).then(function (res) {
            if (!res || res.ok !== true) { msg.style.color = '#b91c1c'; msg.textContent = res && res.raison === 'fichier_trop_gros' ? 'Fichier trop gros (6 Mo maximum).' : messageRefus(res); return; }
            cacheDocs = null;
            allerA(retour); synchroApp();
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
      var o = overlay(), retour = docCourant ? 'doc:' + docCourant.pole + ':' + docCourant.i : 'coffre';
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
      cacheDocs = null;
      if (docCourant) vueDocs(docCourant.pole, docCourant.i); else vueCoffre();
      synchroApp();
    });
  }

  // ── Lien avec le module Documents de l'app (coffre de l'appareil, Pack DDPP) ──
  // Un même document ne se saisit qu'une fois : ajouté ici, il est copié dans le module
  // Documents ; ajouté là-bas, il est copié ici (à l'ouverture du dossier, car il faut le code).
  var CAT_DEPUIS_APP = {
    cerfa: ['declarations', 'Déclaration d\'activité (DDPP)'], pms: ['declarations', 'Plan de maîtrise sanitaire (PMS)'],
    contrat_nuisibles: ['declarations', 'Contrats nuisibles et biodéchets'], contrat_biodechets: ['declarations', 'Contrats nuisibles et biodéchets'],
    formation: ['personnel', 'Formation hygiène'], medical: ['personnel', 'Visite médicale']
  };
  function cleApp(d) {
    if (d.pole === 'declarations' && d.categorie === 'Contrats nuisibles et biodéchets')
      return /biod|dechet/.test(sansAccent((d.titre || '') + ' ' + (d.nom_fichier || ''))) ? 'contrat_biodechets' : 'contrat_nuisibles';
    for (var k in CAT_DEPUIS_APP) if (CAT_DEPUIS_APP[k][0] === d.pole && CAT_DEPUIS_APP[k][1] === d.categorie) return k;
    return '';
  }
  function coffreApp() { try { var c = window.coffreDB; return c && c.docs ? c : null; } catch (e) { return null; } }
  function b64De(dataUrl) { var s = String(dataUrl || ''); var i = s.indexOf(','); return i > -1 ? s.slice(i + 1) : s; }
  function ignoresApp() { try { return JSON.parse(localStorage.getItem('haccp_da_ignores') || '[]'); } catch (e) { return []; } }
  var synchroEnCours = false;
  function synchroApp() {
    var db = coffreApp(); if (!db || synchroEnCours || !pinSession) return Promise.resolve();
    synchroEnCours = true;
    var change = false, ignores = ignoresApp();
    cacheDocs = null;
    return Promise.all([chargerSalariesSiBesoin(), chargerDocs(), Promise.resolve(db.docs.toArray())]).then(function (res) {
      var serveur = res[1] || [], local = res[2] || [], parId = {}, taches = [];
      serveur.forEach(function (d) { parId[d.id] = d; });
      // 1) Supprimé du dossier → retiré du module Documents
      local.forEach(function (f) { if (f.daId && !parId[f.daId]) taches.push(function () { change = true; return db.docs.delete(f.id); }); });
      // 2) Dossier → module Documents
      serveur.forEach(function (d) {
        var cle = cleApp(d); if (!cle || d.archive || ignores.indexOf(d.id) > -1) return;
        if (local.some(function (f) { return f.daId === d.id; })) return;
        var jumeau = local.filter(function (f) { return !f.daId && f.cle === cle && (f.nom === d.nom_fichier || Math.round(b64De(f.base64).length * 0.75) === +d.taille); })[0];
        if (jumeau) { jumeau.daId = d.id; taches.push(function () { return db.docs.update(jumeau.id, { daId: d.id }); }); return; }
        taches.push(function () {
          return rpc('da_document_lire', { p_code: codeCompte(), p_pin: pinSession, p_id: d.id }).then(function (r) {
            if (!r || r.ok !== true || !r.contenu) return;
            var mime = r.type_mime || 'application/octet-stream'; change = true;
            return db.docs.add({ cle: cle, nom: r.nom_fichier || d.titre || 'Document', mime: mime, base64: 'data:' + mime + ';base64,' + r.contenu, createdAt: new Date().toISOString(), daId: d.id });
          });
        });
      });
      // 3) Module Documents → dossier
      local.forEach(function (f) {
        var cat = CAT_DEPUIS_APP[f.cle]; if (!cat || f.daId) return;
        var b64 = b64De(f.base64); if (!b64 || b64.length > 9000000) return;
        var sal = cat[0] === 'personnel' ? devinerSalarie(f.nom || '') : null;
        taches.push(function () {
          return rpc('da_document_ajouter', { p_code: codeCompte(), p_pin: pinSession, p_d: {
            pole: cat[0], categorie: cat[1], titre: String(f.nom || 'Document').replace(/\.[^.]+$/, ''), salarie_id: sal ? sal.id : null,
            date_doc: f.createdAt ? String(f.createdAt).slice(0, 10) : null, nom_fichier: f.nom || 'document', type_mime: f.mime || 'application/octet-stream',
            taille: Math.round(b64.length * 0.75), contenu: b64 } }).then(function (r) {
            if (r && r.ok && r.id) { cacheDocs = null; return db.docs.update(f.id, { daId: r.id }); }
          });
        });
      });
      return taches.reduce(function (p, t) { return p.then(function () { if (pinSession) return t(); }).catch(function () {}); }, Promise.resolve());
    }).catch(function () {}).then(function () {
      synchroEnCours = false;
      if (change) { try { if (typeof window.renderCoffre === 'function') window.renderCoffre(); if (typeof window.renderInspDocs === 'function') window.renderInspDocs(); } catch (e) {} }
    });
  }

  // ── Archiver / supprimer un salarié ──
  function archiverSalarie(id) {
    if (!encoreOuvert()) return;
    var s = (cacheSalaries || []).filter(function (x) { return x.id === id; })[0]; if (!s) return vueSalaries();
    var data = JSON.parse(JSON.stringify(s));
    if (s.statut === 'ancien') { data.statut = 'actif'; data.date_sortie = null; }
    else {
      var d = prompt('Date de sortie du salarié (JJ/MM/AAAA) :', new Date().toLocaleDateString('fr-FR'));
      if (d === null) return;
      var m = String(d).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) { alert('Date non reconnue. Exemple : 30/11/2026'); return; }
      data.statut = 'ancien'; data.date_sortie = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    }
    rpc('da_enregistrer_salarie', { p_code: codeCompte(), p_pin: pinSession, p_s: data }).then(function (r) {
      if (!r || r.ok !== true) { alert(messageRefus(r)); return; }
      cacheSalaries = null; vueSalaries();
    });
  }
  function supprimerSalarie(id, btn) {
    if (!encoreOuvert()) return;
    if (btn.getAttribute('data-confirme') !== '1') { btn.setAttribute('data-confirme', '1'); btn.textContent = 'Effacer aussi ses documents ? Toucher pour confirmer'; return; }
    rpc('da_supprimer_salarie', { p_code: codeCompte(), p_pin: pinSession, p_id: id }).then(function (r) {
      if (!r || r.ok !== true) { alert(messageRefus(r)); return; }
      cacheSalaries = null; cacheDocs = null; vueSalaries();
    });
  }
  function archiverDocument(id) {
    if (!encoreOuvert()) return;
    var d = (cacheDocs || []).filter(function (x) { return x.id === id; })[0]; if (!d) return;
    rpc('da_document_modifier', { p_code: codeCompte(), p_pin: pinSession, p_id: id, p_d: { archive: !d.archive } }).then(function (r) {
      if (!r || r.ok !== true) { alert(messageRefus(r)); return; }
      cacheDocs = null;
      if (docCourant) vueDocs(docCourant.pole, docCourant.i); else vueCoffre();
    });
  }
  // ── Modifier un document (titre, type, salarié, date) ──
  function vueDocModifier(id) {
    if (!encoreOuvert()) return;
    var retour = docCourant ? 'doc:' + docCourant.pole + ':' + docCourant.i : 'coffre';
    chargerDocs().then(function (docs) {
      var d = docs.filter(function (x) { return x.id === id; })[0]; if (!d) return allerA(retour);
      return chargerSalariesSiBesoin().then(function (sal) {
        var o = overlay(), cats = toutesCategories(), val = d.pole + '|' + d.categorie;
        var optSal = '<option value="">— Société (aucun salarié) —</option>' + sal.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === d.salarie_id ? ' selected' : '') + '>' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + '</option>'; }).join('');
        o.innerHTML = '<div class="da-wrap">' + entete(retour) + '<form class="da-form" id="dadm"><b style="font-size:17px">Modifier le document</b>'
          + '<label for="dadm_t">Titre<input id="dadm_t" value="' + esc(d.titre || '') + '"></label>'
          + '<label for="dadm_c">Type<select id="dadm_c">' + cats.map(function (c) { var v = c[0] + '|' + c[1]; return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(c[2]) + '</option>'; }).join('') + '</select></label>'
          + '<label for="dadm_s">Salarié<select id="dadm_s">' + optSal + '</select></label>'
          + '<label for="dadm_d">Date du document<input id="dadm_d" type="date" value="' + esc(d.date_doc ? String(d.date_doc).slice(0, 10) : '') + '"></label>'
          + '<p class="da-err" id="dadmMsg"></p><button class="da-main" type="submit">💾 Enregistrer</button></form></div>';
        brancher(o); o.scrollTop = 0;
        o.querySelector('#dadm').addEventListener('submit', function (e) {
          e.preventDefault(); if (!encoreOuvert()) return;
          var cv = o.querySelector('#dadm_c').value.split('|'), sv = o.querySelector('#dadm_s').value;
          rpc('da_document_modifier', { p_code: codeCompte(), p_pin: pinSession, p_id: id, p_d: {
            titre: o.querySelector('#dadm_t').value.trim(), pole: cv[0], categorie: cv[1], salarie_id: cv[0] === 'personnel' && sv ? sv : null,
            date_doc: o.querySelector('#dadm_d').value || null } }).then(function (r) {
            if (!r || r.ok !== true) { o.querySelector('#dadmMsg').textContent = messageRefus(r); return; }
            cacheDocs = null; allerA(retour);
          });
        });
      });
    });
  }

  // ── Types de documents du personnel (rangés dans les rubriques du pôle) ──
  var TYPES_PERSO = [
    ['Contrat de travail', 'Embauche'], ['Avenant', 'Embauche'], ['Déclaration d\'embauche (DPAE)', 'Embauche'],
    ['Pièce d\'identité', 'Embauche'], ['Titre de séjour', 'Embauche'], ['Autorisation de travail', 'Embauche'],
    ['Carte Vitale', 'Embauche'], ['Bulletin de paie', 'Paie'], ['Visite médicale', 'Santé et formation'],
    ['Formation hygiène', 'Santé et formation'], ['Registre du personnel', 'Registre unique du personnel'], ['Autre document', 'Embauche']
  ];
  // Documents attendus pour chaque salarié (« Pièce d'identité » OU « Titre de séjour » suffit)
  var OBLIG_PERSO = [['Contrat de travail'], ['Déclaration d\'embauche (DPAE)'], ['Pièce d\'identité', 'Titre de séjour'], ['Bulletin de paie'], ['Visite médicale'], ['Formation hygiène']];
  // Documents attendus pour la société : [pôle, rubrique]
  var OBLIG_SOC = [['associes', 'Statuts'], ['associes', 'Président'], ['associes', 'Annonce légale'], ['associes', 'Kbis'],
    ['declarations', 'Déclaration d\'activité (DDPP)'], ['declarations', 'Plan de maîtrise sanitaire (PMS)'], ['declarations', 'Convention collective HCR'],
    ['declarations', 'URSSAF'], ['declarations', 'Assurances'], ['declarations', 'Médecine du travail']];
  function typeIndex(nom) { for (var k = 0; k < TYPES_PERSO.length; k++) if (TYPES_PERSO[k][0] === nom) return k; return TYPES_PERSO.length - 1; }
  function rubIndex(pole, titre) { var p = POLES.filter(function (x) { return x.id === pole; })[0]; if (!p) return 0; for (var k = 0; k < p.rub.length; k++) if (p.rub[k][0] === titre) return k; return 0; }
  function docDansRubrique(d, pole, titre) {
    if (d.pole !== pole) return false;
    if (d.categorie === titre) return true;
    return pole === 'personnel' && TYPES_PERSO.some(function (t) { return t[0] === d.categorie && t[1] === titre; });
  }
  function chargerDocs() {
    if (cacheDocs) return Promise.resolve(cacheDocs);
    return rpc('da_documents_liste', { p_code: codeCompte(), p_pin: pinSession }).then(function (r) {
      if (!r || r.ok !== true) throw new Error(messageRefus(r));
      cacheDocs = r.documents || []; return cacheDocs;
    });
  }
  function ligneDoc(d) {
    return '<div class="da-rub"><span><b>' + esc(d.titre || d.nom_fichier || 'Document') + '</b><small>' + esc([d.categorie, d.date_doc ? dateFr(d.date_doc) : '', taille(d.taille)].filter(Boolean).join(' · ')) + '</small></span>'
      + '<span style="display:flex;gap:6px"><button class="da-btn" type="button" data-da="voir:' + esc(d.id) + '">Voir</button><button class="da-btn" type="button" data-da="docmod:' + esc(d.id) + '" aria-label="Modifier">✏️</button><button class="da-btn" type="button" data-da="docarch:' + esc(d.id) + '" aria-label="' + (d.archive ? 'Désarchiver' : 'Archiver') + '">' + (d.archive ? '📤' : '📦') + '</button><button class="da-btn" type="button" data-da="suppr:' + esc(d.id) + '" aria-label="Supprimer">🗑️</button></span></div>';
  }
  // Coffre-fort d'un salarié : documents attendus ✓/✗ + documents rangés. suffixe 'c' = retour au coffre-fort
  function blocCoffreSalarie(s, suffixe) {
    var docs = (cacheDocs || []).filter(function (d) { return d.salarie_id === s.id && !d.archive; });
    var h = '<div class="da-form" style="gap:6px">';
    OBLIG_PERSO.forEach(function (types) {
      var ok = docs.some(function (d) { return types.indexOf(d.categorie) > -1; });
      h += '<div class="da-rub" style="border:none;padding:6px 2px;border-bottom:1px solid #eef0f6;border-radius:0"><span>' + esc(types.join(' ou ')) + '</span>'
        + (ok ? '<span class="da-go" style="background:#e8f6ed;color:#15803d">✓ reçu</span>'
              : '<button class="da-btn" type="button" data-da="ajoutsal:' + esc(s.id) + ':' + typeIndex(types[0]) + (suffixe ? ':' + suffixe : '') + '" style="color:#b45309">＋ Ajouter</button>') + '</div>';
    });
    h += '</div>';
    if (docs.length) h += docs.map(ligneDoc).join('');
    h += '<button class="da-btn" type="button" data-da="ajoutsal:' + esc(s.id) + ':' + typeIndex('Autre document') + (suffixe ? ':' + suffixe : '') + '">＋ Autre document pour ce salarié</button>';
    return h;
  }
  function vueCoffre() {
    if (!encoreOuvert()) return;
    docCourant = null;
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('menu') + '<p class="da-note">Chargement…</p></div>'; brancher(o);
    cacheDocs = null;
    chargerSalariesSiBesoin().then(chargerDocs).then(function () {
      var h = '<div class="da-wrap">' + entete('menu')
        + '<div class="da-item" style="cursor:default"><span class="i">🗄️</span><span><b>Coffre-fort</b><small>✓ reçu · ＋ à ajouter</small></span></div>'
        + '<button class="da-main" type="button" data-da="import">📥 Importer plusieurs documents</button>'
        + '<p class="da-note">Un document n\'est enregistré qu\'une fois : ajouté ici, dans son pôle ou dans la fiche du salarié, il apparaît partout. Déclaration d\'activité, PMS, contrats nuisibles/biodéchets, formations et visites médicales sont aussi copiés dans le module Documents de l\'app (Pack DDPP), et inversement.</p>';
      // Société : TOUTES les rubriques des pôles Associés et Déclarations (les mêmes documents que dans ces pôles)
      [['associes', '🏛️ Dossier des associés'], ['declarations', '📋 Déclarations et obligations']].forEach(function (pp) {
        var pole = POLES.filter(function (x) { return x.id === pp[0]; })[0];
        h += '<details class="da-form" open><summary style="cursor:pointer;font-weight:800">' + pp[1] + '</summary>';
        pole.rub.forEach(function (r, i) {
          var n = (cacheDocs || []).filter(function (d) { return d.pole === pp[0] && d.categorie === r[0] && !d.archive; }).length;
          var oblig = OBLIG_SOC.some(function (x) { return x[0] === pp[0] && x[1] === r[0]; });
          h += '<div class="da-rub" style="border:none;padding:6px 2px;border-bottom:1px solid #eef0f6;border-radius:0"><span>' + esc(r[0]) + (oblig ? ' <small style="display:inline;color:#b45309">· obligatoire</small>' : '') + '</span>'
            + (n ? '<button class="da-btn" type="button" data-da="doc:' + pp[0] + ':' + i + '" style="color:#15803d">✓ ' + n + ' document' + (n > 1 ? 's' : '') + '</button>'
                 : '<button class="da-btn" type="button" data-da="ajoutsoc:' + pp[0] + ':' + i + '" style="color:' + (oblig ? '#b45309' : '#5b5e78') + '">＋ Ajouter</button>') + '</div>';
        });
        h += '</details>';
      });
      var actifs = (cacheSalaries || []).filter(function (s) { return s.statut !== 'ancien'; });
      h += '<div class="da-sect">👥 Salariés en activité · ' + actifs.length + '</div>';
      actifs.forEach(function (s) {
        var docs = (cacheDocs || []).filter(function (d) { return d.salarie_id === s.id && !d.archive; });
        var manque = OBLIG_PERSO.filter(function (types) { return !docs.some(function (d) { return types.indexOf(d.categorie) > -1; }); }).length;
        h += '<details class="da-form"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px;font-weight:800"><span>' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + '</span>'
          + (manque ? '<span class="da-warn" style="margin:0">' + manque + ' manquant' + (manque > 1 ? 's' : '') + '</span>' : '<span class="da-go" style="background:#e8f6ed;color:#15803d">complet</span>') + '</summary>'
          + blocCoffreSalarie(s, 'c') + '</details>';
      });
      h += '</div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
    }).catch(function (e) { o.innerHTML = '<div class="da-wrap">' + entete('menu') + '<p class="da-err">' + esc(e && e.message ? e.message : 'Coffre-fort indisponible.') + '</p></div>'; brancher(o); });
  }

  // ── Import groupé : l'app devine le salarié et le type d'après le nom du fichier ──
  function sansAccent(t) { t = String(t || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z0-9]+/g, ' '); }
  function devinerSalarie(nomFichier) {
    var n = ' ' + sansAccent(nomFichier) + ' ', meilleur = null, score = 0;
    (cacheSalaries || []).forEach(function (s) {
      var sc = 0;
      sansAccent(s.nom).split(' ').filter(function (w) { return w.length > 2; }).forEach(function (w) { if (n.indexOf(' ' + w + ' ') > -1) sc += 2; });
      sansAccent(s.prenom).split(' ').filter(function (w) { return w.length > 2; }).forEach(function (w) { if (n.indexOf(' ' + w + ' ') > -1) sc += 1; });
      if (sc > score) { score = sc; meilleur = s; }
    });
    return meilleur;
  }
  // Renvoie [pôle, catégorie]
  function devinerType(nomFichier) {
    var n = ' ' + sansAccent(nomFichier) + ' ';
    var R = [
      [/ (dpae|due) |declaration prealable|embauche/, 'personnel', 'Déclaration d\'embauche (DPAE)'],
      [/avenant/, 'personnel', 'Avenant'],
      [/contrat (cdi|cdd|de travail)|contratcdi|contratcdd| cdi | cdd /, 'personnel', 'Contrat de travail'],
      [/sejour|resident/, 'personnel', 'Titre de séjour'],
      [/autorisation de travail|autorisation travail/, 'personnel', 'Autorisation de travail'],
      [/vitale/, 'personnel', 'Carte Vitale'],
      [/ cni |identite|passeport/, 'personnel', 'Pièce d\'identité'],
      [/bulletin|fiche de paye|fiche de paie| paie /, 'personnel', 'Bulletin de paie'],
      [/visite medicale|medecine du travail|aptitude/, 'personnel', 'Visite médicale'],
      [/formation|hygiene alimentaire/, 'personnel', 'Formation hygiène'],
      [/statut/, 'associes', 'Statuts'],
      [/ pv |proces verbal|assemblee/, 'associes', 'Procès-verbaux d\'assemblée'],
      [/president|demission/, 'associes', 'Président'],
      [/annonce legale|parution/, 'associes', 'Annonce légale'],
      [/kbis/, 'associes', 'Kbis'],
      [/ inpi /, 'associes', 'Formalités INPI'],
      [/pouvoir/, 'associes', 'Pouvoirs et pièces d\'identité des dirigeants'],
      [/recepisse|cerfa|13984|declaration d activite/, 'declarations', 'Déclaration d\'activité (DDPP)'],
      [/ pms |maitrise sanitaire/, 'declarations', 'Plan de maîtrise sanitaire (PMS)'],
      [/convention collective|hcr|32604703/, 'declarations', 'Convention collective HCR'],
      [/urssaf|vigilance/, 'declarations', 'URSSAF'],
      [/assurance/, 'declarations', 'Assurances'],
      [/ bail /, 'declarations', 'Bail commercial'],
      [/licence|permis d exploitation/, 'declarations', 'Licence et permis d\'exploitation'],
      [/nuisible|deratisation|biodechet/, 'declarations', 'Contrats nuisibles et biodéchets']
    ];
    for (var k = 0; k < R.length; k++) if (R[k][0].test(n)) return [R[k][1], R[k][2]];
    return ['personnel', 'Autre document'];
  }
  function toutesCategories() {
    var l = TYPES_PERSO.map(function (t) { return ['personnel', t[0], 'Personnel · ' + t[0]]; });
    ['associes', 'declarations'].forEach(function (pid) {
      var p = POLES.filter(function (x) { return x.id === pid; })[0];
      p.rub.forEach(function (r) { l.push([pid, r[0], (pid === 'associes' ? 'Associés · ' : 'Déclarations · ') + r[0]]); });
    });
    return l;
  }
  function vueImport() {
    if (!encoreOuvert()) return;
    var o = overlay();
    chargerSalariesSiBesoin().then(function () {
      o.innerHTML = '<div class="da-wrap">' + entete('menu')
        + '<div class="da-form"><b style="font-size:17px">📥 Importer des documents</b>'
        + '<p class="da-note">Choisissez plusieurs fichiers d\'un coup (photos, PDF, Word). L\'app propose le salarié et le type d\'après le nom de chaque fichier : vérifiez, corrigez si besoin, puis importez.</p>'
        + '<label for="dai_fichiers">Fichiers<input id="dai_fichiers" type="file" multiple accept="image/*,application/pdf,.doc,.docx"></label></div>'
        + '<div id="daiListe"></div></div>';
      brancher(o); o.scrollTop = 0;
      var cats = toutesCategories();
      var optSal = '<option value="">— Société (aucun salarié) —</option>' + (cacheSalaries || []).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + '</option>'; }).join('');
      o.querySelector('#dai_fichiers').addEventListener('change', function () {
        var files = Array.prototype.slice.call(this.files || []);
        var liste = o.querySelector('#daiListe');
        if (!files.length) { liste.innerHTML = ''; return; }
        var h = '';
        files.forEach(function (f, k) {
          var s = devinerSalarie(f.name), t = devinerType(f.name), val = t[0] + '|' + t[1];
          h += '<div class="da-form" data-k="' + k + '"><b style="font-size:14px;overflow-wrap:anywhere">' + esc(f.name) + '</b>'
            + '<label>Type<select class="dai-type">' + cats.map(function (c) { var v = c[0] + '|' + c[1]; return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(c[2]) + '</option>'; }).join('') + '</select></label>'
            + '<label>Salarié<select class="dai-sal">' + optSal.replace('value="' + esc(s && t[0] === 'personnel' ? s.id : '') + '"', 'value="' + esc(s && t[0] === 'personnel' ? s.id : '') + '" selected') + '</select></label>'
            + '<span class="da-note dai-etat"></span></div>';
        });
        h += '<button class="da-main" type="button" id="daiGo">📥 Importer ' + files.length + ' document' + (files.length > 1 ? 's' : '') + '</button><p class="da-err" id="daiMsg"></p>';
        liste.innerHTML = h;
        liste.querySelector('#daiGo').addEventListener('click', function () {
          var btn = this;
          if (btn.getAttribute('data-fini') === '1') { vueCoffre(); return; }
          btn.disabled = true;
          var ok = 0, ko = 0, msg = liste.querySelector('#daiMsg');
          files.reduce(function (p, f, k) {
            return p.then(function () {
              if (!encoreOuvert()) throw new Error('verrou');
              var bloc = liste.querySelector('[data-k="' + k + '"]'), etat = bloc.querySelector('.dai-etat');
              var tv = bloc.querySelector('.dai-type').value.split('|'), sv = bloc.querySelector('.dai-sal').value;
              etat.textContent = 'Envoi…';
              return lireFichier(f).then(function (x) {
                if (x.b64.length > 9000000) { ko++; etat.textContent = '✗ trop gros (6 Mo max)'; return; }
                return rpcAvecProgression('da_document_ajouter', { p_code: codeCompte(), p_pin: pinSession, p_d: {
                  pole: tv[0], categorie: tv[1], titre: f.name.replace(/\.[^.]+$/, ''), salarie_id: tv[0] === 'personnel' && sv ? sv : null,
                  nom_fichier: x.nom, type_mime: x.type, taille: Math.round(x.b64.length * 0.75), contenu: x.b64 } },
                  function (pc) { etat.textContent = pc < 100 ? 'Envoi… ' + pc + ' %' : 'Enregistrement…'; }).then(function (r) {
                  if (r && r.ok) { ok++; etat.style.color = '#15803d'; etat.textContent = '✓ importé'; }
                  else { ko++; etat.style.color = '#b91c1c'; etat.textContent = '✗ ' + messageRefus(r); }
                });
              }).catch(function () { ko++; etat.style.color = '#b91c1c'; etat.textContent = '✗ envoi impossible'; });
            });
          }, Promise.resolve()).then(function () {
            cacheDocs = null;
            msg.style.color = ko ? '#b91c1c' : '#15803d';
            msg.textContent = ok + ' importé' + (ok > 1 ? 's' : '') + (ko ? ', ' + ko + ' en erreur' : '') + '. Voir le coffre-fort.';
            btn.textContent = '🗄️ Ouvrir le coffre-fort'; btn.disabled = false; btn.setAttribute('data-fini', '1');
            synchroApp();
          }).catch(function () { msg.textContent = 'Import interrompu (dossier verrouillé).'; });
        });
      });
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

  // ══════════════════════════════════════════════════════════════════
  // PROCÉDURES : rappel à l'ordre, mise en garde, avertissement, blâme
  // (lettre à signer) ; mise à pied et licenciement (convocation à
  // l'entretien préalable avec calcul automatique des délais).
  // Repris de la maquette validée. Enregistré dans da_procedures.
  // ══════════════════════════════════════════════════════════════════
  var TYPES_PROC = {
    rappel: { titre: "Rappel à l'ordre", lourd: false,
      fin: "Le présent courrier constitue un simple rappel à l'ordre. Il n'a pas le caractère d'une sanction disciplinaire.",
      note: "Un rappel à l'ordre écrit doit rester neutre : formulé comme un reproche avec menace, un juge peut le requalifier en sanction." },
    garde: { titre: "Mise en garde", lourd: false,
      fin: "Nous vous mettons en garde : si ces faits se reproduisaient, nous pourrions être amenés à envisager une sanction disciplinaire.",
      note: "Une mise en garde écrite peut être considérée comme une sanction par un juge. Texte à faire relire." },
    avert: { titre: "Avertissement", lourd: false,
      fin: "En conséquence, nous vous notifions par la présente un avertissement. Cette sanction sera versée à votre dossier personnel.",
      note: "Sanction disciplinaire : à notifier dans les 2 mois après les faits, par écrit et motivée." },
    blame: { titre: "Blâme", lourd: false,
      fin: "En conséquence, nous vous notifions par la présente un blâme. Cette sanction sera versée à votre dossier personnel.",
      note: "Sanction disciplinaire : à notifier dans les 2 mois après les faits, par écrit et motivée." },
    map: { titre: "Mise à pied", lourd: true },
    licen: { titre: "Licenciement", lourd: true }
  };
  var REGLES = [
    { g:"Nettoyage et désinfection", h:1, l:[
      ["Sol non nettoyé","le nettoyage des sols de la cuisine et des zones de préparation"],
      ["Plan de travail non nettoyé ou non désinfecté","le nettoyage et la désinfection des plans de travail après chaque utilisation"],
      ["Couteaux ou ustensiles non nettoyés","le nettoyage et la désinfection des couteaux et ustensiles après chaque usage"],
      ["Planches à découper sales ou mal utilisées","l'utilisation de planches à découper propres et réservées à chaque type de produit"],
      ["Trancheuse, robot ou hachoir non nettoyé","le démontage et le nettoyage du matériel de préparation après chaque usage"],
      ["Réfrigérateur ou chambre froide sale","le nettoyage régulier des réfrigérateurs et chambres froides"],
      ["Four, plaque, hotte ou friteuse sale","le nettoyage des équipements de cuisson"],
      ["Vaisselle mal lavée","le lavage correct de la vaisselle et des contenants"],
      ["Éponges ou torchons sales","l'utilisation de lavettes propres ou d'essuie-tout à usage unique"],
      ["Poubelles non vidées ou sales","la vidange et le nettoyage des poubelles"],
      ["Produits d'entretien près des aliments","le rangement des produits d'entretien à l'écart des denrées alimentaires"],
      ["Plan de nettoyage non rempli","l'enregistrement des nettoyages réalisés dans le plan de nettoyage"],
      ["Lave-mains encombré ou sans savon","le maintien du lave-mains dégagé et approvisionné (savon, essuie-mains)"]
    ]},
    { g:"Températures et chaîne du froid", h:1, l:[
      ["Température du frigo non respectée","le maintien des denrées réfrigérées entre 0 et +4 °C"],
      ["Relevé des températures non fait","le relevé des températures des enceintes froides à l'ouverture et à la fermeture"],
      ["Porte du frigo ou de la chambre froide laissée ouverte","la fermeture des portes des réfrigérateurs et chambres froides"],
      ["Produit laissé à température ambiante","la remise immédiate au froid des denrées périssables"],
      ["Livraison rangée trop tard","le rangement immédiat des livraisons au froid"],
      ["Décongélation à l'air libre","la décongélation des produits au réfrigérateur"],
      ["Produit décongelé recongelé","l'interdiction de recongeler un produit décongelé"],
      ["Surgelés au-dessus de −18 °C","la conservation des surgelés à −18 °C ou moins"],
      ["Plat chaud sous +63 °C","le maintien des plats chauds à +63 °C minimum jusqu'au service"],
      ["Refroidissement rapide non respecté","le refroidissement rapide des préparations, de +63 °C à moins de +10 °C en moins de 2 heures"],
      ["Température à cœur non vérifiée","la vérification de la température à cœur lors des cuissons"],
      ["Remise en température non conforme","la remise en température des plats à +63 °C en moins d'une heure"]
    ]},
    { g:"Réception et stockage", h:1, l:[
      ["Livraison non contrôlée","le contrôle des livraisons à la réception (température, emballage, date limite)"],
      ["Produit non conforme accepté","le refus des produits non conformes à la réception"],
      ["Produits posés au sol","le stockage des denrées sur des étagères, jamais au sol"],
      ["Cartons dans la chambre froide","le retrait des cartons d'emballage avant stockage en chambre froide"],
      ["Cru et cuit mélangés dans le frigo","la séparation des produits crus et des produits cuits dans le stockage"],
      ["Aliments non protégés (sans film ni couvercle)","la protection des denrées stockées par un film ou un contenant fermé"],
      ["Ordre des stocks non respecté","la rotation des stocks : les produits les plus anciens sont utilisés en premier"],
      ["Réserve sèche mal rangée","le rangement propre et ordonné de la réserve sèche"]
    ]},
    { g:"Étiquetage et traçabilité", h:1, l:[
      ["Préparation non étiquetée","l'étiquetage des préparations (nom, date de fabrication, date limite)"],
      ["Produit ouvert sans date d'ouverture","l'indication de la date d'ouverture sur les produits entamés"],
      ["Produit périmé (DLC dépassée) conservé ou utilisé","le retrait immédiat des produits dont la date limite est dépassée"],
      ["Étiquettes ou bons de livraison jetés","la conservation des étiquettes et des bons de livraison pour la traçabilité"],
      ["Plat témoin non réalisé","la réalisation et la conservation des plats témoins"],
      ["Consignes sur les allergènes non respectées","le respect des consignes relatives aux allergènes"]
    ]},
    { g:"Hygiène du personnel", h:1, l:[
      ["Pas de coiffe ou de charlotte","le port d'une coiffe couvrant entièrement les cheveux"],
      ["Tenue sale ou incomplète","le port d'une tenue de travail propre et complète"],
      ["Port de bijoux ou de montre","l'interdiction du port de bijoux et de montre en zone de préparation"],
      ["Mains non lavées","le lavage des mains à la prise de poste, entre deux tâches et après chaque passage aux toilettes"],
      ["Ongles longs ou vernis","des ongles courts, propres et sans vernis"],
      ["Plaie non protégée","la protection de toute plaie par un pansement étanche et un gant"],
      ["Gants non changés","le changement des gants entre deux tâches"],
      ["Téléphone en cuisine","l'interdiction d'utiliser son téléphone en zone de préparation"],
      ["Manger, boire ou fumer en cuisine","l'interdiction de manger, boire ou fumer en zone de préparation"],
      ["Maladie non signalée","le signalement de tout symptôme (diarrhée, vomissements, fièvre) avant la prise de poste"],
      ["Chaussures de travail non portées","le port de chaussures de travail adaptées"]
    ]},
    { g:"Préparation et cuisson", h:1, l:[
      ["Contamination entre cru et cuit","la séparation des produits crus et cuits pendant les préparations"],
      ["Fruits et légumes non lavés","le lavage des fruits et légumes avant utilisation"],
      ["Huile de friture non contrôlée ou non changée","le contrôle et le changement de l'huile de friture"],
      ["Restes déjà servis réutilisés","l'interdiction de réutiliser des aliments déjà servis à un client"],
      ["Préparation aux œufs crus gardée trop longtemps","la consommation dans la journée des préparations à base d'œufs crus"],
      ["Contrôle non enregistré dans Nomos","l'enregistrement des contrôles d'hygiène dans l'application Nomos"]
    ]},
    { g:"Locaux, déchets et nuisibles", h:1, l:[
      ["Porte ou fenêtre laissée ouverte","la fermeture des portes et fenêtres donnant sur l'extérieur"],
      ["Trace de nuisibles non signalée","le signalement immédiat de toute trace de nuisibles"],
      ["Déchets non évacués","l'évacuation des déchets en fin de service"],
      ["Biodéchets non triés","le tri des biodéchets"]
    ]},
    { g:"Horaires et présence", h:0, l:[
      ["Retard","le respect des horaires de travail"],
      ["Retards répétés","le respect des horaires de travail, sans retard répété"],
      ["Absence non justifiée","la justification de toute absence dans les 48 heures"],
      ["Abandon de poste","la présence à son poste pendant toute la durée du service"],
      ["Départ avant la fin du service sans autorisation","l'accord préalable de la direction pour tout départ anticipé"],
      ["Pause dépassée ou prise sans accord","le respect des horaires et de la durée des pauses"],
      ["Arrêt maladie non transmis à temps","l'envoi de l'arrêt de travail à l'employeur dans les 48 heures"],
      ["Heures déclarées fausses (pointage)","la déclaration exacte des heures travaillées"]
    ]},
    { g:"Obéissance et consignes", h:0, l:[
      ["Insubordination (refus d'obéir)","l'exécution des tâches et des consignes données par la direction"],
      ["Refus d'exécuter une tâche de son poste","l'exécution des tâches prévues par son contrat de travail"],
      ["Non-respect du règlement intérieur","le respect du règlement intérieur de l'établissement"],
      ["Travail mal fait ou négligé","l'exécution soignée et complète des tâches confiées"],
      ["Téléphone personnel pendant le service","l'interdiction d'utiliser son téléphone personnel pendant le service"],
      ["Consignes de fermeture non respectées (gaz, alarme, portes)","le respect des consignes de fermeture de l'établissement"],
      ["Informations de l'entreprise divulguées","la discrétion sur les informations internes de l'entreprise"],
      ["Dénigrement de l'entreprise (réseaux sociaux)","la loyauté envers l'entreprise, y compris sur les réseaux sociaux"]
    ]},
    { g:"Comportement", h:0, l:[
      ["Manque de respect envers un collègue","un comportement correct et respectueux envers ses collègues"],
      ["Manque de respect envers la direction","un comportement correct et respectueux envers la direction"],
      ["Manque de respect envers un client","un comportement courtois envers la clientèle"],
      ["Insultes ou propos grossiers","l'interdiction de tout propos injurieux ou grossier"],
      ["Menaces ou violence","l'interdiction de toute menace et de toute violence"],
      ["Propos ou gestes déplacés (harcèlement)","l'interdiction de tout propos ou geste constitutif de harcèlement"],
      ["Propos discriminatoires","l'interdiction de tout propos discriminatoire"],
      ["Dispute pendant le service","le maintien d'un climat de travail serein"],
      ["État d'ébriété ou alcool au travail","l'interdiction de consommer de l'alcool et de travailler en état d'ébriété"],
      ["Consommation de stupéfiants","l'interdiction de consommer ou de détenir des stupéfiants sur le lieu de travail"],
      ["Fumer ou vapoter dans les locaux","l'interdiction de fumer et de vapoter dans les locaux"]
    ]},
    { g:"Caisse, biens et matériel", h:0, l:[
      ["Erreur ou écart de caisse","le respect des procédures d'encaissement"],
      ["Encaissement non enregistré","l'enregistrement en caisse de toute vente"],
      ["Repas ou marchandises pris sans autorisation","l'interdiction de prendre ou de consommer des marchandises sans autorisation"],
      ["Vol ou détournement","le respect des biens et des fonds de l'entreprise"],
      ["Matériel dégradé ou cassé par négligence","le soin apporté au matériel de l'entreprise"],
      ["Gaspillage de marchandises","l'utilisation raisonnée des marchandises"]
    ]},
    { g:"Sécurité au travail", h:0, l:[
      ["Chaussures de sécurité non portées","le port des équipements de protection fournis (chaussures de sécurité)"],
      ["Consigne de sécurité non respectée","le respect des consignes de sécurité"],
      ["Issue de secours ou extincteur encombré","le dégagement permanent des issues de secours et des extincteurs"],
      ["Mauvaise utilisation des couteaux ou machines","l'utilisation prudente des couteaux et des machines"],
      ["Accident non signalé","le signalement immédiat de tout accident ou incident"]
    ]}
  ];
  // En-tête de la société : mémorisé sur l'appareil (données publiques de l'entreprise, pas de données salariés)
  function cleEntete() { return 'haccp_da_entete_' + codeCompte(); }
  function enteteSociete() {
    var e = {}; try { e = JSON.parse(localStorage.getItem(cleEntete()) || '{}') || {}; } catch (x) { e = {}; }
    var E = (typeof ETAB !== 'undefined' && ETAB) ? ETAB : {};
    var ville = e.ville || E.ville || '';
    var cormeilles = /cormeilles/i.test(ville + ' ' + (E.adresse || ''));
    return {
      nom: e.nom || E.nom || '', forme: e.forme || '', adresse: e.adresse || [E.adresse, [E.cp, E.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      ids: e.ids || (E.siret ? 'SIRET ' + E.siret : ''), tel: e.tel || E.tel || '', ville: ville, signataire: e.signataire || 'Le Président',
      mairie: e.mairie || (cormeilles ? 'mairie de Cormeilles-en-Parisis, 3 avenue Maurice Berteaux, 95240 Cormeilles-en-Parisis' : ''),
      inspection: e.inspection || (cormeilles ? 'inspection du travail du Val-d\'Oise (DDETS), Immeuble Atrium, 3 boulevard de l\'Oise, CS 20305, 95014 Cergy-Pontoise Cedex' : '')
    };
  }
  function memoriserEntete(e) { try { localStorage.setItem(cleEntete(), JSON.stringify(e)); } catch (x) {} }

  // Délais légaux en jours ouvrables (hors dimanches et jours fériés)
  function paques(y) { var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
  function iso(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function plus(dt, n) { var x = new Date(dt); x.setDate(x.getDate() + n); return x; }
  function feries(y) { var p = paques(y); return [y + '-01-01', iso(plus(p, 1)), y + '-05-01', y + '-05-08', iso(plus(p, 39)), iso(plus(p, 50)), y + '-07-14', y + '-08-15', y + '-11-01', y + '-11-11', y + '-12-25']; }
  function ouvrable(dt) { return dt.getDay() !== 0 && feries(dt.getFullYear()).indexOf(iso(dt)) < 0; }
  function apresOuvrables(dt, n) { var x = new Date(dt), c = 0; while (c < n) { x = plus(x, 1); if (ouvrable(x)) c++; } return x; }
  function parseD(v) { if (!v) return null; var p = String(v).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function jourLong(dt) { return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function delais(dateLettre, lrar, dateEnt) {
    var lettre = parseD(dateLettre); if (!lettre) return null;
    var remise = lrar ? apresOuvrables(lettre, 3) : lettre;          // 1re présentation estimée large
    var r = { remise: remise, minEnt: apresOuvrables(remise, 6), consEnt: apresOuvrables(remise, 8) };
    var ent = parseD(dateEnt);
    if (ent) { r.ent = ent; r.minLet = apresOuvrables(ent, 2); r.consLet = apresOuvrables(ent, 3); var mx = new Date(ent); mx.setMonth(mx.getMonth() + 1); r.maxLet = mx; }
    return r;
  }

  function lettreHTML(f, s) {
    var t = TYPES_PROC[f.type], soc = f.soc, civ = f.civ || 'Monsieur';
    function v(x) { return x ? '<span style="background:#fff3c4">' + esc(x) + '</span>' : '<span style="background:#fff3c4;color:#9a6b00;font-style:italic">à compléter</span>'; }
    var nomSal = ((s.prenom || '') + ' ' + (s.nom || '')).trim();
    var h = '<div style="font-family:Georgia,serif;font-size:13.5px;line-height:1.55;color:#111">'
      + '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px"><div><b>' + esc(soc.nom) + '</b><br>' + esc(soc.forme) + (soc.forme ? '<br>' : '') + esc(soc.adresse) + '<br>' + esc(soc.ids) + (soc.tel ? '<br>Tél. ' + esc(soc.tel) : '') + '</div>'
      + '<div style="text-align:right">' + esc(soc.ville || '') + ', le ' + v(dateFr(f.date_lettre)) + '</div></div>'
      + '<div style="margin:16px 0 0 auto;max-width:60%;min-width:180px">' + esc(civ) + ' ' + esc(nomSal) + '<br>' + v(s.adresse) + '</div>';
    var remise = f.remise === 'lrar' ? 'Lettre recommandée avec avis de réception' : 'Lettre remise en main propre contre décharge';
    if (!t.lourd) {
      h += '<p style="margin-top:16px;font-weight:600">Objet : ' + esc(t.titre) + '<br>' + remise + '</p><p>' + esc(civ) + ',</p>'
        + '<p>Le ' + v(dateFr(f.date_faits)) + (f.heure ? ' à ' + esc(f.heure) : '') + ', ' + v(f.lieu) + ', ' + v(f.faits) + '.</p>'
        + '<p>Nous vous rappelons que votre poste' + (s.poste ? ' de ' + esc(String(s.poste).toLowerCase()) : '') + ' impose ' + v(f.regle) + (f.hygiene ? ', conformément aux règles d\'hygiène applicables à notre établissement (plan de maîtrise sanitaire, méthode HACCP).' : '.') + '</p>'
        + '<p>Nous vous demandons de ' + v(f.demande) + '.</p><p>' + esc(t.fin) + '</p>';
    } else {
      var nature = f.type === 'map' ? 'une sanction disciplinaire pouvant aller jusqu\'à une mise à pied' : 'une mesure de licenciement';
      h += '<p style="margin-top:16px;font-weight:600">Objet : Convocation à un entretien préalable ' + (f.type === 'licen' ? 'à un éventuel licenciement' : 'à une éventuelle sanction') + (f.map_cons ? ', avec mise à pied conservatoire' : '') + '<br>' + remise + '</p>'
        + '<p>' + esc(civ) + ',</p><p>Nous sommes conduits à envisager à votre égard ' + nature + '.</p>'
        + (f.map_cons ? '<p>Compte tenu de la gravité des faits qui vous sont reprochés, nous vous notifions par la présente votre <b>mise à pied conservatoire</b>, à effet immédiat, dans l\'attente de la décision qui sera prise à l\'issue de la procédure. Pendant cette période, vous ne devez pas vous présenter à votre poste de travail. Cette mesure ne constitue pas une sanction.</p>' : '')
        + '<p>Avant toute décision, et conformément à l\'article ' + (f.type === 'map' ? 'L. 1332-2' : 'L. 1232-2') + ' du code du travail, nous vous convoquons à un entretien préalable qui se tiendra le ' + v(f.date_ent ? jourLong(parseD(f.date_ent)) : '') + ' à ' + v(f.heure_ent) + ', ' + v(f.lieu_ent) + '.</p>'
        + '<p>Au cours de cet entretien, nous vous indiquerons les motifs de la décision envisagée et nous recueillerons vos explications. Aucune décision n\'est prise à ce jour.</p>'
        + '<p>Vous pouvez vous faire assister, lors de cet entretien, par une personne de votre choix appartenant au personnel de l\'entreprise. L\'entreprise ne comportant pas d\'institution représentative du personnel, vous pouvez également vous faire assister par un conseiller du salarié choisi sur une liste dressée par l\'autorité administrative (article L. 1232-4 du code du travail). Cette liste est arrêtée par le préfet dans chaque département et tenue à la disposition des salariés dans chaque inspection du travail et dans chaque mairie. Vous pouvez notamment la consulter :</p>'
        + '<p>– à la ' + v(soc.mairie) + ' ;<br>– à l\'' + v(soc.inspection) + '.</p>'
        + '<p>Si vous étiez empêché, nous vous invitons à nous en informer sans délai ; votre absence à l\'entretien ne ferait pas obstacle à la poursuite de la procédure.</p>';
    }
    h += '<p>Nous vous prions d\'agréer, ' + esc(civ) + ', l\'expression de nos salutations distinguées.</p>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px;font-size:12px"><div style="border-top:1px solid #999;padding-top:6px;min-height:84px">Pour ' + esc(soc.nom) + ',<br>' + esc(soc.signataire) + '<br>Signature :</div>'
      + '<div style="border-top:1px solid #999;padding-top:6px;min-height:84px">' + esc(nomSal) + '<br>« Reçu en main propre le ............ »<br>Signature :</div></div></div>';
    return h;
  }
  function imprimer(html, titre) {
    try {
      var ifr = document.createElement('iframe'); ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(ifr);
      var w = ifr.contentWindow, d = w.document;
      d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(titre) + '</title><style>body{margin:16mm}</style></head><body>' + html + '</body></html>'); d.close();
      setTimeout(function () { try { w.focus(); w.print(); } catch (e) { window.print(); } setTimeout(function () { try { ifr.remove(); } catch (e) {} }, 2000); }, 300);
    } catch (e) { window.print(); }
  }

  // ── Affichages obligatoires : une affiche = un fichier indépendant, avec l'en-tête de la société ──
  var AFF_SOC = [['nom', 'Nom de la société'], ['forme', 'Forme et capital'], ['adresse', 'Adresse'], ['tel', 'Téléphone'], ['ids', 'RCS / SIRET'], ['inspection', 'Inspection du travail (adresse)']];
  var AFF_CHAMPS = [
    ['insp_nom', 'Inspecteur ou contrôleur du travail compétent (nom)'], ['insp_tel', 'Inspection du travail : téléphone'],
    ['med', 'Service de santé au travail : nom, adresse, téléphone'],
    ['extincteurs', 'Emplacement des extincteurs'], ['rassemblement', 'Point de rassemblement en cas d\'évacuation'],
    ['horaires', 'Horaires collectifs : un jour par ligne (ex. : Lundi : 10h-15h / 18h-23h)', 'textarea'], ['repos', 'Jour(s) de repos hebdomadaire'],
    ['consult', 'Lieu où les documents sont consultables (ex. : bureau de la direction)'],
    ['conges', 'Période de prise des congés payés (ex. : du 1er mai au 31 octobre)'],
    ['viande', 'Origine des viandes bovines servies (ex. : France)'], ['mediateur', 'Médiateur de la consommation : nom, adresse, site internet']
  ];
  function affLigne(x) { return x ? esc(x) : '<span style="display:inline-block;min-width:70mm;border-bottom:1px dotted #555">&nbsp;</span>'; }
  var AFFICHES = [
    { t: 'Inspection du travail', p: 'sal', ref: 'Article D. 4711-1 du code du travail', c: function (s, f) {
      return '<p>Adresse : <b>' + affLigne(s.inspection) + '</b></p><p>Inspecteur ou contrôleur compétent : <b>' + affLigne(f.insp_nom) + '</b></p><p>Téléphone : <b>' + affLigne(f.insp_tel) + '</b></p>'; } },
    { t: 'Médecine du travail', p: 'sal', ref: 'Article D. 4711-1 du code du travail', c: function (s, f) {
      return '<p>Service de prévention et de santé au travail :</p><p style="font-size:20px"><b>' + affLigne(f.med) + '</b></p>'; } },
    { t: 'Numéros d\'urgence', p: 'sal', ref: 'Article D. 4711-1 du code du travail', c: function () {
      return '<table style="width:100%;font-size:22px;border-collapse:collapse">' + [['SAMU', '15'], ['Pompiers', '18'], ['Police secours', '17'], ['Numéro d\'urgence européen', '112'], ['Urgence pour personnes sourdes ou malentendantes (SMS)', '114'], ['Centre antipoison (Paris)', '01 40 05 48 48']]
        .map(function (l) { return '<tr><td style="padding:10px;border-bottom:1px solid #ccc">' + l[0] + '</td><td style="padding:10px;border-bottom:1px solid #ccc;text-align:right;font-weight:800;font-size:30px">' + l[1] + '</td></tr>'; }).join('') + '</table>'; } },
    { t: 'Consignes de sécurité incendie', p: 'sal', ref: 'Articles R. 4227-37 et R. 4227-38 du code du travail', c: function (s, f) {
      return '<p><b>Si vous découvrez un feu :</b></p><ol><li>Donnez l\'alerte : appelez les <b>pompiers (18 ou 112)</b> et prévenez la direction.</li><li>Coupez le gaz et l\'électricité des appareils de cuisson si c\'est sans danger.</li><li>Feu d\'huile ou de friteuse : <b>ne jetez jamais d\'eau</b>, couvrez avec un couvercle ou une couverture anti-feu.</li><li>Attaquez le feu avec un extincteur uniquement si vous ne courez aucun risque.</li></ol>'
        + '<p><b>En cas d\'évacuation :</b> faites sortir les clients, fermez les portes derrière vous, n\'utilisez pas l\'ascenseur, ne revenez pas en arrière.</p>'
        + '<p>Extincteurs : <b>' + affLigne(f.extincteurs) + '</b></p><p>Point de rassemblement : <b>' + affLigne(f.rassemblement) + '</b></p>'; } },
    { t: 'Interdiction de fumer et de vapoter', p: 'cli', ref: 'Articles L. 3512-8, R. 3512-2, L. 3513-6 et R. 3513-2 du code de la santé publique', c: function () {
      return '<p style="text-align:center;font-size:110px;margin:10px 0">🚭</p><p style="text-align:center;font-size:26px;font-weight:800">Il est interdit de fumer et de vapoter dans ces locaux.</p><p style="text-align:center">Toute infraction expose son auteur à une amende.</p>'; } },
    { t: 'Horaires collectifs de travail', p: 'sal', ref: 'Articles L. 3171-1 et D. 3171-2 à D. 3171-4 du code du travail', c: function (s, f) {
      var L = String(f.horaires || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!L.length) L = ['Lundi :', 'Mardi :', 'Mercredi :', 'Jeudi :', 'Vendredi :', 'Samedi :', 'Dimanche :'];
      return '<table style="width:100%;font-size:18px;border-collapse:collapse">' + L.map(function (l) { return '<tr><td style="padding:9px;border:1px solid #999">' + esc(l) + '</td></tr>'; }).join('') + '</table>'
        + '<p>Repos hebdomadaire : <b>' + affLigne(f.repos) + '</b></p><p>Copie adressée à l\'inspection du travail avant sa mise en service.</p>'
        + '<p style="margin-top:24px">Date : ........................ &nbsp; Signature de l\'employeur :</p>'; } },
    { t: 'Convention collective', p: 'sal', ref: 'Article R. 2262-3 du code du travail', c: function (s, f) {
      return '<p>Convention collective applicable :</p><p style="font-size:20px"><b>Convention collective nationale des hôtels, cafés, restaurants (HCR) du 30 avril 1997 — IDCC 1979</b></p><p>Elle peut être consultée : <b>' + affLigne(f.consult) + '</b></p>'; } },
    { t: 'Égalité de rémunération entre les femmes et les hommes', p: 'sal', ref: 'Articles L. 3221-1 à L. 3221-7 et R. 3221-2 du code du travail', c: function (s, f) {
      return '<p><b>Article L. 3221-2 :</b> « Tout employeur assure, pour un même travail ou pour un travail de valeur égale, l\'égalité de rémunération entre les femmes et les hommes. »</p><p>Sont considérés comme ayant une valeur égale les travaux qui exigent des salariés un ensemble comparable de connaissances professionnelles, de capacités, de responsabilités et de charge physique ou nerveuse.</p><p>Toute disposition contraire est nulle. Le texte intégral des articles L. 3221-1 à L. 3221-7 peut être consulté : <b>' + affLigne(f.consult) + '</b></p>'; } },
    { t: 'Harcèlement moral et sexuel', p: 'sal', ref: 'Articles L. 1152-4 et L. 1153-5 du code du travail', c: function (s, f) {
      return '<p><b>Article 222-33-2 du code pénal :</b> « Le fait de harceler autrui par des propos ou comportements répétés ayant pour objet ou pour effet une dégradation des conditions de travail susceptible de porter atteinte à ses droits et à sa dignité, d\'altérer sa santé physique ou mentale ou de compromettre son avenir professionnel, est puni de deux ans d\'emprisonnement et de 30 000 € d\'amende. »</p>'
        + '<p><b>Article 222-33 du code pénal (extrait) :</b> « Le harcèlement sexuel est le fait d\'imposer à une personne, de façon répétée, des propos ou comportements à connotation sexuelle ou sexiste qui soit portent atteinte à sa dignité en raison de leur caractère dégradant ou humiliant, soit créent à son encontre une situation intimidante, hostile ou offensante. Est assimilé au harcèlement sexuel le fait, même non répété, d\'user de toute forme de pression grave dans le but réel ou apparent d\'obtenir un acte de nature sexuelle. » Puni de deux ans d\'emprisonnement et de 30 000 € d\'amende.</p>'
        + '<p><b>Qui contacter :</b><br>– Médecine du travail : ' + affLigne(f.med) + '<br>– Inspection du travail : ' + affLigne(s.inspection) + (f.insp_tel ? ' — ' + esc(f.insp_tel) : '') + '<br>– Défenseur des droits : 09 69 39 00 00 — defenseurdesdroits.fr<br>– Violences sexistes et sexuelles : 3919</p>'; } },
    { t: 'Lutte contre les discriminations', p: 'sal', ref: 'Article L. 1142-6 du code du travail — articles 225-1 à 225-4 du code pénal', c: function () {
      return '<p><b>Article 225-1 du code pénal (extrait) :</b> constitue une discrimination toute distinction opérée entre les personnes à raison de leur origine, de leur sexe, de leur situation de famille, de leur grossesse, de leur apparence physique, de la particulière vulnérabilité résultant de leur situation économique, de leur patronyme, de leur lieu de résidence, de leur état de santé, de leur perte d\'autonomie, de leur handicap, de leurs caractéristiques génétiques, de leurs mœurs, de leur orientation sexuelle, de leur identité de genre, de leur âge, de leurs opinions politiques, de leurs activités syndicales, de leur qualité de lanceur d\'alerte, de leur capacité à s\'exprimer dans une langue autre que le français, de leur appartenance ou de leur non-appartenance, vraie ou supposée, à une ethnie, une nation, une prétendue race ou une religion déterminée.</p>'
        + '<p><b>Article 225-2 :</b> la discrimination, notamment lorsqu\'elle consiste à refuser d\'embaucher, à sanctionner ou à licencier une personne, est punie de trois ans d\'emprisonnement et de 45 000 € d\'amende.</p><p>Défenseur des droits : 09 69 39 00 00 — defenseurdesdroits.fr</p>'; } },
    { t: 'Document unique d\'évaluation des risques', p: 'sal', ref: 'Article R. 4121-4 du code du travail', c: function (s, f) {
      return '<p>Le document unique d\'évaluation des risques professionnels (DUERP) est tenu à la disposition des salariés, du médecin du travail et de l\'inspection du travail.</p><p>Il peut être consulté : <b>' + affLigne(f.consult) + '</b>, sur simple demande auprès de la direction.</p>'; } },
    { t: 'Congés payés', p: 'sal', ref: 'Articles L. 3141-13, D. 3141-5 et D. 3141-6 du code du travail', c: function (s, f) {
      return '<p>Période de prise des congés payés :</p><p style="font-size:22px"><b>' + affLigne(f.conges) + '</b></p><p>L\'ordre des départs est communiqué à chaque salarié au moins un mois avant son départ.</p>'; } },
    { t: 'Protection des mineurs et répression de l\'ivresse publique', p: 'cli', ref: 'Articles L. 3342-1, L. 3342-4 et L. 3353-3 du code de la santé publique', c: function () {
      return '<p style="font-size:22px;font-weight:800;text-align:center">La vente et l\'offre gratuite de boissons alcooliques à des mineurs de moins de 18 ans sont interdites.</p><p style="text-align:center">La personne qui délivre la boisson peut exiger la preuve de la majorité. Infraction punie de 7 500 € d\'amende.</p>'
        + '<p style="font-size:20px;font-weight:800;text-align:center;margin-top:20px">Il est interdit de servir des boissons alcooliques à une personne manifestement ivre.</p>'; } },
    { t: 'Origine des viandes bovines', p: 'cli', ref: 'Décret n° 2002-1465 du 17 décembre 2002', c: function (s, f) {
      return '<p style="font-size:24px;text-align:center">Les viandes bovines servies dans notre établissement sont :</p><p style="font-size:26px;text-align:center"><b>nées, élevées et abattues en : ' + affLigne(f.viande) + '</b></p>'; } },
    { t: 'Allergènes', p: 'cli', ref: 'Articles R. 412-12 à R. 412-16 du code de la consommation', c: function () {
      return '<p style="font-size:22px;text-align:center">Les informations sur les <b>14 allergènes majeurs</b> présents dans nos plats sont disponibles <b>par écrit</b>, sur simple demande auprès de notre personnel.</p><p style="text-align:center">Gluten · crustacés · œufs · poissons · arachides · soja · lait · fruits à coque · céleri · moutarde · sésame · sulfites · lupin · mollusques</p>'; } },
    { t: 'Médiateur de la consommation', p: 'cli', ref: 'Articles L. 612-1 et L. 616-1 du code de la consommation', c: function (s, f) {
      return '<p>En cas de litige non résolu avec notre établissement, vous pouvez recourir gratuitement au médiateur de la consommation :</p><p style="font-size:20px"><b>' + affLigne(f.mediateur) + '</b></p>'; } }
  ];
  function affHTML(a, s, f) {
    return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;font-size:16px;line-height:1.5">'
      + '<div style="border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:18px;font-size:13px"><b style="font-size:17px">' + esc(s.nom || '') + '</b>'
      + (s.forme ? ' — ' + esc(s.forme) : '') + '<br>' + esc(s.adresse || '') + '<br>' + [s.tel ? 'Tél. ' + esc(s.tel) : '', esc(s.ids || '')].filter(Boolean).join(' · ') + '</div>'
      + '<h1 style="font-size:30px;text-align:center;margin:8px 0 4px;text-transform:uppercase">' + esc(a.t) + '</h1>'
      + '<div style="text-align:center;font-size:12px;color:#444;margin-bottom:22px">' + esc(a.ref) + '</div>'
      + a.c(s, f) + '<div style="margin-top:28px;font-size:11px;color:#555">Affiché le ' + new Date().toLocaleDateString('fr-FR') + '</div></div>';
  }
  function affDonnees() {
    var s = enteteSociete(), e = {}; try { e = JSON.parse(localStorage.getItem(cleEntete()) || '{}') || {}; } catch (x) { e = {}; }
    var f = {}; AFF_CHAMPS.forEach(function (c) { f[c[0]] = e['aff_' + c[0]] || ''; }); return { s: s, f: f };
  }
  function vueAffichages() {
    if (!encoreOuvert()) return;
    var o = overlay(), D = affDonnees();
    var rIdx = rubIndex('declarations', 'Affichages obligatoires');
    function ligne(a, k) {
      return '<div class="da-rub"><span><b>' + esc(a.t) + '</b><small>' + esc(a.ref) + '</small></span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
        + '<button class="da-btn" type="button" data-aff="voir" data-k="' + k + '">Voir</button><button class="da-btn" type="button" data-aff="imp" data-k="' + k + '">🖨️</button><button class="da-btn" type="button" data-aff="pdf" data-k="' + k + '">PDF</button></span></div>';
    }
    var h = '<div class="da-wrap">' + entete('declarations')
      + '<div class="da-item" style="cursor:default"><span class="i">📌</span><span><b>Affichages obligatoires</b><small>Une affiche par fichier, avec l\'en-tête de la société : imprimez-les une par une</small></span></div>'
      + '<details class="da-form"><summary style="cursor:pointer;font-weight:800">✏️ Informations à afficher (mémorisées)</summary>'
      + AFF_SOC.map(function (c) { return '<label for="aff_s_' + c[0] + '">' + esc(c[1]) + '<input id="aff_s_' + c[0] + '" value="' + esc(D.s[c[0]] || '') + '"></label>'; }).join('')
      + AFF_CHAMPS.map(function (c) { return '<label for="aff_' + c[0] + '">' + esc(c[1]) + (c[2] === 'textarea' ? '<textarea id="aff_' + c[0] + '" rows="7">' + esc(D.f[c[0]]) + '</textarea>' : '<input id="aff_' + c[0] + '" value="' + esc(D.f[c[0]]) + '">') + '</label>'; }).join('')
      + '<button class="da-main" type="button" id="affSave">💾 Enregistrer</button><p class="da-note" id="affMsg">Ce qui reste vide s\'imprime en pointillés, à remplir à la main.</p></details>'
      + '<div class="da-sect">👥 Pour les salariés</div>' + AFFICHES.map(function (a, k) { return a.p === 'sal' ? ligne(a, k) : ''; }).join('')
      + '<div class="da-sect">🍽️ Pour les clients</div>' + AFFICHES.map(function (a, k) { return a.p === 'cli' ? ligne(a, k) : ''; }).join('')
      + '<div id="affApercu"></div>'
      + '<button class="da-btn" type="button" data-da="doc:declarations:' + rIdx + '">📁 Affiches signées ou scannées rangées ici</button></div>';
    o.innerHTML = h; brancher(o); o.scrollTop = 0;
    function lireForm() {
      var e = {}; try { e = JSON.parse(localStorage.getItem(cleEntete()) || '{}') || {}; } catch (x) { e = {}; }
      AFF_SOC.forEach(function (c) { e[c[0]] = o.querySelector('#aff_s_' + c[0]).value.trim(); });
      AFF_CHAMPS.forEach(function (c) { e['aff_' + c[0]] = o.querySelector('#aff_' + c[0]).value.trim(); });
      return e;
    }
    o.querySelector('#affSave').addEventListener('click', function () { memoriserEntete(lireForm()); var m = o.querySelector('#affMsg'); m.style.color = '#15803d'; m.textContent = '✓ Enregistré.'; });
    o.querySelectorAll('[data-aff]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!encoreOuvert()) return;
        memoriserEntete(lireForm());
        var D2 = affDonnees(), a = AFFICHES[+b.getAttribute('data-k')], html = affHTML(a, D2.s, D2.f), act = b.getAttribute('data-aff');
        if (act === 'imp') return imprimer(html, a.t);
        if (act === 'pdf') {
          var el = document.createElement('div'); el.style.cssText = 'background:#fff;padding:10px'; el.innerHTML = html;
          var nom = 'Affichage - ' + sansAccent(a.t).trim().replace(/ /g, '-') + '.pdf';
          if (typeof window._packEnvoyerPDF === 'function') return window._packEnvoyerPDF(el, nom, b);
          return imprimer(html, a.t);
        }
        var ap = o.querySelector('#affApercu');
        ap.innerHTML = '<div class="da-sect">Aperçu : ' + esc(a.t) + '</div><div style="background:#fff;border-radius:8px;padding:18px;box-shadow:0 6px 24px rgba(0,0,0,.12);overflow-x:auto">' + html + '</div>';
        ap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  var cacheProcs = null;
  function vueProcs() {
    if (!encoreOuvert()) return;
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-note">Chargement…</p></div>'; brancher(o);
    chargerSalariesSiBesoin().then(function () { return rpc('da_procedures_liste', { p_code: codeCompte(), p_pin: pinSession }); }).then(function (r) {
      if (!r || r.ok !== true) { o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-err">' + esc(messageRefus(r)) + '</p></div>'; brancher(o); return; }
      cacheProcs = r.procedures || [];
      var h = '<div class="da-wrap">' + entete('personnel') + '<div class="da-item" style="cursor:default"><span class="i">⚖️</span><span><b>Procédures</b><small>Lettres et convocations, rangées par salarié</small></span></div>'
        + '<button class="da-main" type="button" data-da="procnew">＋ Nouvelle procédure</button>';
      if (!cacheProcs.length) h += '<p class="da-note">Aucune procédure enregistrée.</p>';
      function ligneProc(p) {
        var t = TYPES_PROC[p.type] || { titre: p.type };
        return '<button class="da-item" type="button" data-da="procvoir:' + esc(p.id) + '"><span class="i">' + (p.statut === 'archivee' ? '📦' : (t.lourd ? '🔴' : '🟠')) + '</span><span><b>' + esc(t.titre) + ' — ' + esc(nomSalarie(p.salarie_id) || '?') + '</b><small>'
          + esc(['Lettre du ' + dateFr(p.date_lettre), p.date_entretien ? 'entretien le ' + dateFr(p.date_entretien) : ''].filter(Boolean).join(' · ')) + '</small></span><span class="ch">›</span></button>';
      }
      var enCours = cacheProcs.filter(function (p) { return p.statut !== 'archivee'; }), archives = cacheProcs.filter(function (p) { return p.statut === 'archivee'; });
      h += enCours.map(ligneProc).join('');
      if (archives.length) h += '<details class="da-form"><summary style="cursor:pointer;font-weight:800">📦 Archivées · ' + archives.length + '</summary>' + archives.map(ligneProc).join('') + '</details>';
      h += '</div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
    }, function () { o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-err">Pas de connexion internet.</p></div>'; brancher(o); });
  }
  function vueProcVoir(id) {
    if (!encoreOuvert()) return;
    var p = (cacheProcs || []).filter(function (x) { return x.id === id; })[0]; if (!p) return vueProcs();
    var t = TYPES_PROC[p.type] || { titre: p.type };
    var html = (p.donnees && p.donnees.html) || '';
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('procs') + '<b style="font-size:17px">' + esc(t.titre) + ' — ' + esc(nomSalarie(p.salarie_id)) + '</b>'
      + '<div style="background:#fff;border-radius:8px;padding:18px;box-shadow:0 6px 24px rgba(0,0,0,.12);overflow-x:auto">' + html + '</div>'
      + '<button class="da-main" type="button" id="daProcPrint">🖨️ Imprimer</button>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
      + '<button class="da-btn" type="button" data-da="procmod:' + esc(p.id) + '">✏️ Modifier</button>'
      + '<button class="da-btn" type="button" data-da="procarch:' + esc(p.id) + '">' + (p.statut === 'archivee' ? '📤 Désarchiver' : '📦 Archiver') + '</button>'
      + '<button class="da-btn" type="button" data-da="procsuppr:' + esc(p.id) + '" style="color:#b91c1c">🗑️ Supprimer</button></div></div>';
    brancher(o); o.scrollTop = 0;
    o.querySelector('#daProcPrint').addEventListener('click', function () { imprimer(html, t.titre); });
  }
  function archiverProc(id) {
    if (!encoreOuvert()) return;
    var p = (cacheProcs || []).filter(function (x) { return x.id === id; })[0]; if (!p) return vueProcs();
    rpc('da_procedure_modifier', { p_code: codeCompte(), p_pin: pinSession, p_id: id, p_p: { statut: p.statut === 'archivee' ? 'preparee' : 'archivee' } }).then(function (r) {
      if (!r || r.ok !== true) { alert(messageRefus(r)); return; }
      vueProcs();
    });
  }
  function supprimerProc(id, btn) {
    if (!encoreOuvert()) return;
    if (btn.getAttribute('data-confirme') !== '1') { btn.setAttribute('data-confirme', '1'); btn.textContent = 'Toucher encore pour confirmer la suppression'; return; }
    rpc('da_procedure_supprimer', { p_code: codeCompte(), p_pin: pinSession, p_id: id }).then(function () { vueProcs(); });
  }
  function vueProcNouvelle(pEdit) {
    if (!encoreOuvert()) return;
    var o = overlay();
    chargerSalariesSiBesoin().then(function (sal) {
      var actifs = sal.filter(function (s) { return s.statut !== 'ancien'; });
      var soc = enteteSociete(), auj = iso(new Date());
      var optSal = actifs.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(((s.prenom || '') + ' ' + (s.nom || '')).trim()) + '</option>'; }).join('');
      var optRegle = REGLES.map(function (g) { return '<optgroup label="' + esc(g.g) + '">' + g.l.map(function (r) { return '<option value="' + esc(r[1]) + '" data-h="' + g.h + '">' + esc(r[0]) + '</option>'; }).join('') + '</optgroup>'; }).join('')
        + '<optgroup label="Autre"><option value="__autre__" data-h="0">Autre (à préciser)</option></optgroup>';
      var types = Object.keys(TYPES_PROC).map(function (k) { var t = TYPES_PROC[k]; return '<button type="button" class="da-btn dap-type" data-t="' + k + '" style="text-align:left;border-radius:12px;padding:10px">' + esc(t.titre) + '<br><small style="font-weight:500;color:' + (t.lourd ? '#b91c1c' : '#5b5e78') + '">' + (t.lourd ? 'entretien préalable obligatoire' : 'lettre à signer') + '</small></button>'; }).join('');
      o.innerHTML = '<div class="da-wrap">' + entete('procs') + '<form class="da-form" id="dapForm">'
        + '<b style="font-size:17px">' + (pEdit ? 'Modifier la procédure' : 'Nouvelle procédure') + '</b>'
        + '<label for="dap_sal">Salarié<select id="dap_sal">' + optSal + '</select></label>'
        + '<label for="dap_civ">Civilité<select id="dap_civ"><option>Monsieur</option><option>Madame</option></select></label>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="dapTypes">' + types + '</div>'
        + '<div id="dapSimple">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label for="dap_df">Date des faits<input id="dap_df" type="date" value="' + auj + '"></label><label for="dap_h">Heure<input id="dap_h" type="time"></label></div>'
        + '<label for="dap_lieu">Lieu<input id="dap_lieu" placeholder="Ex. : en cuisine, pendant le service du midi"></label>'
        + '<label for="dap_faits">Ce qui s\'est passé<textarea id="dap_faits" placeholder="Ex. : vous ne portiez pas de coiffe"></textarea></label>'
        + '<label for="dap_regle">Règle non respectée<select id="dap_regle">' + optRegle + '</select></label>'
        + '<label for="dap_autre" id="dapAutreW" hidden>Précisez la règle<input id="dap_autre"></label>'
        + '<label for="dap_dem">Ce que nous attendons<input id="dap_dem" value="respecter cette règle à chaque service, dès aujourd\'hui"></label></div>'
        + '<div id="dapLourd" hidden>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label for="dap_de">Date de l\'entretien<input id="dap_de" type="date"></label><label for="dap_he">Heure<input id="dap_he" type="time" value="15:00"></label></div>'
        + '<label for="dap_le">Lieu de l\'entretien<input id="dap_le" value="au restaurant, ' + esc(soc.adresse) + ', dans le bureau de la direction"></label>'
        + '<label for="dap_mapc">Modèle<select id="dap_mapc"><option value="">Sans mise à pied conservatoire</option><option value="1">Avec mise à pied conservatoire (effet immédiat)</option></select></label>'
        + '<div id="dapDelais" style="border:2px solid #4338ca;background:#eef0ff;border-radius:12px;padding:10px;font-size:13px"></div>'
        + '<button type="button" class="da-btn" id="dapConseil">Revenir à la date d\'entretien conseillée</button></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label for="dap_dl">Date de la lettre<input id="dap_dl" type="date" value="' + auj + '"></label>'
        + '<label for="dap_rem">Remise<select id="dap_rem"><option value="main">En main propre</option><option value="lrar">Lettre recommandée</option></select></label></div>'
        + '<details><summary style="cursor:pointer;font-weight:700">En-tête de la société (mémorisé)</summary>'
        + [['nom', 'Nom'], ['forme', 'Forme et capital (ex. : SAS au capital de 1 000 €)'], ['adresse', 'Adresse'], ['ids', 'RCS / SIRET'], ['tel', 'Téléphone'], ['ville', 'Ville (« Fait à »)'], ['signataire', 'Signataire'], ['mairie', 'Mairie où consulter la liste des conseillers'], ['inspection', 'Inspection du travail (adresse)']]
          .map(function (c) { return '<label for="dap_s_' + c[0] + '">' + esc(c[1]) + '<input id="dap_s_' + c[0] + '" value="' + esc(soc[c[0]] || '') + '"></label>'; }).join('')
        + '</details><p class="da-note" id="dapNote"></p></form>'
        + '<b>La lettre, prête à imprimer</b><div id="dapLettre" style="background:#fff;border-radius:8px;padding:18px;box-shadow:0 6px 24px rgba(0,0,0,.12);overflow-x:auto"></div>'
        + '<button class="da-main" type="button" id="dapPrint">🖨️ Imprimer</button><button class="da-main" type="button" id="dapSave" style="background:#15803d">💾 Enregistrer dans le dossier du salarié</button><p class="da-err" id="dapMsg"></p></div>';
      brancher(o); o.scrollTop = 0;
      var type = 'rappel', entManuel = false;
      function $(id) { return o.querySelector('#' + id); }
      if (pEdit && pEdit.donnees) {
        var dv = pEdit.donnees; type = pEdit.type || dv.type || 'rappel'; entManuel = true;
        var map = { dap_sal: pEdit.salarie_id, dap_civ: dv.civ, dap_df: dv.date_faits, dap_h: dv.heure, dap_lieu: dv.lieu, dap_faits: dv.faits, dap_dem: dv.demande,
          dap_de: dv.date_ent, dap_he: dv.heure_ent, dap_le: dv.lieu_ent, dap_mapc: dv.map_cons ? '1' : '', dap_dl: dv.date_lettre, dap_rem: dv.remise };
        Object.keys(map).forEach(function (k) { if (map[k] != null && $(k)) $(k).value = map[k]; });
        var rs = $('dap_regle'); rs.value = dv.regle || '';
        if (dv.regle && rs.value !== dv.regle) { rs.value = '__autre__'; $('dap_autre').value = dv.regle; }
        if (dv.soc) Object.keys(dv.soc).forEach(function (k) { if ($('dap_s_' + k)) $('dap_s_' + k).value = dv.soc[k] || ''; });
      }
      function lire() {
        var sel = $('dap_regle'), opt = sel.selectedOptions[0];
        var socv = {}; ['nom', 'forme', 'adresse', 'ids', 'tel', 'ville', 'signataire', 'mairie', 'inspection'].forEach(function (k) { socv[k] = $('dap_s_' + k).value.trim(); });
        return { type: type, salarie_id: $('dap_sal').value, civ: $('dap_civ').value, date_faits: $('dap_df').value, heure: $('dap_h').value, lieu: $('dap_lieu').value.trim(),
          faits: $('dap_faits').value.trim(), regle: sel.value === '__autre__' ? $('dap_autre').value.trim() : sel.value, hygiene: !!(opt && opt.getAttribute('data-h') === '1'),
          demande: $('dap_dem').value.trim(), date_ent: $('dap_de').value, heure_ent: $('dap_he').value, lieu_ent: $('dap_le').value.trim(), map_cons: $('dap_mapc').value === '1',
          date_lettre: $('dap_dl').value, remise: $('dap_rem').value, soc: socv };
      }
      function salarie() { var id = $('dap_sal').value; return actifs.filter(function (s) { return s.id === id; })[0] || {}; }
      function rendre() {
        var t = TYPES_PROC[type];
        o.querySelectorAll('.dap-type').forEach(function (b) { var on = b.getAttribute('data-t') === type; b.style.background = on ? '#eef0ff' : '#fff'; b.style.borderColor = on ? '#4338ca' : '#d9dbe8'; });
        $('dapSimple').hidden = t.lourd; $('dapLourd').hidden = !t.lourd;
        $('dapAutreW').hidden = t.lourd || $('dap_regle').value !== '__autre__';
        $('dapNote').textContent = t.lourd ? 'Mise à pied ou licenciement : l\'entretien préalable est obligatoire. La convocation est remise en main propre contre décharge ou envoyée en recommandé.' : t.note;
        if (t.lourd) {
          var r = delais($('dap_dl').value, $('dap_rem').value === 'lrar', $('dap_de').value);
          if (r && !entManuel) { $('dap_de').value = iso(r.consEnt); r = delais($('dap_dl').value, $('dap_rem').value === 'lrar', $('dap_de').value); }
          if (r) {
            var h = '<b>Calculateur automatique des délais</b><br>1. Remise : ' + ($('dap_rem').value === 'lrar' ? '1re présentation estimée au plus tard le ' : 'en main propre le ') + jourLong(r.remise)
              + '<br>2. Entretien possible à partir du ' + jourLong(r.minEnt) + ' (5 jours ouvrables pleins). Date conseillée : <b>' + jourLong(r.consEnt) + '</b>';
            if (r.ent) {
              if (r.ent < r.minEnt) h += '<br><b style="color:#b91c1c">⚠ Date d\'entretien trop tôt : délai de 5 jours non respecté.</b>';
              else if (!ouvrable(r.ent)) h += '<br><b style="color:#b91c1c">⚠ Dimanche ou jour férié.</b>';
              h += '<br>3. Lettre ' + (type === 'map' ? 'de mise à pied' : 'de licenciement') + ' : pas avant le ' + jourLong(r.minLet) + ' (2 jours ouvrables après l\'entretien), conseillé le <b>' + jourLong(r.consLet) + '</b>, au plus tard le ' + jourLong(r.maxLet) + '.';
            }
            $('dapDelais').innerHTML = h;
          }
        }
        $('dapLettre').innerHTML = lettreHTML(lire(), salarie());
      }
      o.querySelectorAll('.dap-type').forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-t'); rendre(); }); });
      $('dap_de').addEventListener('input', function () { entManuel = true; });
      $('dapConseil').addEventListener('click', function () { entManuel = false; rendre(); });
      o.querySelectorAll('#dapForm input,#dapForm select,#dapForm textarea').forEach(function (el) { el.addEventListener('input', rendre); el.addEventListener('change', rendre); });
      $('dapPrint').addEventListener('click', function () { imprimer($('dapLettre').innerHTML, TYPES_PROC[type].titre); });
      $('dapSave').addEventListener('click', function () {
        if (!encoreOuvert()) return;
        var f = lire(), msg = $('dapMsg');
        if (!f.salarie_id) { msg.textContent = 'Choisissez un salarié.'; return; }
        memoriserEntete(f.soc);
        msg.style.color = '#5b5e78'; msg.textContent = 'Enregistrement…';
        var donnees = JSON.parse(JSON.stringify(f)); donnees.html = $('dapLettre').innerHTML;
        var donneesProc = {
          salarie_id: f.salarie_id, type: f.type, statut: (pEdit && pEdit.statut) || 'preparee', date_lettre: f.date_lettre || null,
          date_entretien: TYPES_PROC[f.type].lourd && f.date_ent ? f.date_ent + 'T' + (f.heure_ent || '00:00') + ':00' : null, donnees: donnees };
        (pEdit ? rpc('da_procedure_modifier', { p_code: codeCompte(), p_pin: pinSession, p_id: pEdit.id, p_p: donneesProc })
               : rpc('da_procedure_enregistrer', { p_code: codeCompte(), p_pin: pinSession, p_p: donneesProc })).then(function (r) {
          if (!r || r.ok !== true) { msg.style.color = '#b91c1c'; msg.textContent = messageRefus(r); return; }
          vueProcs();
        }, function () { msg.style.color = '#b91c1c'; msg.textContent = 'Pas de connexion internet : rien n\'a été enregistré.'; });
      });
      rendre();
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // REGISTRE UNIQUE DU PERSONNEL (articles L1221-13 et D1221-23 à D1221-27)
  // Tous les salariés, dans l'ordre des embauches, y compris ceux qui sont partis.
  // Mentions : nom et prénoms, nationalité, date de naissance, sexe, emploi et
  // qualification, dates d'entrée et de sortie, type de contrat (CDD, temps
  // partiel…), et pour les étrangers soumis à autorisation : type et n° du titre.
  // Conservation : 5 ans après le départ du salarié. Aucune ligne n'est supprimée.
  // ══════════════════════════════════════════════════════════════════
  var NAT_SANS_AUTORISATION = ['francaise', 'francais', 'allemande', 'autrichienne', 'belge', 'bulgare', 'chypriote', 'croate', 'danoise', 'espagnole', 'estonienne', 'finlandaise', 'grecque', 'hongroise', 'irlandaise', 'italienne', 'lettone', 'lituanienne', 'luxembourgeoise', 'maltaise', 'neerlandaise', 'polonaise', 'portugaise', 'roumaine', 'slovaque', 'slovene', 'suedoise', 'tcheque', 'islandaise', 'liechtensteinoise', 'norvegienne', 'suisse'];
  function autorisationRequise(s) {
    var n = sansAccent(s.nationalite || '').trim();
    if (!n) return null; // nationalité inconnue : à compléter
    return !NAT_SANS_AUTORISATION.some(function (x) { return n.indexOf(x) === 0; });
  }
  function typeContrat(s) {
    var c = String(s.contrat || '');
    var duree = /cdd/i.test(c) ? 'CDD' : (/cdi/i.test(c) ? 'CDI' : '');
    var temps = s.heures_hebdo ? (Number(s.heures_hebdo) < 35 ? 'temps partiel (' + s.heures_hebdo + ' h)' : 'temps complet') : '';
    return [duree, temps].filter(Boolean).join(', ') || c;
  }
  function lignesRegistre(sal) {
    return sal.slice().sort(function (a, b) {
      var da = a.date_embauche || '9999', db = b.date_embauche || '9999';
      return da < db ? -1 : (da > db ? 1 : String(a.nom || '').localeCompare(String(b.nom || '')));
    }).map(function (s, i) {
      var aut = autorisationRequise(s);
      var manque = [];
      ['nom', 'prenom', 'nationalite', 'naissance_date', 'sexe', 'poste', 'qualification', 'date_embauche', 'contrat'].forEach(function (k) { if (!s[k]) manque.push(k); });
      if (aut === true && !(s.titre_travail_type && s.titre_travail_num)) manque.push('titre');
      if (s.statut === 'ancien' && !s.date_sortie) manque.push('date_sortie');
      return { n: i + 1, s: s, aut: aut, manque: manque };
    });
  }
  var LIB_MANQUE = { nom: 'nom', prenom: 'prénom', nationalite: 'nationalité', naissance_date: 'date de naissance', sexe: 'sexe', poste: 'emploi', qualification: 'qualification', date_embauche: 'date d\'entrée', contrat: 'type de contrat', titre: 'titre de séjour (type et n°)', date_sortie: 'date de sortie' };
  function tableRegistre(L, pourImpression) {
    var td = pourImpression ? 'border:1px solid #999;padding:4px 6px;vertical-align:top' : 'border-bottom:1px solid #e3e4ef;padding:6px;vertical-align:top';
    var th = pourImpression ? 'border:1px solid #999;padding:4px 6px;background:#eee;text-align:left' : 'padding:6px;background:#eef0ff;text-align:left;position:sticky;top:0';
    var h = '<table style="border-collapse:collapse;font-size:' + (pourImpression ? '10px' : '12px') + ';min-width:900px;width:100%"><thead><tr>'
      + ['N°', 'Nom et prénoms', 'Nationalité', 'Date de naissance', 'Sexe', 'Emploi', 'Qualification', 'Date d\'entrée', 'Date de sortie', 'Type de contrat', 'Titre de séjour (type et n°)']
        .map(function (x) { return '<th style="' + th + '">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    L.forEach(function (l) {
      var s = l.s, v = function (x) { return x ? esc(x) : (pourImpression ? '' : '<span style="color:#b45309">à compléter</span>'); };
      var aut = l.aut === true ? (s.titre_travail_type || s.titre_travail_num ? esc([s.titre_travail_type, s.titre_travail_num].filter(Boolean).join(' n° ')) : v('')) : (l.aut === false ? 'Non requis' : v(''));
      h += '<tr><td style="' + td + '">' + l.n + '</td><td style="' + td + '"><b>' + esc(String(s.nom || '').toUpperCase()) + '</b> ' + esc(s.prenom || '') + '</td>'
        + '<td style="' + td + '">' + v(s.nationalite) + '</td><td style="' + td + '">' + v(dateFr(s.naissance_date)) + '</td><td style="' + td + '">' + v(s.sexe) + '</td>'
        + '<td style="' + td + '">' + v(s.poste) + '</td><td style="' + td + '">' + v(s.qualification) + '</td><td style="' + td + '">' + v(dateFr(s.date_embauche)) + '</td>'
        + '<td style="' + td + '">' + (s.date_sortie ? esc(dateFr(s.date_sortie)) : (s.statut === 'ancien' ? v('') : '')) + '</td>'
        + '<td style="' + td + '">' + v(typeContrat(s)) + '</td><td style="' + td + '">' + aut + '</td></tr>';
    });
    return h + '</tbody></table>';
  }
  function vueRegistre() {
    if (!encoreOuvert()) return;
    var o = overlay();
    o.innerHTML = '<div class="da-wrap">' + entete('personnel') + '<p class="da-note">Chargement…</p></div>'; brancher(o);
    cacheSalaries = null;
    chargerSalariesSiBesoin().then(function (sal) {
      var L = lignesRegistre(sal), incomplets = L.filter(function (l) { return l.manque.length; });
      var soc = enteteSociete();
      var h = '<div class="da-wrap" style="max-width:1100px">' + entete('personnel')
        + '<div class="da-item" style="cursor:default"><span class="i">📒</span><span><b>Registre unique du personnel</b><small>' + L.length + ' salarié' + (L.length > 1 ? 's' : '') + ', dans l\'ordre des embauches, y compris les départs</small></span></div>'
        + '<div class="da-form" style="font-size:13px;gap:6px"><b>Ce que dit la loi</b>'
        + '<span>• Obligatoire dès le premier salarié, tenu dans l\'établissement (article L1221-13 du Code du travail).</span>'
        + '<span>• Mentions obligatoires : nom, prénoms, nationalité, date de naissance, sexe, emploi, qualification, dates d\'entrée et de sortie, type de contrat (CDD, temps partiel…), et pour un salarié étranger hors UE le type et le numéro de son titre de séjour (articles D1221-23 à D1221-25).</span>'
        + '<span>• Inscription dans l\'ordre des embauches, sans rien effacer. Conservation <b>5 ans après le départ</b> du salarié (article R1221-26).</span>'
        + '<span>• À présenter à l\'inspection du travail sur demande.</span></div>';
      if (incomplets.length) {
        h += '<div class="da-form" style="border-color:#f59e0b;background:#fff8eb;font-size:13px;gap:4px"><b style="color:#b45309">⚠ ' + incomplets.length + ' ligne' + (incomplets.length > 1 ? 's' : '') + ' incomplète' + (incomplets.length > 1 ? 's' : '') + '</b>'
          + incomplets.map(function (l) { return '<button type="button" class="da-btn" data-da="fiche:' + esc(l.s.id) + '" style="text-align:left">' + esc(((l.s.prenom || '') + ' ' + (l.s.nom || '')).trim()) + ' : ' + esc(l.manque.map(function (k) { return LIB_MANQUE[k]; }).join(', ')) + ' ›</button>'; }).join('')
          + '<span class="da-note">Les anciens salariés partis depuis moins de 5 ans doivent aussi y figurer : ajoutez-les dans Salariés avec le statut « Ancien salarié » et leur date de sortie.</span></div>';
      }
      h += '<div style="overflow-x:auto;background:#fff;border:1px solid #e3e4ef;border-radius:12px">' + tableRegistre(L, false) + '</div>'
        + '<button class="da-main" type="button" id="daRegPrint">🖨️ Imprimer le registre</button>'
        + '<button class="da-btn" type="button" id="daRegCsv">⬇️ Télécharger (tableur)</button></div>';
      o.innerHTML = h; brancher(o); o.scrollTop = 0;
      o.querySelector('#daRegPrint').addEventListener('click', function () {
        var entetePrint = '<h2 style="font-family:Arial;margin:0 0 4px">Registre unique du personnel</h2><div style="font-family:Arial;font-size:11px;margin-bottom:10px">'
          + esc(soc.nom) + ' · ' + esc(soc.adresse) + ' · ' + esc(soc.ids) + ' · édité le ' + new Date().toLocaleDateString('fr-FR') + '</div>';
        imprimer('<style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif}</style>' + entetePrint + tableRegistre(L, true), 'Registre unique du personnel');
      });
      o.querySelector('#daRegCsv').addEventListener('click', function () {
        var lignes = [['N°', 'Nom', 'Prénoms', 'Nationalité', 'Date de naissance', 'Sexe', 'Emploi', 'Qualification', 'Date d\'entrée', 'Date de sortie', 'Type de contrat', 'Titre de séjour']];
        L.forEach(function (l) { var s = l.s; lignes.push([l.n, s.nom, s.prenom, s.nationalite, dateFr(s.naissance_date), s.sexe, s.poste, s.qualification, dateFr(s.date_embauche), dateFr(s.date_sortie), typeContrat(s), l.aut === false ? 'Non requis' : [s.titre_travail_type, s.titre_travail_num].filter(Boolean).join(' n° ')]); });
        var csv = '﻿' + lignes.map(function (r) { return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'registre-unique-du-personnel.csv';
        document.body.appendChild(a); a.click(); setTimeout(function () { try { a.remove(); } catch (e) {} }, 1000);
      });
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
        if (r && r.ok === true) { pinSession = code; actif(); vueMenu(); synchroApp(); return; }
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
      var hero = document.querySelector('#page-home > .hero');
      if (!document.getElementById('daTuileExpert') && (hote || hero)) {
        var w2 = document.createElement('div');
        w2.id = 'daTuileExpert';
        w2.innerHTML = bouton;
        if (hote) {
          w2.style.cssText = 'margin-top:44px'; // laisse la place au bouton flottant « Mes rapports »
          hote.insertBefore(w2, tete ? tete.nextSibling : hote.firstChild);
        } else {
          // Tableau de bord classique (site Nomos) : juste sous le bandeau du haut
          w2.style.cssText = 'padding:12px 16px 0';
          hero.parentNode.insertBefore(w2, hero.nextSibling);
        }
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(installerTuile, 300); });
  else setTimeout(installerTuile, 300);
})();

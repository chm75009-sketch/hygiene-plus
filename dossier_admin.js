// ══════════════════════════════════════════════════════════════════
// DOSSIER ADMINISTRATIF (étape 1 : structure) — réservé au Président
// Tuile « Gestion administrative » sur l'accueil guidé → code à 4 chiffres →
// 3 pôles (personnel, associés, déclarations) + échéances.
// Étape 1 : écrans et rubriques uniquement, AUCUNE donnée enregistrée.
// Le code est propre à l'appareil (empreinte SHA-256 en local) ; il sera
// remplacé par une vérification côté serveur à l'étape 2 (base de données).
// Fichier séparé de script.js : n'interfère avec aucun module HACCP.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var VERROU_MS = 5 * 60 * 1000;
  var deverrouilleJusqua = 0;

  var POLES = [
    { id: 'personnel', ico: '👥', titre: 'Dossier du personnel', sous: 'Salariés, embauche, paie, procédures',
      rub: [
        ['Salariés en activité', 'Une fiche par salarié : identité, contrat, horaires, salaire, période d\'essai'],
        ['Embauche', 'Contrats, avenants, déclarations d\'embauche, pièces d\'identité, titres de séjour, autorisations de travail'],
        ['Paie', 'Bulletins de salaire'],
        ['Santé et formation', 'Visites médicales, formations hygiène'],
        ['Procédures', 'Rappel à l\'ordre, mise en garde, avertissement, blâme, mise à pied, licenciement'],
        ['Anciens salariés', 'Dossiers de départ : lettre, solde de tout compte, certificat de travail, attestation France Travail'],
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

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cleCode() { return 'haccp_dossier_code_' + ((typeof ETAB_ID !== 'undefined' && ETAB_ID) ? ETAB_ID : 'local'); }
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function empreinte(code) {
    var txt = 'nomos-dossier|' + cleCode() + '|' + code;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    return Promise.resolve(txt); // très vieux navigateur : repli (étape 1 uniquement)
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
      + '#daOverlay .da-head{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:18px;padding:16px;display:flex;gap:12px;align-items:center}'
      + '#daOverlay .da-head b{display:block;font-size:18px;font-weight:900}#daOverlay .da-head small{opacity:.75;font-size:12px}'
      + '#daOverlay .da-item{background:#fff;border:1px solid #e3e4ef;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;text-align:left;width:100%;font-family:inherit;color:inherit}'
      + '#daOverlay .da-item .i{font-size:24px}#daOverlay .da-item b{display:block;font-size:15px}#daOverlay .da-item small{display:block;color:#5b5e78;font-size:12px;font-family:Inter,system-ui,sans-serif}'
      + '#daOverlay .da-item .ch{margin-left:auto;color:#9aa0b8;font-size:18px}'
      + '#daOverlay .da-rub{background:#fff;border:1px solid #e3e4ef;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;gap:10px;align-items:center}'
      + '#daOverlay .da-rub b{font-size:14px}#daOverlay .da-rub small{display:block;color:#5b5e78;font-size:12px;font-family:Inter,system-ui,sans-serif;margin-top:2px}'
      + '#daOverlay .da-soon{font-size:11px;font-weight:800;color:#b45309;background:#fff4e0;border-radius:999px;padding:3px 8px;white-space:nowrap}'
      + '#daOverlay .da-pin{background:#fff;border:1px solid #e3e4ef;border-radius:18px;padding:20px;text-align:center;display:flex;flex-direction:column;gap:12px}'
      + '#daOverlay .da-dots{display:flex;justify-content:center;gap:12px}#daOverlay .da-dots span{width:16px;height:16px;border-radius:50%;border:2px solid #4338ca}#daOverlay .da-dots span.on{background:#4338ca}'
      + '#daOverlay .da-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:260px;margin:0 auto;width:100%}'
      + '#daOverlay .da-pad button{border:none;background:#eef0ff;color:#1b1a33;border-radius:14px;padding:14px 0;font-size:20px;font-weight:800;font-family:inherit;cursor:pointer}'
      + '#daOverlay .da-err{color:#b91c1c;font-weight:700;min-height:18px;font-size:13px}'
      + '#daOverlay .da-note{font-size:12px;color:#5b5e78;font-family:Inter,system-ui,sans-serif}'
      + '#daOverlay button:focus-visible{outline:3px solid #4338ca;outline-offset:2px}';
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
  function entete(retour) {
    return '<div class="da-top">'
      + (retour ? '<button class="da-btn" type="button" data-da="menu">← Retour</button>' : '<button class="da-btn" type="button" data-da="fermer">← Accueil</button>')
      + '<button class="da-btn" type="button" data-da="verrou" style="margin-left:auto">🔒 Verrouiller</button></div>'
      + '<div class="da-head"><span style="font-size:28px">🗂️</span><span><b>Dossier administratif</b><small>Réservé au Président · se verrouille après 5 minutes</small></span></div>';
  }
  function brancher(o) {
    o.querySelectorAll('[data-da]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-da');
        if (a === 'fermer') fermer();
        else if (a === 'verrou') { deverrouilleJusqua = 0; fermer(); }
        else if (a === 'menu') vueMenu();
        else vuePole(a);
      });
    });
  }
  function actif() { deverrouilleJusqua = Date.now() + VERROU_MS; }

  function vueMenu() {
    actif();
    var o = overlay();
    var h = '<div class="da-wrap">' + entete(false);
    POLES.forEach(function (p) {
      h += '<button class="da-item" type="button" data-da="' + p.id + '"><span class="i">' + p.ico + '</span><span><b>' + esc(p.titre) + '</b><small>' + esc(p.sous) + '</small></span><span class="ch">›</span></button>';
    });
    h += '<p class="da-note">Étape 1 : la structure est en place. Les documents et les fiches seront ajoutés à l\'étape suivante.</p></div>';
    o.innerHTML = h;
    brancher(o);
    o.scrollTop = 0;
  }
  function vuePole(id) {
    actif();
    var p = POLES.filter(function (x) { return x.id === id; })[0];
    if (!p) return vueMenu();
    var o = overlay();
    var h = '<div class="da-wrap">' + entete(true)
      + '<div class="da-item" style="cursor:default"><span class="i">' + p.ico + '</span><span><b>' + esc(p.titre) + '</b><small>' + esc(p.sous) + '</small></span></div>';
    p.rub.forEach(function (r) {
      h += '<div class="da-rub"><span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<small>' + esc(r[1]) + '</small>' : '') + '</span><span class="da-soon">bientôt</span></div>';
    });
    h += '</div>';
    o.innerHTML = h;
    brancher(o);
    o.scrollTop = 0;
  }

  // Écran du code : création (2 saisies) la première fois, vérification ensuite.
  function vueCode() {
    var existant = lire(cleCode());
    var etape = existant ? 'verif' : 'creer1', premier = '', code = '';
    var o = overlay();
    function titre() { return etape === 'verif' ? 'Entrez votre code' : (etape === 'creer1' ? 'Créez votre code à 4 chiffres' : 'Confirmez le code'); }
    o.innerHTML = '<div class="da-wrap"><div class="da-top"><button class="da-btn" type="button" data-da="fermer">← Accueil</button></div>'
      + '<div class="da-pin"><div style="font-size:30px">🔒</div><b style="font-size:18px">Dossier administratif</b>'
      + '<span class="da-note" id="daTitre"></span><div class="da-dots" id="daDots"><span></span><span></span><span></span><span></span></div>'
      + '<div class="da-err" id="daErr"></div><div class="da-pad" id="daPad"></div>'
      + '<p class="da-note">Le code est enregistré sur cet appareil uniquement. Ne le donnez pas aux salariés.</p></div></div>';
    brancher(o);
    var pad = o.querySelector('#daPad');
    function maj() {
      o.querySelector('#daTitre').textContent = titre();
      o.querySelectorAll('#daDots span').forEach(function (s, i) { s.classList.toggle('on', i < code.length); });
    }
    function valider() {
      var err = o.querySelector('#daErr');
      if (etape === 'creer1') { premier = code; code = ''; etape = 'creer2'; maj(); return; }
      if (etape === 'creer2') {
        if (code !== premier) { err.textContent = 'Les deux codes sont différents. Recommencez.'; etape = 'creer1'; code = ''; maj(); return; }
        empreinte(code).then(function (e) { ecrire(cleCode(), e); vueMenu(); });
        return;
      }
      empreinte(code).then(function (e) {
        if (e === lire(cleCode())) vueMenu();
        else { err.textContent = 'Code incorrect'; code = ''; maj(); }
      });
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
          if (code.length < 4) { code += k; maj(); }
          if (code.length === 4) setTimeout(valider, 150);
        });
      }
      pad.appendChild(b);
    });
    maj();
  }

  window.ouvrirDossierAdministratif = function () {
    css();
    if (Date.now() < deverrouilleJusqua) vueMenu(); else vueCode();
  };

  // Tuile sur l'accueil guidé, dans sa propre section, après les contrôles HACCP.
  function installerTuile() {
    try {
      if (typeof FORMULE_ACTIVE !== 'undefined' && FORMULE_ACTIVE === 'rth') return;
      var body = document.querySelector('#page-guide .pg-body') || (document.getElementById('barometreHaccp') || {}).parentNode;
      if (!body || document.getElementById('daTuile')) return;
      var w = document.createElement('div');
      w.id = 'daTuile';
      w.innerHTML = '<div class="pg-section"><span class="pg-section-dot"></span><span class="pg-section-title">Gestion administrative</span><span class="pg-section-hint">Réservé au Président</span></div>'
        + '<button type="button" onclick="ouvrirDossierAdministratif()" style="width:100%;display:flex;align-items:center;gap:14px;border:none;border-radius:16px;padding:16px;margin:6px 0 14px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;text-align:left;cursor:pointer;font-family:Outfit,Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(15,23,42,.25)">'
        + '<span style="font-size:28px">🗂️</span><span style="flex:1"><b style="display:block;font-size:16px;font-weight:900">Dossier administratif</b><small style="display:block;opacity:.75;font-size:12px">Personnel · associés · déclarations</small></span><span style="font-size:18px" aria-hidden="true">🔒</span></button>';
      body.appendChild(w);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(installerTuile, 300); });
  else setTimeout(installerTuile, 300);
})();

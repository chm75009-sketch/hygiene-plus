/* ────────────────────────────────────────────────────────────────
   Nomos HACCP — motion.js
   Interactions du site : reveal au scroll, compteurs animés,
   barre de progression, tilt de cartes, parallax léger, rotation
   de mots, hover micro-interactions. Vanilla JS, 0 dépendance.

   S'inactive si l'utilisateur préfère un rendu sans animation.
   ──────────────────────────────────────────────────────────────── */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 1. Barre de progression du scroll ──
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.id = 'scrollProgress';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText =
      'position:fixed;top:0;left:0;height:3px;width:0;' +
      'background:linear-gradient(90deg,#0f766e 0%,#14b8a6 60%,#d2ad46 100%);' +
      'z-index:99998;pointer-events:none;transition:width .08s linear;' +
      'box-shadow:0 0 10px rgba(15,118,110,.35)';
    document.body.appendChild(bar);
    function tick() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = p + '%';
    }
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  // ── 2. Reveal au scroll (data-reveal) ──
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ── 3. Compteurs animés (data-counter="300" data-suffix="+") ──
  function animateCounter(el, to, duration, suffix) {
    var start = 0;
    var t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var current = Math.floor(start + (to - start) * eased);
      el.textContent = current.toLocaleString('fr-FR') + (suffix || '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCounters() {
    var els = document.querySelectorAll('[data-counter]');
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.textContent = Number(el.getAttribute('data-counter')).toLocaleString('fr-FR') +
          (el.getAttribute('data-suffix') || '');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = Number(entry.target.getAttribute('data-counter'));
          var duration = Number(entry.target.getAttribute('data-duration') || 1400);
          var suffix = entry.target.getAttribute('data-suffix') || '';
          animateCounter(entry.target, target, duration, suffix);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ── 4. Tilt léger sur cartes (data-tilt) ──
  function initTilt() {
    if (reduced) return;
    var cards = document.querySelectorAll('[data-tilt]');
    cards.forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform =
          'perspective(900px) rotateY(' + (x * 4) + 'deg) rotateX(' + (-y * 4) + 'deg) translateY(-3px)';
      });
      c.addEventListener('mouseleave', function () { c.style.transform = ''; });
    });
  }

  // ── 5. Parallax discret (data-parallax="0.2") ──
  function initParallax() {
    if (reduced) return;
    var els = document.querySelectorAll('[data-parallax]');
    if (!els.length) return;
    var raf = null;
    function tick() {
      var y = window.scrollY;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.2;
        el.style.transform = 'translate3d(0,' + (y * speed) + 'px,0)';
      });
      raf = null;
    }
    window.addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  // ── 6. Rotation de mots (data-rotate="A|B|C") ──
  // Reste inline pour ne pas casser le flow du titre ; fade opacity seulement.
  function initRotateWords() {
    var els = document.querySelectorAll('[data-rotate]');
    els.forEach(function (el) {
      var words = el.getAttribute('data-rotate').split('|');
      if (!words.length) return;
      var i = 0;
      el.textContent = words[0];
      el.style.transition = 'opacity .3s ease';
      el.style.willChange = 'opacity';
      if (reduced) return;
      setInterval(function () {
        el.style.opacity = '0';
        setTimeout(function () {
          i = (i + 1) % words.length;
          el.textContent = words[i];
          el.style.opacity = '1';
        }, 300);
      }, 2800);
    });
  }

  // ── 7. Toggle comparatif (data-toggle-on / data-toggle-off) ──
  function initCompareToggle() {
    var buttons = document.querySelectorAll('[data-toggle-target]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetSel = btn.getAttribute('data-toggle-target');
        var target = document.querySelector(targetSel);
        if (!target) return;
        var isOn = target.classList.toggle('on');
        btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        btn.querySelectorAll('[data-label-on]').forEach(function (l) { l.style.display = isOn ? '' : 'none'; });
        btn.querySelectorAll('[data-label-off]').forEach(function (l) { l.style.display = isOn ? 'none' : ''; });
      });
    });
  }

  // ── 8. Smooth scroll sur ancres internes (si pas déjà via CSS) ──
  function initSmoothAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;
      var el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // ── Boot ──
  function boot() {
    initScrollProgress();
    initReveal();
    initCounters();
    initTilt();
    initParallax();
    initRotateWords();
    initCompareToggle();
    initSmoothAnchors();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

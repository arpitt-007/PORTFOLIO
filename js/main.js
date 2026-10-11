/* UI behaviour: nav, reveals, tilt, magnetic buttons, clock, contact form. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ── Hero entrance (starts immediately; nothing waits on assets) ──
  var hero = $('#hero-content');
  var heroMeta = $('.hero-meta');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      [hero, heroMeta, $('.scroll-cue')].forEach(function (el) { if (el) el.classList.add('is-ready'); });
    });
  });

  // ── Nav ──
  var nav = $('#nav');
  var toggle = $('#nav-toggle');
  var links = $('#nav-links');
  function closeMenu() {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && links.classList.contains('open')) { closeMenu(); toggle.focus(); }
  });
  var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Active section highlight
  var navAnchors = $$('.nav-links a');
  var sectionMap = {};
  navAnchors.forEach(function (a) { sectionMap[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      navAnchors.forEach(function (a) { a.classList.remove('active'); });
      var a = sectionMap[en.target.id];
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(sectionMap).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });

  // ── Scroll reveals (one pattern; siblings stagger by DOM order) ──
  var revealEls = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.setProperty('--d', Math.min(batch++ * 0.08, 0.4) + 's');
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  // ── 3D tilt on project panels (fine pointers only) ──
  if (fine && !reduced) {
    $$('[data-tilt]').forEach(function (el) {
      var panel = $('.panel', el);
      var raf = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 6).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 8).toFixed(2) + 'deg)';
          if (panel) { panel.style.setProperty('--mx', (x * 100) + '%'); panel.style.setProperty('--my', (y * 100) + '%'); }
        });
      });
      el.addEventListener('pointerleave', function () {
        cancelAnimationFrame(raf);
        el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 650);
      });
    });

    // Magnetic buttons: small pull toward the pointer
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  // ── Clock (India time) ──
  var clock = $('#clock');
  function tick() {
    try {
      clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';
    } catch (e) { clock.textContent = ''; }
  }
  tick();
  setInterval(function () { if (!document.hidden) tick(); }, 15000);

  // ── Contact form ──
  var form = $('#contact-form');
  var btn = $('#submit-btn');
  var statusEl = $('#form-msg');
  var rules = {
    from_name:   { id: 'e-name',   msg: 'Please enter your name.' },
    from_role:   { id: 'e-role',   msg: 'Please enter your role.' },
    reply_to:    { id: 'e-email',  msg: 'Please enter a valid email address.' },
    from_status: { id: 'e-status', msg: 'Please choose an option.' },
    message:     { id: 'e-msg',    msg: 'Please write a short message.' }
  };
  function valid(el) {
    var v = el.value.trim();
    if (!v) return false;
    if (el.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return true;
  }
  function check(el) {
    var rule = rules[el.name];
    var ok = valid(el);
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    document.getElementById(rule.id).textContent = ok ? '' : rule.msg;
    return ok;
  }
  Object.keys(rules).forEach(function (n) {
    var el = form.elements[n];
    el.addEventListener('blur', function () { check(el); });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(el); });
  });

  function setStatus(cls, text) { statusEl.className = 'form-status ' + cls; statusEl.textContent = text; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var firstBad = null;
    Object.keys(rules).forEach(function (n) {
      var el = form.elements[n];
      if (!check(el) && !firstBad) firstBad = el;
    });
    if (firstBad) { setStatus('err', 'Please fix the highlighted fields.'); firstBad.focus(); return; }

    var params = {
      from_name:   form.elements.from_name.value.trim(),
      from_role:   form.elements.from_role.value.trim(),
      reply_to:    form.elements.reply_to.value.trim(),
      from_status: form.elements.from_status.value,
      message:     form.elements.message.value.trim(),
      to_email:    'arpitkarna8a@gmail.com'
    };

    btn.disabled = true;
    setStatus('', 'Sending…');
    var label = btn.innerHTML;
    btn.firstChild.textContent = 'Sending… ';

    Promise.resolve()
      .then(function () {
        if (!window.emailjs) throw new Error('EmailJS not loaded');
        window.emailjs.init({ publicKey: 'LMxfw9sBKAKkDXO0o' });
        return window.emailjs.send('service_hdctlgd', 'template_88mfdsa', params);
      })
      .then(function () {
        setStatus('ok', "Message sent. I'll be in touch soon.");
        form.reset();
      })
      .catch(function (err) {
        console.error('EmailJS error:', err);
        setStatus('err', 'Could not send. Please email arpitkarna8a@gmail.com directly.');
      })
      .then(function () { btn.disabled = false; btn.innerHTML = label; });
  });
})();

/* ============================================================
   Frank Interior Contractor — interactions
   ============================================================ */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Motion One (progressive enhancement) ----------
     If the library is missing or the user prefers reduced motion, every
     feature below falls back to an instant state swap. */
  var motionAnimate = (typeof window.Motion === 'object' && window.Motion)
    ? window.Motion.animate
    : null;

  function motionOK() {
    return !!motionAnimate && !reduced &&
      typeof Element !== 'undefined' &&
      typeof Element.prototype.getAnimations === 'function';
  }

  function stopMotion(el) {
    if (!el.getAnimations) return;
    var running = el.getAnimations();
    for (var i = 0; i < running.length; i++) {
      try { running[i].cancel(); } catch (e) {}
    }
  }

  function onFinished(anim, cb) {
    if (anim && anim.finished && typeof anim.finished.then === 'function') {
      anim.finished.then(cb, cb);
    } else {
      window.setTimeout(cb, 400);
    }
  }

  /* ---------- sticky header ---------- */
  var header = document.querySelector('.site-header');
  var toTop = document.getElementById('toTop');
  var waFloat = document.querySelector('.wa-float');
  var onScroll = function () {
    header.classList.toggle('scrolled', window.scrollY > 40);
    if (waFloat) waFloat.classList.toggle('is-visible', window.scrollY < window.innerHeight * 0.75);
    if (toTop) {
      if (window.scrollY > window.innerHeight * 0.9) toTop.classList.add('is-visible');
      else toTop.classList.remove('is-visible');
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- back-to-top button ----------
     Registered before the generic anchor handler below so it wins the
     event: the generic one offsets by the fixed header height, which
     would stop short of the very top. */
  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#top');
    });
  }

  /* ---------- mobile nav ---------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');

  function closeNav() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('nav-open');
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeNav();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---------- smooth anchors with fixed-header offset ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 12;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- scroll reveals ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

/* ---------- hero slideshow ---------- */
  var slides = Array.prototype.slice.call(document.querySelectorAll('.hero-slide'));
  var dotsWrap = document.getElementById('heroDots');
  var current = 0;
  var timer = null;

  slides.forEach(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Show hero image ' + (i + 1));
    b.addEventListener('click', function () { go(i); restart(); });
    dotsWrap.appendChild(b);
  });
  var dots = Array.prototype.slice.call(dotsWrap.children);

  function go(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === current); });
    dots.forEach(function (d, n) {
      d.classList.toggle('is-active', n === current);
      d.setAttribute('aria-selected', String(n === current));
    });
  }
  function start() { if (!reduced && slides.length > 1) timer = setInterval(function () { go(current + 1); }, 6000); }
  function restart() { clearInterval(timer); start(); }

  go(0);
  start();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clearInterval(timer); else restart();
  });

  /* ---------- work filters (Motion One + FLIP) ----------
     Exit: fade cards out fast. Enter: FLIP the staying cards into their new
     grid slots and stagger the returning ones in. Falls back to an instant
     swap when Motion is unavailable or reduced motion is requested. */
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('#workFilters .filter'));
  var workCards = Array.prototype.slice.call(document.querySelectorAll('#workGrid .work-card'));
  var filterGen = 0;

  function matchesFilter(card, key) {
    return key === 'all' || card.getAttribute('data-category') === key;
  }

  function instantFilter(key) {
    workCards.forEach(function (card) {
      stopMotion(card);
      card.style.opacity = '';
      card.style.transform = '';
      card.classList.toggle('is-hidden', !matchesFilter(card, key));
      if (matchesFilter(card, key)) card.classList.add('in');
    });
  }

  function applyFilter(key) {
    var gen = ++filterGen;

    if (!motionOK()) { instantFilter(key); return; }

    // finish helper: release inline styles + fill, then settle on CSS state.
    // Stale animations (superseded clicks) bail out via the generation guard.
    function runAnim(el, keyframes, opts, done) {
      // Motion commits final keyframes to inline styles when it finishes;
      // clear leftovers from any previous run BEFORE animating, and defer the
      // post-finish clear so it lands after Motion's own commit (race-safe).
      el.style.opacity = '';
      el.style.transform = '';
      var anim = motionAnimate(el, keyframes, opts);
      onFinished(anim, function () {
        if (gen !== filterGen) return;
        if (done) done();
        window.setTimeout(function () {
          if (gen !== filterGen) return;
          el.style.opacity = '';
          el.style.transform = '';
          stopMotion(el);
        }, 0);
      });
      return anim;
    }

    var leaving = [], entering = [], staying = [];
    workCards.forEach(function (card) {
      var match = matchesFilter(card, key);
      var hidden = card.classList.contains('is-hidden');
      if (match) {
        card.classList.add('in');
        (hidden ? entering : staying).push(card);
      } else if (!hidden) {
        leaving.push(card);
      }
    });

    // FLIP first: remember where staying cards sit under the current layout,
    // and retarget any card that was mid-exit when the user clicked again.
    var first = staying.map(function (card) {
      var op = parseFloat(window.getComputedStyle(card).opacity);
      stopMotion(card);
      if (op < 0.99 && isFinite(op)) {
        runAnim(card, { opacity: [op, 1] }, { duration: 0.18, ease: 'easeOut' });
      }
      return { card: card, rect: card.getBoundingClientRect() };
    });

    // Phase 1 — fade the leaving cards out (fast: exit should snap).
    var pending = leaving.length;
    function phase2() {
      if (gen !== filterGen) return;

      // Apply final visibility: hide leavers (already faded), reveal entrants.
      // Opacity is pinned to 0 while they are still display:none so the
      // staggered delays below can never flash the card at full opacity.
      leaving.forEach(function (card) {
        card.classList.add('is-hidden');
        stopMotion(card);
        card.style.opacity = '';
        card.style.transform = '';
      });
      entering.forEach(function (card) { card.style.opacity = '0'; });
      entering.forEach(function (card) { card.classList.remove('is-hidden'); });

      // FLIP play: glide staying cards from their old slots to the new ones.
      first.forEach(function (entry) {
        var last = entry.card.getBoundingClientRect();
        var dx = entry.rect.left - last.left;
        var dy = entry.rect.top - last.top;
        if (dx || dy) {
          runAnim(entry.card,
            { transform: ['translate(' + dx + 'px, ' + dy + 'px)', 'translate(0px, 0px)'] },
            { duration: 0.3, ease: 'easeOut' });
        }
      });

      // Staggered entrance, 40ms apart (Emil: 30–80ms, never blocking).
      entering.forEach(function (card, i) {
        window.setTimeout(function () {
          if (gen !== filterGen) return;
          runAnim(card,
            { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
            { duration: 0.28, ease: 'easeOut' });
        }, Math.min(i, 6) * 40);
      });
    }

    if (pending === 0) { phase2(); }
    leaving.forEach(function (card) {
      stopMotion(card);
      var op = parseFloat(window.getComputedStyle(card).opacity);
      if (!isFinite(op)) op = 1;
      if (op <= 0.01) {
        pending -= 1;
        if (pending === 0) phase2();
        return;
      }
      runAnim(card, { opacity: [op, 0] }, { duration: 0.15, ease: 'easeOut' }, function () {
        pending -= 1;
        if (pending === 0) phase2();
      });
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-filter');
      filterBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      try {
        applyFilter(key);
      } catch (e) {
        instantFilter(key);
      }
    });
  });

  /* ---------- testimonials carousel (swipe + arrows + dots) ----------
     Pointer-event drag with axis detection (vertical scroll always wins),
     clamped ends, keyboard support. No autoplay; reduced motion gets an
     instant swap from the global transition override in the stylesheet. */
  var tRoot = document.getElementById('tCarousel');
  if (tRoot) {
    var tViewport = document.getElementById('tViewport');
    var tTrack = document.getElementById('tTrack');
    var tSlides = Array.prototype.slice.call(tTrack.children);
    var tDotsWrap = document.getElementById('tDots');
    var tPrev = document.getElementById('tPrev');
    var tNext = document.getElementById('tNext');
    var tIndex = 0;
    var tWidth = 0;

    function tMeasure() { tWidth = tViewport.clientWidth; }

    function tGo(i, animate) {
      tIndex = Math.max(0, Math.min(tSlides.length - 1, i));
      if (!tWidth) tMeasure();
      tTrack.style.transition = animate === false ? 'none' : '';
      tTrack.style.transform = 'translate3d(' + (-tIndex * tWidth) + 'px,0,0)';

      tSlides.forEach(function (s, n) {
        var on = n === tIndex;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      Array.prototype.forEach.call(tDotsWrap.children, function (d, n) {
        var on = n === tIndex;
        d.classList.toggle('is-active', on);
        if (on) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      tPrev.disabled = tIndex === 0;
      tNext.disabled = tIndex === tSlides.length - 1;
    }

    tSlides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show testimonial ' + (i + 1) + ' of ' + tSlides.length);
      b.addEventListener('click', function () { tGo(i, true); });
      tDotsWrap.appendChild(b);
    });

    tPrev.addEventListener('click', function () { tGo(tIndex - 1, true); });
    tNext.addEventListener('click', function () { tGo(tIndex + 1, true); });

    tRoot.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); tGo(tIndex - 1, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); tGo(tIndex + 1, true); }
    });

    /* swipe / drag */
    var dragging = false;
    var dragId = null;
    var axis = null;
    var decided = false;
    var startX = 0;
    var startY = 0;
    var baseX = 0;
    var dx = 0;

    tViewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      decided = false;
      axis = null;
      dragId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      baseX = -tIndex * tWidth;
      dx = 0;
    });

    tViewport.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== dragId) return;
      var mx = e.clientX - startX;
      var my = e.clientY - startY;

      if (!decided) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        decided = true;
        if (Math.abs(mx) <= Math.abs(my)) { dragging = false; return; } // vertical: let the page scroll
        axis = 'x';
        tViewport.classList.add('is-dragging');
        tTrack.style.transition = 'none';
        try { tViewport.setPointerCapture(dragId); } catch (err) {}
      }
      if (axis !== 'x') return;

      dx = mx;
      if ((tIndex === 0 && dx > 0) || (tIndex === tSlides.length - 1 && dx < 0)) dx *= 0.3; // rubber-band
      tTrack.style.transform = 'translate3d(' + (baseX + dx) + 'px,0,0)';
      e.preventDefault();
    });

    function tEndDrag(e) {
      if (!dragging || (e && e.pointerId !== dragId)) return;
      dragging = false;
      try { tViewport.releasePointerCapture(dragId); } catch (err) {}
      if (axis === 'x') {
        tViewport.classList.remove('is-dragging');
        var step = Math.abs(dx) > Math.min(80, tWidth * 0.18) ? (dx < 0 ? 1 : -1) : 0;
        tGo(tIndex + step, true); // clears inline transition → animates to the snap point
      }
      dragId = null;
      axis = null;
      dx = 0;
    }
    tViewport.addEventListener('pointerup', tEndDrag);
    tViewport.addEventListener('pointercancel', tEndDrag);

    var tRaf = 0;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(tRaf);
      tRaf = requestAnimationFrame(function () { tMeasure(); tGo(tIndex, false); });
    });
    window.addEventListener('load', function () { tMeasure(); tGo(tIndex, false); });

    tMeasure();
    tGo(0, false);
  }

  /* ---------- quote form (demo only) ---------- */
  var form = document.getElementById('quoteForm');
  var success = form.querySelector('.form-success');

  function setError(name, msg) {
    var input = form.querySelector('[name="' + name + '"]');
    var slot = form.querySelector('[data-err="' + name + '"]');
    var field = input.closest('.field');
    field.classList.toggle('invalid', !!msg);
    if (slot) slot.textContent = msg || '';
    return !msg;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    ok = setError('name', form.name.value.trim() ? '' : 'Please enter your name.') && ok;
    ok = setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()) ? '' : 'Please enter a valid email address.') && ok;
    ok = setError('msg', form.msg.value.trim().length > 10 ? '' : 'Tell us a little about the project (10+ characters).') && ok;

    if (!ok) return;

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    // NOTE: demo only — nothing leaves the browser. Wire this to your email
    // service or form endpoint before going live.
    setTimeout(function () {
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Request my free estimate';
      success.textContent = 'Thanks! This is a demo form — connect it to your inbox to start receiving real enquiries.';
      success.classList.add('show');
      // Rare moment (success state) — eligible for the delight budget.
      if (motionOK()) {
        stopMotion(success);
        try {
          motionAnimate(success,
            { opacity: [0, 1], transform: ['translateY(8px) scale(.98)', 'translateY(0px) scale(1)'] },
            { duration: 0.32, ease: 'easeOut' });
        } catch (e) { /* CSS state already applied */ }
      }
      setTimeout(function () {
        if (motionOK()) {
          stopMotion(success);
          var out;
          try {
            out = motionAnimate(success,
              { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(-6px)'] },
              { duration: 0.2, ease: 'easeOut' });
          } catch (e) { out = null; }
          onFinished(out, function () {
            success.classList.remove('show');
            // Motion may commit final keyframes inline after finish — clear deferred.
            window.setTimeout(function () {
              success.style.opacity = '';
              success.style.transform = '';
            }, 0);
          });
        } else {
          success.classList.remove('show');
        }
      }, 8000);
    }, 700);
  });

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field');
    if (field && field.classList.contains('invalid')) setError(e.target.name, '');
  });

  /* ---------- footer year ---------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
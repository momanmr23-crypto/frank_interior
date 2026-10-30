/* Frank Interior Contractor 2 — motion engine (Lenis + GSAP)
   Handles: preloader, cursor, smooth scroll, reveals, LPAS-style
   pinned horizontal showcase (hero + market panels), counters,
   marquee, nav + fullscreen menu. */
(function () {
  'use strict'

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var hasGSAP = typeof window.gsap !== 'undefined'
  var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined'
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  var loader = document.getElementById('loader')

  var yearEl = document.getElementById('year')
  if (yearEl) yearEl.textContent = new Date().getFullYear()

  if (hasST) gsap.registerPlugin(ScrollTrigger)

  /* ---------- smooth scroll (Lenis) ---------- */
  var lenis = null
  if (!reduceMotion && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true })
    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(function (time) { lenis.raf(time * 1000) })
      gsap.ticker.lagSmoothing(0)
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf) }
      requestAnimationFrame(raf)
    }
  }

  /* anchor links routed through Lenis */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href')
      if (!id || id === '#') return
      var target = document.querySelector(id)
      if (!target) return
      e.preventDefault()
      closeNav()
      if (lenis) lenis.scrollTo(target, { offset: -10 })
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    })
  })

  /* ---------- preloader: method words → wordmark hand-off ---------- */
  var loaderWords = document.getElementById('loaderWords')
  var loaderMark = document.getElementById('loaderMark')
  var brandTarget = document.querySelector('.brand-text strong')

  function markReady() {
    var n = document.getElementById('nav')
    if (n) n.classList.add('is-ready')
  }
  function finishLoad() {
    /* snap the nav logo visible exactly where the flying wordmark lands */
    var b = document.querySelector('.brand')
    if (b) { b.style.transition = 'none'; b.style.opacity = '1' }
    if (loader) loader.style.display = 'none'
    document.body.classList.add('is-loaded')
    document.body.classList.remove('is-loading')
    markReady()
    heroIn()
    setTimeout(function () { if (b) b.style.transition = '' }, 80)
  }

  if (reduceMotion || !hasGSAP || !loader) {
    if (loader) loader.style.display = 'none'
    finishLoad()
  } else {
    document.body.classList.add('is-loading')
    var words = loaderWords ? loaderWords.querySelectorAll('.lw') : []
    var tl = gsap.timeline()
    /* 1 — the four method words fade in, calmly staggered */
    tl.fromTo(words, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 0.1)
    /* 2 — the stack clears */
    tl.to(words, { autoAlpha: 0, duration: 0.3, stagger: 0.04, ease: 'power1.in' }, 1.25)
    /* 3 — the wordmark takes the stack's place */
    tl.fromTo(loaderMark, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' }, 1.6)
    /* 4 — background clears, nav (Menu pill) fades in */
    tl.add(markReady, 1.95)
    tl.to(loader, {
      backgroundColor: 'rgba(38,38,38,0)', duration: 0.6, ease: 'power2.inOut',
      onStart: function () { loader.style.pointerEvents = 'none' }
    }, 1.95)
    /* 5 — the wordmark flies to the header corner (FLIP) */
    tl.add(function () {
      if (!loaderMark || !brandTarget) return
      var from = loaderMark.getBoundingClientRect()
      var to = brandTarget.getBoundingClientRect()
      if (from.height > 0 && to.height > 0) {
        gsap.set(loaderMark, { transformOrigin: 'left top' })
        gsap.to(loaderMark, {
          x: to.left - from.left,
          y: to.top - from.top,
          scale: to.height / from.height,
          duration: 0.85,
          ease: 'power3.inOut'
        })
      }
    }, 2.0)
    /* 6 — hand-off complete */
    tl.add(finishLoad, 2.95)
  }

  /* failsafe: never trap the user behind the curtain */
  setTimeout(function () {
    if (!document.body.classList.contains('is-loaded')) {
      document.querySelectorAll('.hero-title .word, .hero-label, .scroll-cue').forEach(function (el) {
        el.style.opacity = 1
        el.style.transform = 'none'
      })
      document.querySelectorAll('[data-reveal]').forEach(function (el) {
        el.style.opacity = 1
        el.style.transform = 'none'
      })
      finishLoad()
    }
  }, 4600)

  /* ---------- custom cursor ---------- */
  var cursor = document.getElementById('cursor')
  if (cursor && finePointer && !reduceMotion && hasGSAP) {
    var dot = cursor.querySelector('.cursor-dot')
    var ring = cursor.querySelector('.cursor-ring')
    var xSet = gsap.quickSetter(dot, 'x', 'px')
    var ySet = gsap.quickSetter(dot, 'y', 'px')
    var rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' })
    var ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' })
    window.addEventListener('pointermove', function (e) {
      xSet(e.clientX)
      ySet(e.clientY)
      rx(e.clientX)
      ry(e.clientY)
    })
    document.querySelectorAll('[data-cursor="view"]').forEach(function (el) {
      el.addEventListener('pointerenter', function () { cursor.classList.add('is-view') })
      el.addEventListener('pointerleave', function () { cursor.classList.remove('is-view') })
    })
  }

  /* ---------- hero intro: fades + a slow, calm hero ---------- */
  function heroIn() {
    if (reduceMotion || !hasGSAP) {
      /* no animation path: unmask the headline so it is never hidden */
      document.querySelectorAll('.hero-title .word, .hero-label, .scroll-cue').forEach(function (el) { el.style.opacity = 1 })
      return
    }
    var words = document.querySelectorAll('.hero-title .word')
    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
    /* slow hero: a long, quiet image settle (no punchy zoom) */
    tl.fromTo('.hero-media img', { scale: 1.1 }, { scale: 1, duration: 5, ease: 'power2.out' }, 0)
    tl.fromTo('.hero-label', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, stagger: 0.12 }, 0.15)
    tl.fromTo(words, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.25, stagger: 0.06 }, 0.35)
    tl.fromTo('.scroll-cue', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9 }, 0.9)
  }

  if (hasST && !reduceMotion) {
    /* ---------- scroll reveals ---------- */
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      var delay = (parseInt(el.getAttribute('data-delay') || '0', 10)) * 0.08
      gsap.to(el, {
        autoAlpha: 1, y: 0, duration: 0.95, delay: delay, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      })
    })

    /* ---------- word-mask split reveals ---------- */
    gsap.utils.toArray('[data-split]').forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/)
      el.innerHTML = words.map(function (w) {
        return '<span class="sw"><span class="split-word">' + w + '</span></span>'
      }).join(' ')
      gsap.fromTo(el.querySelectorAll('.split-word'),
        { yPercent: 115 },
        {
          yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.055,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        })
    })

    /* ---------- parallax ---------- */
    gsap.utils.toArray('[data-parallax]').forEach(function (el) {
      var amt = parseFloat(el.getAttribute('data-parallax')) || 0.2
      gsap.fromTo(el, { yPercent: -amt * 40 }, {
        yPercent: amt * 40, ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true }
      })
    })

    /* ---------- image mask wipes ---------- */
    gsap.utils.toArray('.work-card-media, .panel-media').forEach(function (media) {
      gsap.fromTo(media, { clipPath: 'inset(0% 0% 100% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut',
        scrollTrigger: { trigger: media, start: 'top 88%', once: true }
      })
      var img = media.querySelector('img')
      if (img) {
        gsap.fromTo(img, { scale: 1.25 }, {
          scale: 1, duration: 1.35, ease: 'power3.out',
          scrollTrigger: { trigger: media, start: 'top 88%', once: true }
        })
      }
    })

    /* ---------- stat counters ---------- */
    document.querySelectorAll('.count').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0
      var obj = { v: 0 }
      gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: function () { el.textContent = Math.round(obj.v) }
      })
    })
  } else {
    /* reduced motion / no ScrollTrigger: show everything */
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.style.opacity = 1
      el.style.transform = 'none'
    })
  }

  /* ---------- marquee ---------- */
  var marquee = document.getElementById('marqueeTrack')
  if (marquee && hasST && hasGSAP && !reduceMotion) {
    var loop = gsap.to(marquee, { xPercent: -50, duration: 18, ease: 'none', repeat: -1 })
    ScrollTrigger.create({
      trigger: marquee, start: 'top bottom', end: 'bottom top',
      onEnter: function () { loop.play() },
      onLeave: function () { loop.pause() },
      onEnterBack: function () { loop.play() },
      onLeaveBack: function () { loop.pause() }
    })
  }

  /* ---------- nav + fullscreen menu ---------- */
  var nav = document.getElementById('nav')
  var navLinks = document.getElementById('navLinks')
  var navToggle = document.getElementById('navToggle')
  var toTop = document.getElementById('toTop')
  var showcaseST = null

  function onScrollNav(y) {
    if (!nav) return
    var solid
    if (window.matchMedia('(max-width: 900px)').matches || !showcaseST) {
      solid = y > (window.innerHeight * 0.9)
    } else {
      solid = y > showcaseST.end - 140
    }
    if (window.matchMedia('(max-width: 900px)').matches) solid = y > 40
    if (solid) nav.classList.add('is-solid')
    else nav.classList.remove('is-solid')
    if (toTop) {
      if (y > window.innerHeight * 0.9) toTop.classList.add('is-visible')
      else toTop.classList.remove('is-visible')
    }
  }
  if (lenis) lenis.on('scroll', function (e) { onScrollNav(e.scroll) })
  window.addEventListener('scroll', function () { onScrollNav(window.scrollY) }, { passive: true })

  function closeNav() {
    if (!navLinks || !navToggle || !nav) return
    navLinks.classList.remove('is-open')
    nav.classList.remove('is-open')
    navToggle.setAttribute('aria-expanded', 'false')
    navToggle.setAttribute('aria-label', 'Open menu')
    document.body.classList.remove('nav-open')
    if (lenis) lenis.start()
  }

  if (navToggle && navLinks && nav) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('is-open')
      nav.classList.toggle('is-open', open)
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
      document.body.classList.toggle('nav-open', open)
      if (lenis) { if (open) lenis.stop(); else lenis.start() }
      if (open && hasGSAP && !reduceMotion) {
        gsap.fromTo(navLinks.querySelectorAll('.menu-links a'),
          { y: 40, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, delay: 0.2, ease: 'power3.out' })
        gsap.fromTo(navLinks.querySelectorAll('.menu-meta > *'),
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, delay: 0.35, ease: 'power3.out' })
      }
    })
  }

  /* ---------- showcase: hero + pinned horizontal panels (LPAS) ---------- */
  var track = document.getElementById('focusTrack')
  var viewport = document.getElementById('focusViewport')
  var exploreBtn = document.getElementById('exploreBtn')
  var heroCue = document.getElementById('heroCue')
  var focusPill = document.getElementById('focusPill')
  var focusMarket = document.getElementById('focusMarket')
  var markets = ['', 'Fit-out', 'Renovation', 'Joinery', 'Painting', 'Turnkey']
  var slides = track ? Array.prototype.slice.call(track.querySelectorAll('.slide')) : []
  var activeIdx = 0

  function updateFocusPill(i) {
    if (focusMarket) focusMarket.textContent = markets[i] || ''
    if (focusPill) {
      focusPill.classList.toggle('has-market', !!markets[i])
      focusPill.querySelectorAll('.swatches i').forEach(function (s) {
        s.classList.toggle('is-on', parseInt(s.getAttribute('data-sw'), 10) === i)
      })
    }
  }

  function setActive(i) {
    activeIdx = i
    slides.forEach(function (s, idx) { s.classList.toggle('is-active', idx === i) })
    updateFocusPill(i)
  }

  function updateExplore() {
    if (!exploreBtn) return
    var on = !!(showcaseST && showcaseST.isActive)
    exploreBtn.classList.toggle('is-on', on)
  }

  function scrollToSlide(i) {
    if (!slides[i]) return
    if (showcaseST && track) {
      var d = Math.max(1, track.scrollWidth - window.innerWidth)
      /* stop with the slide occupying the right ~70% of the viewport (LPAS feel) */
      var targetX = Math.max(0, slides[i].offsetLeft - window.innerWidth * 0.3)
      var prog = Math.min(1, targetX / d)
      var y = showcaseST.start + (showcaseST.end - showcaseST.start) * prog
      if (lenis) lenis.scrollTo(y, { duration: 1.5 })
      else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' })
    } else {
      slides[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }

  function advance() {
    if (activeIdx < slides.length - 1) {
      scrollToSlide(activeIdx + 1)
    } else {
      var statement = document.getElementById('statement')
      if (statement) {
        if (lenis) lenis.scrollTo(statement, { offset: -10 })
        else statement.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
      }
    }
  }

  if (exploreBtn) exploreBtn.addEventListener('click', advance)
  if (focusPill) focusPill.addEventListener('click', advance)
  if (heroCue) {
    heroCue.addEventListener('click', function () { scrollToSlide(1) })
  }

  if (track && viewport && hasST && !reduceMotion) {
    var mm = gsap.matchMedia()
    mm.add('(min-width: 901px)', function () {
      var getDistance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth)
      }
      var tween = gsap.to(track, {
        x: function () { return -getDistance() },
        ease: 'none',
        scrollTrigger: {
          trigger: viewport,
          start: 'top top',
          end: function () { return '+=' + getDistance() },
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onToggle: updateExplore,
          onUpdate: function (self) {
            var d = getDistance()
            var x = self.progress * d
            var w = window.innerWidth
            var idx = 0
            slides.forEach(function (s, i) {
              if (s.offsetLeft - x < w * 0.6) idx = i
            })
            setActive(idx)
            updateExplore()
          }
        }
      })
      showcaseST = tween.scrollTrigger
      setActive(0)
      onScrollNav(window.scrollY)
      return function () {
        if (tween.scrollTrigger) tween.scrollTrigger.kill()
        tween.kill()
        gsap.set(track, { x: 0 })
        showcaseST = null
        setActive(0)
        updateExplore()
      }
    })
  }

  /* recalc positions once images have loaded */
  window.addEventListener('load', function () {
    if (hasST) ScrollTrigger.refresh()
    onScrollNav(window.scrollY)
  })
})();


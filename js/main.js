/* =====================================================================
   POMPEYA — Scrollytelling
   Interacciones: reveal, parallax, línea de tiempo horizontal,
   ceniza, contador y tipografía conceptual (texto como imagen).
   Sin dependencias externas.
   ===================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  /* Un único bucle de scroll (rAF) que despacha a los módulos suscritos */
  var scrollCbs = [];
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      for (var i = 0; i < scrollCbs.length; i++) scrollCbs[i]();
      ticking = false;
    });
  }
  var resizeCbs = [];
  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      for (var i = 0; i < resizeCbs.length; i++) resizeCbs[i]();
      onScroll();
    }, 150);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  /* ------------------------------------------------------------------ */
  /* 1. Tipografía conceptual: dividir en letras (texto como imagen)     */
  /* ------------------------------------------------------------------ */
  function splitText() {
    if (reduceMotion) return;
    var nodes = document.querySelectorAll("[data-split]");
    nodes.forEach(function (el) {
      el.classList.remove("reveal");
      var text = el.textContent;
      el.textContent = "";
      var idx = 0;
      var words = text.split(" ");
      for (var w = 0; w < words.length; w++) {
        if (w > 0) el.appendChild(document.createTextNode(" "));
        var word = words[w];
        // Cada palabra en un contenedor inline-block para que no se parta mid-word
        var wordWrap = document.createElement("span");
        wordWrap.style.cssText = "display:inline-block;white-space:nowrap";
        for (var i = 0; i < word.length; i++) {
          var span = document.createElement("span");
          span.className = "ch";
          span.textContent = word[i];
          span.style.transitionDelay = Math.min(idx, 42) * 0.028 + "s";
          wordWrap.appendChild(span);
          idx++;
        }
        el.appendChild(wordWrap);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2. Reveal al entrar en viewport (IntersectionObserver)              */
  /* ------------------------------------------------------------------ */
  function initReveal() {
    var targets = document.querySelectorAll(".reveal, [data-split], .tl-item");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Indicadores: progreso superior, profundidad y masthead           */
  /* ------------------------------------------------------------------ */
  function initIndicators() {
    var bar = document.querySelector(".scroll-progress__bar");
    var masthead = document.querySelector(".masthead");

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
      if (masthead) masthead.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    scrollCbs.push(update);
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Navegación por estratos — capa actual + barra de progreso           */
  /* ------------------------------------------------------------------ */
  function initStrata() {
    var nav = document.querySelector(".strata");
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll(".strata__link"));
    var hintTimer = null;

    function setCurrent(id) {
      links.forEach(function (l) {
        var isCur = l.getAttribute("href") === id;
        l.classList.toggle("is-current", isCur);
        if (!isCur) l.classList.remove("is-hint-out");
        else l.classList.remove("is-hint-out"); // reaparece al (re)entrar
      });
      // La etiqueta-guía se muestra y se desvanece sola a los 3 s
      clearTimeout(hintTimer);
      if (!reduceMotion) {
        hintTimer = setTimeout(function () {
          var cur = nav.querySelector(".strata__link.is-current");
          if (cur) cur.classList.add("is-hint-out");
        }, 3000);
      }
    }

    // Estrato actual: la sección que cruza el centro del viewport
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          setCurrent("#" + en.target.id);
        });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

      links.forEach(function (l) {
        var sec = document.getElementById(l.getAttribute("href").slice(1));
        if (sec) io.observe(sec);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 4. Parallax sutil en imágenes de fondo                              */
  /* ------------------------------------------------------------------ */
  function initParallax() {
    if (reduceMotion) return;
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
    if (!els.length) return;

    function update() {
      var winH = window.innerHeight;
      els.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > winH + 200) return; // fuera de vista
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var elCenter = rect.top + rect.height / 2;
        var fromCenter = clamp((elCenter - winH / 2) / winH, -0.6, 0.6);
        var y = -fromCenter * rect.height * speed;
        el.style.transform = "translate3d(0," + y.toFixed(1) + "px,0)";
      });
    }
    scrollCbs.push(update);
    update();
  }

  /* ------------------------------------------------------------------ */
  /* 5. Línea de tiempo horizontal controlada por scroll (desktop)       */
  /* ------------------------------------------------------------------ */
  function initTimeline() {
    var section = document.querySelector(".timeline");
    if (!section) return;
    var track = section.querySelector(".timeline__track");
    var railFill = section.querySelector(".timeline__rail-fill");
    var mq = window.matchMedia("(min-width: 880px)");
    var enabled = false;
    var distance = 0;

    function measure() {
      if (!enabled) {
        section.style.height = "";
        return;
      }
      distance = Math.max(0, track.scrollWidth - window.innerWidth);
      section.style.height = window.innerHeight + distance + "px";
    }

    function update() {
      if (!enabled) return;
      var rect = section.getBoundingClientRect();
      var total = section.offsetHeight - window.innerHeight;
      var progress = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
      track.style.transform = "translate3d(" + -(progress * distance).toFixed(1) + "px,0,0)";
      if (railFill) railFill.style.width = (progress * 100).toFixed(1) + "%";
    }

    function refresh() {
      enabled = mq.matches && !reduceMotion;
      if (!enabled) {
        track.style.transform = "";
        if (railFill) railFill.style.width = "";
        section.style.height = "";
      }
      measure();
      update();
    }

    scrollCbs.push(update);
    resizeCbs.push(refresh);
    if (mq.addEventListener) mq.addEventListener("change", refresh);
    else if (mq.addListener) mq.addListener(refresh);
    // Recalcular cuando carguen fuentes/imágenes (cambia el ancho del track)
    window.addEventListener("load", refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

    refresh();
  }

  /* ------------------------------------------------------------------ */
  /* 6. Contador (el dato como imagen): 0 → 1669                         */
  /* ------------------------------------------------------------------ */
  function initCounters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var dur = 1600;
        var start = null;
        function step(ts) {
          if (start === null) start = ts;
          var t = clamp((ts - start) / dur, 0, 1);
          var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
          el.textContent = Math.round(eased * target);
          if (t < 1) requestAnimationFrame(step);
          else el.textContent = target;
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ */
  /* 7. Ceniza cayendo (atmósfera) — canvas liviano                      */
  /* ------------------------------------------------------------------ */
  function initAsh() {
    if (reduceMotion) return;
    var canvas = document.querySelector(".ash");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, particles = [], running = true, raf;

    function rand(a, b) { return a + Math.random() * (b - a); }

    function build() {
      w = canvas.clientWidth = window.innerWidth;
      h = canvas.clientHeight = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = clamp(Math.round((w * h) / 14000), 40, 120);
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push(makeParticle(true));
      }
    }
    function makeParticle(initial) {
      var ember = Math.random() < 0.08;
      return {
        x: rand(0, w),
        y: initial ? rand(0, h) : rand(-40, 0),
        r: rand(0.6, 2.2),
        vy: rand(0.25, 0.9),
        vx: rand(-0.25, 0.25),
        sway: rand(0, Math.PI * 2),
        swaySpeed: rand(0.005, 0.02),
        alpha: rand(0.15, 0.6),
        ember: ember
      };
    }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.sway += p.swaySpeed;
        p.x += p.vx + Math.sin(p.sway) * 0.3;
        p.y += p.vy;
        if (p.y > h + 10) {
          particles[i] = makeParticle(false);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.ember
          ? "rgba(233,162,59," + p.alpha + ")"
          : "rgba(236,227,214," + p.alpha + ")";
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    build();
    tick();
    resizeCbs.push(build);
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) { cancelAnimationFrame(raf); tick(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* 8. Lava bajo el título — el calor asoma bajo la piedra              */
  /* ------------------------------------------------------------------ */
  function initLavaTitle() {
    var wrap = document.querySelector(".hero__title-wrap");
    if (!wrap || !wrap.querySelector(".hero__title-lava")) return;

    // Foco que sigue al mouse / lápiz (sin depender de media queries)
    var rect = wrap.getBoundingClientRect();
    function cacheRect() { rect = wrap.getBoundingClientRect(); }
    scrollCbs.push(cacheRect);
    resizeCbs.push(cacheRect);

    var active = false, pad = 150;
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var near = e.clientX > rect.left - pad && e.clientX < rect.right + pad &&
                 e.clientY > rect.top - pad && e.clientY < rect.bottom + pad;
      if (near) {
        wrap.style.setProperty("--lava-x", (e.clientX - rect.left).toFixed(0) + "px");
        wrap.style.setProperty("--lava-y", (e.clientY - rect.top).toFixed(0) + "px");
        if (!active) { wrap.classList.add("is-active"); active = true; }
      } else if (active) {
        wrap.classList.remove("is-active");
        active = false;
      }
    }, { passive: true });

    // Pantallas táctiles: destello de lava automático
    if (!reduceMotion) {
      window.addEventListener("touchstart", function onTouch() {
        wrap.classList.add("is-auto");
        window.removeEventListener("touchstart", onTouch);
      }, { passive: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 9. Excavar el molde — slider de revelado (mouse, touch y teclado)   */
  /* ------------------------------------------------------------------ */
  function initExcavate() {
    var root = document.querySelector(".excavate");
    if (!root) return;
    var handle = root.querySelector(".excavate__handle");
    if (!handle) return;
    var MIN = 4, MAX = 96, dig = 30, dragging = false;

    function set(v) {
      dig = clamp(v, MIN, MAX);
      root.style.setProperty("--dig", dig + "%");
      handle.setAttribute("aria-valuenow", Math.round(dig));
    }
    function pctFromX(clientX) {
      var r = root.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    }

    handle.addEventListener("pointerdown", function (e) {
      dragging = true;
      root.classList.add("is-digging");
      if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
      set(pctFromX(e.clientX));
      e.preventDefault();
    });
    handle.addEventListener("pointermove", function (e) {
      if (dragging) set(pctFromX(e.clientX));
    });
    handle.addEventListener("pointerup", function () { dragging = false; });
    handle.addEventListener("pointercancel", function () { dragging = false; });

    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 10 : 4;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { set(dig + step); root.classList.add("is-digging"); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { set(dig - step); root.classList.add("is-digging"); e.preventDefault(); }
      else if (e.key === "Home") { set(MIN); e.preventDefault(); }
      else if (e.key === "End") { set(MAX); e.preventDefault(); }
    });

    set(dig);
  }

  function init() {
    var mods = [splitText, initReveal, initIndicators, initParallax, initTimeline,
                initCounters, initAsh, initLavaTitle, initStrata, initExcavate];
    for (var i = 0; i < mods.length; i++) {
      try { mods[i](); } catch (err) { if (window.console) console.error("[init]", err); }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

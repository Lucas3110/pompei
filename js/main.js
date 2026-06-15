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
      // Conservamos los nodos originales (texto + <br> de saltos forzados)
      var original = Array.prototype.slice.call(el.childNodes);
      el.textContent = "";
      var idx = 0;
      original.forEach(function (node) {
        if (node.nodeType === 1 && node.tagName === "BR") {
          el.appendChild(document.createElement("br"));
          return;
        }
        var words = (node.textContent || "").split(" ").filter(Boolean);
        words.forEach(function (word, w) {
          if (w > 0) el.appendChild(document.createTextNode(" "));
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
        });
      });
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
    var cue = section.querySelector(".timeline__cue");
    var mq = window.matchMedia("(min-width: 880px)");
    var enabled = false;
    var distance = 0;
    var advanceRaf = null;

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
      if (cue) {
        var finished = progress > 0.98;
        cue.classList.toggle("is-finished", finished);
        cue.disabled = finished;
      }
    }

    function advance() {
      if (!enabled || distance <= 0 || (cue && cue.classList.contains("is-advancing"))) return;
      cancelAnimationFrame(advanceRaf);
      var targetY = section.offsetTop + distance;
      // Si el botón ya está visible antes del inicio técnico del sticky,
      // saltamos ese tramo invisible para que la cronología responda al instante.
      var startY = Math.max(window.scrollY, section.offsetTop);
      if (startY !== window.scrollY) window.scrollTo(0, startY);
      var delta = targetY - startY;
      if (Math.abs(delta) < 2) return;

      var previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      // Primer impulso en el mismo evento: elimina la sensación de clic retenido.
      var responseY = Math.min(targetY, startY + Math.max(18, delta * 0.018));
      window.scrollTo(0, responseY);
      startY = responseY;
      delta = targetY - startY;

      var duration = clamp(Math.abs(delta) * 0.55, 950, 1350);
      var startedAt = null;
      if (cue) cue.classList.add("is-advancing");

      function step(ts) {
        if (startedAt === null) startedAt = ts;
        var progress = clamp((ts - startedAt) / duration, 0, 1);
        // Responde de inmediato al clic y frena con suavidad al llegar.
        var eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + delta * eased);
        if (progress < 1) {
          advanceRaf = requestAnimationFrame(step);
        } else {
          if (cue) cue.classList.remove("is-advancing");
          document.documentElement.style.scrollBehavior = previousBehavior;
          update();
        }
      }
      advanceRaf = requestAnimationFrame(step);
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
    if (cue) {
      cue.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        advance();
      });
      cue.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
      });
    }
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
      // clientWidth/clientHeight son de solo lectura: el canvas ya ocupa
      // todo el viewport por CSS (.ash). Sólo leemos las dimensiones.
      w = window.innerWidth;
      h = window.innerHeight;
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
  /* 8. "Ascensor" entre secciones — un gesto te lleva a la siguiente    */
  /*    escena con una animación pronunciada y acompañada.               */
  /*    La línea de tiempo y la ficha técnica son zonas de scroll LIBRE: */
  /*    el ascensor sólo las toma en sus bordes para entrar/salir.       */
  /* ------------------------------------------------------------------ */
  function initElevator() {
    if (reduceMotion) return;
    var main = document.getElementById("contenido");
    if (!main) return;
    var sections = Array.prototype.slice.call(main.children).filter(function (el) {
      return el.tagName === "SECTION";
    });
    if (sections.length < 2) return;

    // Secciones que se leen con scroll nativo (no son "pisos" del ascensor).
    var freeIds = { "linea-de-tiempo": 1, "ficha-tecnica": 1 };
    var EDGE = 6;          // tolerancia (px) para detectar borde de una zona libre
    var COOLDOWN = 180;    // ms de bloqueo tras cada viaje (evita el "spam" del trackpad)

    var animId = null, animating = false, lockUntil = 0;

    function isFree(sec) { return !!freeIds[sec.id]; }
    function curIndex() {
      var probe = window.scrollY + window.innerHeight * 0.5;
      var idx = 0;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= probe) idx = i; else break;
      }
      return idx;
    }
    // Y de destino: entrando a una zona libre hacia ARRIBA se aterriza en su
    // parte de abajo (para recorrerla hacia atrás); en cualquier otro caso, arriba.
    function destY(sec, dir) {
      if (isFree(sec) && dir < 0) {
        return Math.max(0, sec.offsetTop + sec.offsetHeight - window.innerHeight);
      }
      return sec.offsetTop;
    }

    function animateTo(y) {
      cancelAnimationFrame(animId);
      var startY = window.scrollY;
      var dist = Math.round(y) - startY;
      if (Math.abs(dist) < 2) return;
      // Duración proporcional a la distancia, acotada: viaje de "ascensor".
      var dur = clamp(Math.abs(dist) * 0.55, 480, 900);
      var prevBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto"; // controlamos el easing nosotros
      var t0 = null;
      animating = true;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = clamp((ts - t0) / dur, 0, 1);
        // easeInOutCubic: arranca y frena suave (sensación de cabina)
        var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, startY + dist * e);
        if (p < 1) { animId = requestAnimationFrame(step); }
        else {
          animating = false;
          lockUntil = Date.now() + COOLDOWN;
          document.documentElement.style.scrollBehavior = prevBehavior;
        }
      }
      animId = requestAnimationFrame(step);
    }

    function onWheel(e) {
      if (e.ctrlKey) return;                 // zoom del navegador: no interferir
      if (Math.abs(e.deltaY) < 2) return;
      if (animating || Date.now() < lockUntil) { e.preventDefault(); return; }

      var idx = curIndex();
      var sec = sections[idx];
      var dir = e.deltaY > 0 ? 1 : -1;

      if (isFree(sec)) {
        // Dentro de timeline / ficha técnica: scroll nativo, salvo en los bordes.
        var atTop = window.scrollY <= sec.offsetTop + EDGE;
        var atBottom = window.scrollY + window.innerHeight >= sec.offsetTop + sec.offsetHeight - EDGE;
        if (dir > 0 && atBottom && sections[idx + 1]) {
          e.preventDefault(); animateTo(destY(sections[idx + 1], dir));
        } else if (dir < 0 && atTop && sections[idx - 1]) {
          e.preventDefault(); animateTo(destY(sections[idx - 1], dir));
        }
        return; // si no es borde, dejamos el scroll nativo (mueve la línea de tiempo)
      }

      // Piso normal de pantalla completa: un gesto = una sección.
      var target = sections[idx + dir];
      if (target) { e.preventDefault(); animateTo(destY(target, dir)); }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
  }

  /* ------------------------------------------------------------------ */
  /* 9. Excavar el molde — slider de revelado (mouse, touch y teclado)   */
  /* ------------------------------------------------------------------ */
  function initExcavate() {
    var root = document.querySelector(".excavate");
    if (!root) return;
    var handle = root.querySelector(".excavate__handle");
    if (!handle) return;
    var grip = root.querySelector(".excavate__grip") || handle; // sólo el tirador captura el gesto
    var bury = root.querySelector(".antithesis__line--bury");    // ancla: "...sepultó,"
    var MIN = 4, MAX = 96, dig = 33, dragging = false, userDug = false;

    function set(v) {
      dig = clamp(v, MIN, MAX);
      root.style.setProperty("--dig", dig + "%");
      handle.setAttribute("aria-valuenow", Math.round(dig));
    }
    function pctFromY(clientY) {
      var r = root.getBoundingClientRect();
      return ((clientY - r.top) / r.height) * 100;
    }
    /* Ancla el corte al borde inferior real de "sepultó,". Se mide con
       getBoundingClientRect SÓLO en reposo (texto ya revelado): mientras el
       reveal corre, su transform falsearía la posición y el corte caería más abajo. */
    var GAP = -36;        // px de respiro debajo de "sepultó," (subir para alejar, bajar para acercar)
    var anchored = false;
    function reanchor() {
      if (userDug || anchored || !bury) return;
      var article = bury.closest(".reveal");
      if (article && !article.classList.contains("is-visible")) return; // esperar reposo
      var rRect = root.getBoundingClientRect();
      if (!rRect.height) return;
      var bRect = bury.getBoundingClientRect();
      set(((bRect.bottom - rRect.top + GAP) / rRect.height) * 100);
      anchored = true;
    }

    grip.addEventListener("pointerdown", function (e) {
      dragging = true;
      userDug = true;
      root.classList.add("is-digging");
      if (grip.setPointerCapture) grip.setPointerCapture(e.pointerId);
      set(pctFromY(e.clientY));
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (dragging) set(pctFromY(e.clientY));
    });
    grip.addEventListener("pointerup", function () { dragging = false; });
    grip.addEventListener("pointercancel", function () { dragging = false; });

    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 10 : 4;
      // Abajo = excavar más profundo; arriba = volver a cubrir
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { userDug = true; set(dig + step); root.classList.add("is-digging"); e.preventDefault(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { userDug = true; set(dig - step); root.classList.add("is-digging"); e.preventDefault(); }
      else if (e.key === "Home") { userDug = true; set(MIN); e.preventDefault(); }
      else if (e.key === "End") { userDug = true; set(MAX); e.preventDefault(); }
    });

    // Se ancla al revelarse la sección (en reposo) y se recalcula ante cambios de layout
    scrollCbs.push(reanchor);
    resizeCbs.push(function () { anchored = false; reanchor(); });
    window.addEventListener("load", reanchor);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reanchor);
    reanchor();
  }

  /* ------------------------------------------------------------------ */
  /* 10. Silenciar la ceniza sobre ciertas secciones                     */
  /* Ciudad viva, calma, furia, legado, cronología, el presente y la     */
  /* ficha técnica: la ceniza compite con la imagen o el contenido.      */
  /* (Se mantiene en el intersticial "1669" y en el molde de ceniza.)    */
  /* ------------------------------------------------------------------ */
  function initAshScenes() {
    var ash = document.querySelector(".ash");
    if (!ash || !("IntersectionObserver" in window)) return;
    var ids = ["prosperidad", "temblores", "erupcion", "legado",
               "linea-de-tiempo", "cierre", "ficha-tecnica"];
    var secs = ids
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!secs.length) return;

    // Estado por sección (robusto ante eventos agrupados o salteados):
    // se recalcula desde la verdad de cada una, sin contadores acumulativos.
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible[en.target.id] = en.isIntersecting;
      });
      var any = secs.some(function (s) { return visible[s.id]; });
      document.body.classList.toggle("ash-hidden", any);
    }, { rootMargin: "-35% 0px -35% 0px", threshold: 0 });

    secs.forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------------ */
  /* 12. Audio ambiental + control de volumen                           */
  /* ------------------------------------------------------------------ */
  function initAmbientAudio() {
    var audio = document.querySelector("[data-ambient-audio]");
    if (!audio) return;

    var control = document.querySelector("[data-volume-control]");
    var toggle = control ? control.querySelector(".volume-control__toggle") : null;
    var range = control ? control.querySelector("[data-volume-range]") : null;
    var value = control ? control.querySelector("[data-volume-value]") : null;
    var prompt = document.querySelector("[data-sound-prompt]");
    var documentUnlockEvents = ["pointerdown", "touchstart", "touchmove", "mousedown", "keydown", "click"];
    var windowUnlockEvents = ["wheel", "scroll"];
    var listening = false;
    var lastPlayAttempt = 0;
    var closeTimer = null;
    var promptTimer = null;
    var promptFallbackTimer = null;
    var promptExpired = false;

    audio.volume = 0.6;

    function syncControl() {
      if (!control) return;
      var percent = Math.round(audio.volume * 100);
      control.style.setProperty("--volume", percent + "%");
      control.classList.toggle("is-muted", audio.muted || percent === 0);
      if (range && document.activeElement !== range) range.value = percent;
      if (value) value.textContent = percent + "%";
      if (toggle) {
        var muted = audio.muted || percent === 0;
        toggle.setAttribute("aria-pressed", muted ? "true" : "false");
        toggle.setAttribute("aria-label", muted ? "Activar música" : "Silenciar música");
      }
    }

    function closeControl() {
      if (!control) return;
      control.classList.add("is-collapsed");
      if (document.activeElement && control.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }

    function scheduleClose() {
      if (!control) return;
      control.classList.remove("is-collapsed");
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closeControl, 2600);
    }

    if (control) {
      ["pointerenter", "pointermove", "focusin", "input", "change", "click", "keydown"].forEach(function (eventName) {
        control.addEventListener(eventName, scheduleClose);
      });
      control.addEventListener("pointerleave", function () {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(closeControl, 2600);
      });
    }

    function hidePrompt() {
      clearTimeout(promptTimer);
      clearTimeout(promptFallbackTimer);
      if (prompt) prompt.hidden = true;
    }

    function showPrompt() {
      if (!prompt || promptExpired || !audio.paused || !prompt.hidden) return;
      prompt.hidden = false;
      clearTimeout(promptTimer);
      promptTimer = setTimeout(function () {
        promptExpired = true;
        hidePrompt();
      }, 10000);
    }

    if (prompt) {
      prompt.addEventListener("click", function () {
        tryPlay();
      });
    }

    function unbindUnlock() {
      if (!listening) return;
      documentUnlockEvents.forEach(function (eventName) {
        document.removeEventListener(eventName, tryPlay);
      });
      windowUnlockEvents.forEach(function (eventName) {
        window.removeEventListener(eventName, tryPlay);
      });
      listening = false;
    }

    function bindUnlock() {
      if (listening) return;
      documentUnlockEvents.forEach(function (eventName) {
        document.addEventListener(eventName, tryPlay, { passive: true });
      });
      windowUnlockEvents.forEach(function (eventName) {
        window.addEventListener(eventName, tryPlay, { passive: true });
      });
      listening = true;
    }

    function tryPlay() {
      if (!audio.paused || audio.muted) return;
      var now = Date.now();
      if (now - lastPlayAttempt < 250) return;
      lastPlayAttempt = now;
      var playAttempt = audio.play();
      if (playAttempt && playAttempt.then) {
        playAttempt.then(function () {
          promptExpired = true;
          hidePrompt();
          unbindUnlock();
        }).catch(function () {
          bindUnlock();
          showPrompt();
        });
      } else {
        unbindUnlock();
      }
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        audio.muted = !audio.muted;
        if (!audio.muted && audio.volume === 0) {
          audio.volume = 0.6;
          if (range) range.value = 60;
        }
        syncControl();
        if (!audio.muted) tryPlay();
      });
    }

    if (range) {
      range.addEventListener("input", function () {
        audio.volume = clamp(parseInt(range.value, 10) / 100, 0, 1);
        audio.muted = audio.volume === 0;
        syncControl();
        if (!audio.muted && audio.paused) tryPlay();
      });
    }

    syncControl();
    bindUnlock();
    tryPlay();
    // Algunos navegadores dejan play() pendiente sin rechazarlo enseguida.
    // Si sigue pausado, mostramos igualmente la invitación de activación.
    promptFallbackTimer = setTimeout(function () {
      if (audio.paused) showPrompt();
    }, 500);
  }

  function init() {
    var mods = [initAmbientAudio, splitText, initReveal, initIndicators, initParallax, initTimeline,
                initCounters, initAsh, initElevator, initStrata, initExcavate,
                initAshScenes];
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

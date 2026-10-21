// Интерактив страницы «Я ВИЛЯЮ»
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

function setMenu(open) {
  if (!menuToggle || !mainNav) return;
  mainNav.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
}

if (menuToggle && mainNav && header) {
  menuToggle.addEventListener("click", () => setMenu(!mainNav.classList.contains("is-open")));
  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("is-open")) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) setMenu(false);
  });
  // При переходе на широкий экран меню сбрасывается в исходное состояние
  window.matchMedia("(min-width: 681px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
}

// Шапка уменьшается и получает тень при прокрутке
const onScroll = () => { if (header) header.classList.toggle("is-scrolled", window.scrollY > 20); };
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Год в подвале
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// Плавное появление блоков (без анимации, если пользователь отключил её в системе)
const revealItems = document.querySelectorAll(".service-card, .trust-inner, .address-inner, .contact-inner");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-visible");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });

  let cardIndex = 0; // порядковый номер карточки услуги — для ступенчатого появления
  revealItems.forEach((el) => {
    const isCard = el.classList.contains("service-card");
    el.classList.add("reveal");
    el.style.transitionDelay = isCard ? (cardIndex++ % 4) * 80 + "ms" : "0ms";
    io.observe(el);
    // Убираем служебные классы только после завершения самой анимации появления
    el.addEventListener("transitionend", (e) => {
      if (e.target !== el || e.propertyName !== "opacity" || !el.classList.contains("is-visible")) return;
      el.classList.remove("reveal", "is-visible");
      el.style.transitionDelay = "";
    });
  });
}

// До/После: лента с автопрокруткой, свайпом, перетаскиванием мышью, стрелками и клавиатурой.
// Лента — обычный горизонтальный скролл-контейнер. Для бесконечной прокрутки скрипт добавляет копии
// карточек и незаметно «перепрыгивает» на равноценную позицию, когда лента уходит далеко от центра.
const baTrack = document.querySelector(".before-after-track");
const baOriginals = baTrack ? Array.from(baTrack.querySelectorAll(".before-after-card")) : [];

function setBaState(card, showAfter) {
  card.classList.toggle("is-after", showAfter);
  card.classList.toggle("is-before", !showAfter);
  card.querySelectorAll(".ba-btn").forEach((btn) => {
    const active = (btn.dataset.state === "after") === showAfter;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

if (baTrack && baOriginals.length > 1) {
  const n = baOriginals.length;
  const AUTO_SPEED = 45;     // скорость автопрокрутки, px/сек
  const RESUME_DELAY = 3000; // сколько ждать после действий пользователя, мс
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prevBtn = document.querySelector(".ba-arrow--prev");
  const nextBtn = document.querySelector(".ba-arrow--next");

  let sets = 1;          // сколько раз повторён набор карточек
  let pitch = 0;         // расстояние между карточками
  let setW = 0;          // ширина одного набора
  let pos = 0;           // «точная» позиция автопрокрутки (scrollLeft округляется браузером)
  let lastSet = 0;       // последнее значение scrollLeft, выставленное скриптом
  let lastT = 0;
  let holdUntil = 0;     // автопрокрутка стоит до этого момента
  let hovering = false, focused = false, pressed = false, visible = true;
  let anim = null;       // плавный сдвиг по стрелкам/клавишам
  let inertia = null;    // «докатывание» после перетаскивания мышью
  let drag = null, suppressClick = false, idleTimer = 0, resizeTimer = 0;

  const allCards = () => Array.from(baTrack.querySelectorAll(".before-after-card"));
  const holdAutoplay = () => { holdUntil = performance.now() + RESUME_DELAY; };
  const centerIndex = () => Math.floor(sets / 2);
  const lowBound = () => centerIndex() * setW - setW / 2;
  const highBound = () => centerIndex() * setW + setW / 2;
  const wrapValue = (v) => lowBound() + (((v - lowBound()) % setW) + setW) % setW;

  function makeClone(src) {
    const c = src.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    c.querySelectorAll("img").forEach((img) => { img.alt = ""; img.draggable = false; });
    c.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; });
    setBaState(c, src.classList.contains("is-after"));
    return c;
  }

  // Нужное число наборов: чтобы по обе стороны от центра был запас прокрутки шире экрана
  function neededSets(w, vw) {
    let k = 3;
    while ((k - Math.floor(k / 2) - 0.5) * w < vw + 8) k += 2;
    return k;
  }

  function layout() {
    const oldW = setW;
    const frac = oldW ? (((baTrack.scrollLeft % oldW) + oldW) % oldW) / oldW : 0;
    pitch = baOriginals[1].offsetLeft - baOriginals[0].offsetLeft;
    const w = pitch * n;
    if (w <= 0) return;
    const k = neededSets(w, baTrack.clientWidth);
    if (k !== sets) {
      allCards().filter((c) => c.getAttribute("aria-hidden") === "true").forEach((c) => c.remove());
      for (let s = 1; s < k; s++) baOriginals.forEach((o) => baTrack.appendChild(makeClone(o)));
      sets = k;
    }
    setW = w;
    baTrack.scrollLeft = centerIndex() * setW + frac * setW;
    pos = lastSet = baTrack.scrollLeft;
  }

  // Возвращает ленту в «центральный» набор, если она ушла далеко (визуально ничего не меняется)
  function normalizeNow() {
    if (drag && drag.active) return;
    if (anim || inertia || !setW) return;
    const v = wrapValue(baTrack.scrollLeft);
    if (Math.abs(v - baTrack.scrollLeft) > 0.5) baTrack.scrollLeft = v;
    pos = lastSet = baTrack.scrollLeft;
  }

  function canPlay() {
    return !reduceMotion.matches && !hovering && !focused && !pressed && visible &&
      !document.hidden && performance.now() >= holdUntil;
  }

  function stepAnim(t) {
    const k = Math.min(1, (t - anim.start) / anim.dur);
    const e = 1 - Math.pow(1 - k, 3);
    baTrack.scrollLeft = anim.from + (anim.to - anim.from) * e;
    if (k >= 1) { anim = null; holdAutoplay(); normalizeNow(); }
  }

  function tick(t) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    if (!setW) return;
    if (anim) { stepAnim(t); pos = lastSet = baTrack.scrollLeft; return; }
    if (inertia) {
      baTrack.scrollLeft += inertia.v * dt * 1000;
      inertia.v *= Math.exp(-dt * 1000 / 325);
      if (Math.abs(inertia.v) < 0.02) { inertia = null; holdAutoplay(); normalizeNow(); }
      pos = lastSet = baTrack.scrollLeft;
      return;
    }
    const cur = baTrack.scrollLeft;
    if (Math.abs(cur - lastSet) > 1.5) holdAutoplay(); // прокрутили руками (колесо, трекпад, свайп, клавиатура)
    if (!canPlay()) { pos = lastSet = cur; return; }
    pos += AUTO_SPEED * dt;
    if (pos >= highBound()) pos -= setW;
    baTrack.scrollLeft = pos;
    lastSet = baTrack.scrollLeft;
  }

  function animateBy(dx) {
    if (!setW) return;
    inertia = null;
    const from = baTrack.scrollLeft;
    anim = { from, to: from + dx, start: performance.now(), dur: 450 };
    holdAutoplay();
  }
  const pageStep = () => Math.max(1, Math.floor(baTrack.clientWidth / pitch) - 1) * pitch;

  // Стрелки и клавиатура
  if (prevBtn) prevBtn.addEventListener("click", () => animateBy(-pageStep()));
  if (nextBtn) nextBtn.addEventListener("click", () => animateBy(pageStep()));
  baTrack.addEventListener("keydown", (e) => {
    if (e.target !== baTrack) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); animateBy(-pitch); }
    if (e.key === "ArrowRight") { e.preventDefault(); animateBy(pitch); }
  });

  // Перетаскивание мышью (на тачскринах работает обычный свайп)
  baTrack.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    anim = null; inertia = null; pressed = true;
    drag = { id: e.pointerId, x0: e.clientX, left0: baTrack.scrollLeft, active: false, v: 0, lastX: e.clientX, lastT: e.timeStamp };
  });
  baTrack.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.active) {
      if (Math.abs(dx) < 5) return;
      drag.active = true;
      baTrack.setPointerCapture(e.pointerId);
      baTrack.classList.add("is-dragging");
    }
    baTrack.scrollLeft = drag.left0 - dx;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = 0.75 * drag.v + 0.25 * ((drag.lastX - e.clientX) / dt);
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null; pressed = false;
    baTrack.classList.remove("is-dragging");
    holdAutoplay();
    if (d.active) {
      suppressClick = true;                         // чтобы отпускание мыши не нажало ДО/ПОСЛЕ
      setTimeout(() => { suppressClick = false; }, 60);
      const v = e.timeStamp - d.lastT > 80 ? 0 : Math.max(-4, Math.min(4, d.v));
      if (Math.abs(v) > 0.05) inertia = { v }; else normalizeNow();
    }
  }
  baTrack.addEventListener("pointerup", endDrag);
  baTrack.addEventListener("pointercancel", endDrag);
  baTrack.addEventListener("click", (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  baTrack.addEventListener("dragstart", (e) => e.preventDefault());

  // Пауза автопрокрутки: курсор над лентой, касание, клавиатурный фокус
  baTrack.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hovering = true; });
  baTrack.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    hovering = false;
    if (drag && !drag.active) { drag = null; pressed = false; } // кнопку отпустили за пределами ленты
  });
  baTrack.addEventListener("touchstart", () => { anim = null; inertia = null; pressed = true; }, { passive: true });
  const touchEnd = () => { pressed = false; holdAutoplay(); };
  baTrack.addEventListener("touchend", touchEnd, { passive: true });
  baTrack.addEventListener("touchcancel", touchEnd, { passive: true });
  baTrack.addEventListener("wheel", () => { anim = null; inertia = null; holdAutoplay(); }, { passive: true });
  const updateFocus = () => {
    focused = baTrack.matches(":focus-visible") || !!baTrack.querySelector(":focus-visible");
  };
  baTrack.addEventListener("focusin", updateFocus);
  baTrack.addEventListener("focusout", () => setTimeout(updateFocus, 0));

  // После ручной прокрутки — вернуть ленту к центру, когда она остановилась
  baTrack.addEventListener("scroll", () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(normalizeNow, 140);
  }, { passive: true });

  // ДО/ПОСЛЕ: нажатие переключает карточку и все её копии
  baTrack.addEventListener("click", (e) => {
    const btn = e.target.closest(".ba-btn");
    if (!btn) return;
    const card = btn.closest(".before-after-card");
    const idx = allCards().indexOf(card) % n;
    const showAfter = btn.dataset.state === "after";
    allCards().forEach((c, i) => { if (i % n === idx) setBaState(c, showAfter); });
    holdAutoplay();
  });

  // Не тратим ресурсы, пока лента не на экране
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(baTrack);
  }
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  layout();
  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(tick); });
}

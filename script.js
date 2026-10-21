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

// До/После: кнопки в карточке переключают фото (before_N.webp / after_N.webp)
const baCards = Array.from(document.querySelectorAll(".before-after-card"));
function setBaState(card, showAfter) {
  card.classList.toggle("is-after", showAfter);
  card.classList.toggle("is-before", !showAfter);
  card.querySelectorAll(".ba-btn").forEach((btn) => {
    const active = (btn.dataset.state === "after") === showAfter;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}
if (baCards.length) {
  const half = baCards.length / 2; // вторая половина — копии для бесшовной ленты
  baCards.forEach((card, i) => {
    card.querySelectorAll(".ba-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const showAfter = btn.dataset.state === "after";
        setBaState(card, showAfter);
        setBaState(baCards[(i + half) % baCards.length], showAfter); // синхронизируем копию
      });
    });
  });
}

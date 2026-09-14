/* =========================================================
   LUME — INTERAÇÕES
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  const header = document.querySelector(".site-header");

  /* MENU MOBILE */
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* HEADER */
  function updateHeader() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 40);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* REVELAÇÃO DOS ELEMENTOS */
  const animatedElements = document.querySelectorAll(
    ".intro-copy, .section-heading, .area-card, .stat, .news-card, .profile-art, .profile-copy, .closing"
  );

  animatedElements.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 80, 320)}ms`);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: "0px 0px -50px 0px"
    });

    animatedElements.forEach(element => observer.observe(element));
  } else {
    animatedElements.forEach(element => element.classList.add("visible"));
  }

  /* HERO PARALLAX SUTIL */
  const hero = document.querySelector(".hero");
  const heroImage = document.querySelector(".hero-image");

  function updateHero() {
    if (!hero || !heroImage || window.innerWidth <= 900) return;
    const rect = hero.getBoundingClientRect();
    const offset = Math.max(0, -rect.top);
    if (offset <= hero.offsetHeight) {
      heroImage.style.transform = `translateY(${offset * 0.08}px) scale(1.02)`;
    }
  }

  updateHero();
  window.addEventListener("scroll", updateHero, { passive: true });

  /* FECHA MENU AO VOLTAR PARA DESKTOP */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && nav) {
      nav.classList.remove("open");
      if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    }
  });

  /* LINKS AINDA NÃO IMPLEMENTADOS */
  document.querySelectorAll('a[href="#"]').forEach(link => {
    link.addEventListener("click", event => event.preventDefault());
  });

  /* ACESSIBILIDADE */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("reduce-motion");
    animatedElements.forEach(element => element.classList.add("visible"));
  }
  const newsList = document.querySelector("#news-list");
  const sortButtons = document.querySelectorAll(".news-sort");
  if (newsList && sortButtons.length) {
    const articles = Array.from(newsList.querySelectorAll(".article-row"));
    const dateValue = article => {
      const text = article.querySelector(".article-date")?.textContent.trim() || "";
      const parts = text.split(".").map(Number);
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    };
    const sortNews = order => {
      articles.sort((a, b) => order === "oldest" ? dateValue(a) - dateValue(b) : dateValue(b) - dateValue(a));
      articles.forEach(article => newsList.appendChild(article));
      sortButtons.forEach(button => button.classList.toggle("active", button.dataset.sort === order));
    };
    sortButtons.forEach(button => button.addEventListener("click", () => sortNews(button.dataset.sort)));
    sortNews("newest");
  }

});

// =========================================================
// NodeCraft Automation — site-data.js
// Fetches the live content + theme from the Admin Panel's data
// store and renders it into whichever page is currently open.
// This is what makes Admin Panel changes show up instantly for
// every visitor — every page always asks the server "what does
// the content look like right now?" instead of having anything
// baked into the HTML.
// =========================================================

(function () {
  "use strict";

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function esc(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------------------------------------------------------
  // Theme application
  // ---------------------------------------------------------
  function applyTheme(themeKey, themes) {
    const theme = themes[themeKey] || themes["midnight-navy"];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([varName, val]) => {
      root.style.setProperty(varName, val);
    });
    recolorLogoAndHero(theme.vars);
  }

  // The logo mark + homepage hero diagram use hard-coded SVG fill/stroke
  // colors (inline SVG can't reference CSS variables from the browser's
  // default attribute parsing in every case), so we repaint them by hand
  // whenever the theme changes.
  function recolorLogoAndHero(vars) {
    document.querySelectorAll(".logo-mark").forEach((svg) => {
      const circles = svg.querySelectorAll("circle");
      if (circles[0]) circles[0].setAttribute("fill", vars["--cyan"]);
      if (circles[1]) circles[1].setAttribute("fill", vars["--blue"]);
      if (circles[2]) circles[2].setAttribute("fill", vars["--blue"]);
      const path = svg.querySelector("path");
      if (path) path.setAttribute("stroke", vars["--border-strong"]);
    });
    const gradient = document.getElementById("flowGradient");
    if (gradient) {
      const stops = gradient.querySelectorAll("stop");
      if (stops[0]) stops[0].setAttribute("stop-color", vars["--blue"]);
      if (stops[1]) stops[1].setAttribute("stop-color", vars["--cyan"]);
    }
  }

  // ---------------------------------------------------------
  // Plain text-field binding: <el data-edit="pages.home.heroDesc">
  // and <el data-edit-html="..."> for fields that contain markup.
  // ---------------------------------------------------------
  function applyTextFields(content) {
    document.querySelectorAll("[data-edit]").forEach((el) => {
      const val = getPath(content, el.getAttribute("data-edit"));
      if (val !== undefined) el.textContent = val;
    });
    document.querySelectorAll("[data-edit-html]").forEach((el) => {
      const val = getPath(content, el.getAttribute("data-edit-html"));
      if (val !== undefined) el.innerHTML = val;
    });
  }

  // ---------------------------------------------------------
  // Scroll-reveal for dynamically-injected content. Mirrors
  // main.js's initReveal() exactly, so content that loads after
  // the initial page parse still animates in the same way as
  // content that was already in the HTML.
  // ---------------------------------------------------------
  function observeReveal(elements) {
    const els = elements.filter(Boolean);
    if (!els.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => observer.observe(el));
  }

  // ---------------------------------------------------------
  // Icons (small inline SVG library so dynamic cards keep the
  // same look as the original hand-built markup)
  // ---------------------------------------------------------
  const ICONS = {
    workflow: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 11v3M17.5 11v3"/>',
    integration: '<path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4"/>',
    ai: '<path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/><circle cx="19" cy="19" r="2"/>',
    support: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    call: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.9.36 1.79.7 2.63a2 2 0 01-.45 2.11L8.09 9.73a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.84.34 1.73.58 2.63.7A2 2 0 0122 16.92z"/>',
    doc: '<path d="M14 3v4a1 1 0 001 1h4"/><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/><path d="M9 13h6M9 17h4"/>',
    grad: '<path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M3 9v6c0 1.5 4 3 9 3s9-1.5 9-3V9"/>'
  };
  const PROCESS_ICON_ORDER = ["call", "doc", "workflow", "grad", "support"];

  function svgIcon(pathInner, viewBox) {
    return `<svg viewBox="${viewBox || "0 0 24 24"}" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pathInner}</svg>`;
  }
  function checkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS.check + "</svg>";
  }

  // ---------------------------------------------------------
  // Avatar (founder headshot or generated initials avatar)
  // ---------------------------------------------------------
  function avatarMarkup(founder, size) {
    if (founder.photo) {
      return `<img src="${esc(founder.photo)}" alt="${esc(founder.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    }
    const color = founder.tone === "blue" ? "var(--blue)" : "var(--cyan)";
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" style="fill:var(--bg-panel-alt)"/><circle cx="50" cy="${size === "lg" ? 40 : 38}" r="${size === "lg" ? 19 : 18}" style="fill:var(--border-soft)"/><path d="M18 90c2-22 19-32 32-32s30 10 32 32" style="fill:var(--border-soft)"/><text x="50" y="${size === "lg" ? 47 : 45}" font-family="Space Grotesk" font-size="${size === "lg" ? 20 : 18}" style="fill:${color}" text-anchor="middle" font-weight="700">${esc(founder.initials || "")}</text></svg>`;
  }

  // ---------------------------------------------------------
  // Case study thumbnail (uploaded image, or a generated diagram)
  // ---------------------------------------------------------
  function caseThumbMarkup(cs, index) {
    if (cs.thumbnail) {
      return `<img src="${esc(cs.thumbnail)}" alt="${esc(cs.title)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    }
    const patterns = [
      '<circle cx="30" cy="30" r="8" style="fill:var(--cyan)"/><circle cx="100" cy="20" r="8" style="fill:var(--blue)"/><circle cx="170" cy="30" r="8" style="fill:var(--blue)"/><circle cx="100" cy="80" r="8" style="fill:var(--cyan)"/><circle cx="100" cy="130" r="8" style="fill:var(--success)"/><path d="M30 30 L100 80 L170 30 M100 20 L100 80 L100 130" style="stroke:var(--border-strong)" stroke-width="2" fill="none"/>',
      '<rect x="20" y="55" width="34" height="34" rx="6" style="fill:var(--bg-panel);stroke:var(--blue)" stroke-width="2"/><rect x="83" y="30" width="34" height="34" rx="6" style="fill:var(--bg-panel);stroke:var(--cyan)" stroke-width="2"/><rect x="146" y="55" width="34" height="34" rx="6" style="fill:var(--bg-panel);stroke:var(--blue)" stroke-width="2"/><rect x="83" y="95" width="34" height="34" rx="6" style="fill:var(--bg-panel);stroke:var(--success)" stroke-width="2"/><path d="M54 72 L83 47 M117 47 L146 72 M100 64 L100 95" style="stroke:var(--border-strong)" stroke-width="2" fill="none"/>',
      '<circle cx="40" cy="75" r="26" fill="none" style="stroke:var(--blue)" stroke-width="2"/><circle cx="100" cy="45" r="20" fill="none" style="stroke:var(--cyan)" stroke-width="2"/><circle cx="160" cy="75" r="26" fill="none" style="stroke:var(--blue)" stroke-width="2"/><path d="M64 65 L84 55 M116 55 L136 65" style="stroke:var(--border-strong)" stroke-width="2" fill="none"/><circle cx="40" cy="75" r="4" style="fill:var(--cyan)"/><circle cx="100" cy="45" r="4" style="fill:var(--cyan)"/><circle cx="160" cy="75" r="4" style="fill:var(--success)"/>'
    ];
    const p = patterns[index % patterns.length];
    return `<span class="sample-tag">${cs.sample ? "Sample Project" : "Case Study"}</span><svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">${p}</svg>`;
  }

  // ---------------------------------------------------------
  // Video embeds — accepts a pasted YouTube/Vimeo link or an
  // uploaded video file path, and renders the right markup for
  // whichever one it is.
  // ---------------------------------------------------------
  function videoEmbedMarkup(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
      return `<iframe src="https://www.youtube.com/embed/${yt[1]}" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) {
      return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" title="Video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    // Anything else is treated as a direct video file (an uploaded file, or a direct .mp4/.webm link)
    return `<video controls playsinline preload="metadata" src="${esc(url)}"></video>`;
  }

  function renderPageVideo(sectionId, frameId, url) {
    const section = document.getElementById(sectionId);
    const frame = document.getElementById(frameId);
    if (!section || !frame) return;
    const markup = videoEmbedMarkup(url);
    if (!markup) {
      section.style.display = "none";
      frame.innerHTML = "";
      return;
    }
    frame.innerHTML = markup;
    section.style.display = "";
  }

  // ---------------------------------------------------------
  // Renderers for each dynamic block. Each checks whether its
  // target container exists on the current page before doing
  // any work, so one script safely serves every page.
  // ---------------------------------------------------------
  function renderHomeServices(content) {
    const el = document.getElementById("home-services-grid");
    if (!el) return;
    el.innerHTML = content.services
      .slice(0, 4)
      .map(
        (s) => `
      <div class="service-card">
        <div class="icon-wrap">${svgIcon(ICONS[s.icon] || ICONS.workflow)}</div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
      </div>`
      )
      .join("");
  }

  function renderHomeFounders(content) {
    const el = document.getElementById("home-founders-grid");
    if (!el) return;
    el.innerHTML = content.founders
      .map(
        (f) => `
      <div class="founder-card">
        <div class="founder-avatar">${avatarMarkup(f, "sm")}</div>
        <h3>${esc(f.name)}</h3>
        <p class="founder-role">${f.role}</p>
      </div>`
      )
      .join("");
  }

  function renderHomeProcess(content) {
    const el = document.getElementById("home-process-grid");
    if (!el) return;
    const steps = (content.pages.process.steps || []).slice(0, 3);
    el.innerHTML =
      '<div class="timeline-connector"></div>' +
      steps
        .map(
          (s, i) => `
      <div class="timeline-step">
        <div class="step-index">0${i + 1}</div>
        <h3>${esc(s.title)}</h3>
        <p>${s.desc}</p>
      </div>`
        )
        .join("");
  }

  function renderHomeCaseTeaser(content) {
    const el = document.getElementById("home-case-teaser");
    if (!el) return;
    const cs = content.caseStudies[0];
    if (!cs) return;
    el.innerHTML = `
      <div class="case-study-card reveal">
        <div class="case-visual">${caseThumbMarkup(cs, 0)}</div>
        <div class="case-content">
          <span class="eyebrow"><span class="dot"></span> ${esc(cs.tag)}</span>
          <h3>${esc(cs.title)}</h3>
          <p>${esc(cs.desc)}</p>
          <div class="case-stats">
            <div><span class="stat-num">${esc(cs.result.match(/^[^\s]+/)?.[0] || "")}</span><span class="stat-label">Result</span></div>
          </div>
          <a href="case-studies.html" class="btn btn-secondary" style="align-self:flex-start;">View All Case Studies</a>
        </div>
      </div>`;
    observeReveal([el.querySelector(".case-study-card")]);
  }

  function renderServicesPage(content) {
    const el = document.getElementById("services-grid");
    if (!el) return;
    el.innerHTML = content.services
      .map(
        (s) => `
      <div class="pricing-card">
        <div class="pricing-card-top">
          <div class="icon-wrap">${svgIcon(ICONS[s.icon] || ICONS.workflow)}</div>
          <div class="price-tag">
            <span class="starting-at">Starting at</span>
            <span class="amount">$${esc(s.price)}</span>
            <span class="unit">${esc(s.priceUnit)}</span>
          </div>
        </div>
        <h3>${esc(s.title)}</h3>
        <p class="desc">${esc(s.desc)}</p>
        <ul class="includes">
          ${(s.features || []).map((f) => `<li>${checkIcon()} ${f}</li>`).join("")}
        </ul>
      </div>`
      )
      .join("");
  }

  function renderTeamFounders(content) {
    const el = document.getElementById("team-founders");
    if (!el) return;
    el.innerHTML = content.founders
      .map(
        (f, i) => `
      <div class="founder-profile ${i % 2 === 1 ? "reverse" : ""} reveal">
        <div class="founder-visual-col">
          <div class="founder-visual-frame">
            <div class="ring">${avatarMarkup(f, "lg")}</div>
            <span class="founder-tag">Founder 0${i + 1}</span>
          </div>
        </div>
        <div class="founder-info-col">
          <span class="eyebrow"><span class="dot"></span> ${esc(f.eyebrow)}</span>
          <h2>${esc(f.name)}</h2>
          <p class="founder-role-line">${f.role}</p>
          <p class="bio">${esc(f.bio)}</p>
          <div class="skill-tags">
            ${(f.skills || []).map((sk) => `<span class="skill-tag">${sk}</span>`).join("")}
          </div>
        </div>
      </div>`
      )
      .join("");
    observeReveal(Array.from(el.querySelectorAll(".founder-profile")));

    // "Owned by X" labels on the pillar cards below, kept in sync with
    // whatever order the founders are currently saved in.
    content.founders.forEach((f, i) => {
      const tag = document.getElementById("pillar-owner-" + i);
      if (tag) tag.textContent = "Owned by " + f.name.split(" ")[0];
    });

    wireFounderPhotoLightbox(content.founders);
  }

  // Clicking a founder's headshot opens it larger in a lightbox.
  // Only wired up on the Founders page, where the overlay markup exists.
  let founderLightboxWired = false;
  function wireFounderPhotoLightbox(founders) {
    const overlay = document.getElementById("founderPhotoOverlay");
    if (!overlay) return;

    const frame = document.getElementById("founderPhotoFrame");
    const caption = document.getElementById("founderPhotoCaption");
    const closeBtn = document.getElementById("founderPhotoClose");

    function closeLightbox() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }
    function openLightbox(f) {
      frame.innerHTML = avatarMarkup(f, "lg");
      caption.textContent = f.name + (f.role ? " — " + f.role.replace(/&amp;/g, "&") : "");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    if (!founderLightboxWired) {
      founderLightboxWired = true;
      closeBtn.addEventListener("click", closeLightbox);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeLightbox();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeLightbox();
      });
    }

    document.querySelectorAll(".founder-visual-frame").forEach((frameEl, i) => {
      const f = founders[i];
      if (!f) return;
      frameEl.setAttribute("tabindex", "0");
      frameEl.setAttribute("role", "button");
      frameEl.setAttribute("aria-label", "Enlarge photo of " + f.name);
      frameEl.addEventListener("click", () => openLightbox(f));
      frameEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(f);
        }
      });
    });
  }

  function renderProcessTimeline(content) {
    const el = document.getElementById("process-timeline");
    if (!el) return;
    const steps = content.pages.process.steps || [];
    el.innerHTML =
      '<div class="v-timeline-line"></div>' +
      steps
        .map(
          (s, i) => `
      <div class="v-step ${s.badge ? "optional" : ""} reveal">
        <div class="v-step-index">0${i + 1}</div>
        <div class="v-step-card">
          <div class="v-step-top">
            <div style="display:flex; align-items:center; gap:0.8rem;">
              <div class="v-step-icon">${svgIcon(ICONS[PROCESS_ICON_ORDER[i % PROCESS_ICON_ORDER.length]])}</div>
              <h3>${esc(s.title)}</h3>
            </div>
            ${s.badge ? `<span class="optional-badge">${esc(s.badge)}</span>` : ""}
          </div>
          <p>${s.desc}</p>
        </div>
      </div>`
        )
        .join("");
    observeReveal(Array.from(el.querySelectorAll(".v-step")));
  }

  function renderProcessFaq(content) {
    const el = document.getElementById("process-faq");
    if (!el) return;
    const faqs = content.pages.process.faqs || [];
    el.innerHTML = faqs
      .map(
        (f, i) => `
      <div class="faq-item ${i === 0 ? "open" : ""}">
        <button class="faq-question" type="button">
          ${esc(f.q)}
          <span class="faq-toggle-icon"></span>
        </button>
        <div class="faq-answer">
          <p>${esc(f.a)}</p>
        </div>
      </div>`
      )
      .join("");

    el.querySelectorAll(".faq-item").forEach((item) => {
      const q = item.querySelector(".faq-question");
      q.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        el.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  let modalWired = false;
  function wireCaseModal() {
    const overlay = document.getElementById("csModalOverlay");
    if (!overlay || modalWired) return;
    modalWired = true;
    const modalBody = overlay.querySelector(".cs-modal-body");
    const closeBtn = overlay.querySelector(".cs-modal-close");

    function closeModal() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
    });

    overlay.openWith = function (cs) {
      const videoMarkup = videoEmbedMarkup(cs.video);
      modalBody.innerHTML = `
        <span class="eyebrow"><span class="dot"></span> ${esc(cs.tag)} ${cs.sample ? "· Sample Project" : ""}</span>
        <h3>${esc(cs.title)}</h3>
        ${videoMarkup ? `<div class="cs-modal-video"><div class="video-frame">${videoMarkup}</div></div>` : ""}
        <h4>The Problem</h4>
        <p>${esc(cs.problem)}</p>
        <h4>The Automation</h4>
        <p>${esc(cs.automation)}</p>
        <h4>The Result</h4>
        <div class="cs-modal-result">${checkIcon()} ${esc(cs.resultFull)}</div>`;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    };
  }

  function renderCaseGrid(content) {
    const el = document.getElementById("case-grid");
    if (!el) return;
    wireCaseModal();
    const overlay = document.getElementById("csModalOverlay");

    el.innerHTML = content.caseStudies
      .map(
        (cs, i) => `
      <div class="case-card" tabindex="0" role="button" data-case-id="${esc(cs.id)}" aria-haspopup="dialog" aria-label="Open case study: ${esc(cs.title)}">
        <div class="case-card-thumb">
          ${caseThumbMarkup(cs, i)}
          ${cs.video ? `<span class="case-video-badge" title="Includes video"><svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg></span>` : ""}
        </div>
        <div class="case-card-body">
          <span class="eyebrow"><span class="dot"></span> ${esc(cs.tag)}</span>
          <h3>${esc(cs.title)}</h3>
          <p class="case-desc">${esc(cs.desc)}</p>
          <div class="case-result">${checkIcon()} <span><strong>Result:</strong> ${esc(cs.result)}</span></div>
          <span class="case-card-cta">Read full case study <span class="arrow">→</span></span>
        </div>
      </div>`
      )
      .join("");

    el.querySelectorAll(".case-card").forEach((card) => {
      const cs = content.caseStudies.find((c) => c.id === card.dataset.caseId);
      const open = () => overlay && overlay.openWith(cs);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // ---------------------------------------------------------
  // Footer + contact info (present on every page)
  // ---------------------------------------------------------
  function applyContactInfo(content) {
    const c = content.contact;
    const footerEmail = document.getElementById("footer-email");
    if (footerEmail) {
      footerEmail.textContent = c.email;
      footerEmail.href = "mailto:" + c.email;
    }
    const contactPageEmail = document.getElementById("contact-page-email");
    if (contactPageEmail) {
      contactPageEmail.textContent = c.email;
      contactPageEmail.href = "mailto:" + c.email;
    }

    const socialMap = {
      "footer-social-linkedin": c.social.linkedin,
      "footer-social-twitter": c.social.twitter,
      "footer-social-youtube": c.social.youtube,
      "footer-social-instagram": c.social.instagram,
      "contact-social-linkedin": c.social.linkedin,
      "contact-social-instagram": c.social.instagram
    };
    Object.entries(socialMap).forEach(([id, url]) => {
      const a = document.getElementById(id);
      if (a && url) a.href = url;
    });
  }

  // ---------------------------------------------------------
  // Boot
  // ---------------------------------------------------------
  async function boot() {
    try {
      const [content, themes] = await Promise.all([
        fetch("/api/content").then((r) => r.json()),
        fetch("/api/themes").then((r) => r.json())
      ]);

      applyTheme(content.theme, themes);
      applyTextFields(content);
      applyContactInfo(content);

      renderPageVideo("home-video-section", "home-video-frame", content.pages.home.video);
      renderPageVideo("services-video-section", "services-video-frame", content.pages.services.video);
      renderPageVideo("team-video-section", "team-video-frame", content.pages.team.video);

      renderHomeServices(content);
      renderHomeFounders(content);
      renderHomeProcess(content);
      renderHomeCaseTeaser(content);

      renderServicesPage(content);
      renderTeamFounders(content);
      renderProcessTimeline(content);
      renderProcessFaq(content);
      renderCaseGrid(content);

      document.dispatchEvent(new CustomEvent("nodecraft:content-ready", { detail: content }));
    } catch (err) {
      console.error("NodeCraft: failed to load site content from the server.", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

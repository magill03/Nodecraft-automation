// =========================================================
// NodeCraft Automation — Admin Panel (admin.js)
// =========================================================

(function () {
  "use strict";

  const state = { content: null, themes: null, section: "dashboard" };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------
  // API helper
  // ---------------------------------------------------------
  async function api(path, method, body) {
    const opts = { method: method || "GET", headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || "Something went wrong.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg, isError) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("error-toast", !!isError);
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  async function refreshContent() {
    const [content, themes] = await Promise.all([api("/api/content"), api("/api/themes")]);
    state.content = content;
    state.themes = themes;
  }

  // ---------------------------------------------------------
  // Auth flow
  // ---------------------------------------------------------
  async function checkSession() {
    const session = await api("/api/session");
    if (session.loggedIn) {
      showShell();
      if (session.mustChangePassword) {
        toast("Reminder: change the default admin password before this site goes live.");
      }
    } else {
      showLogin();
    }
  }

  function showLogin() {
    $("#loginScreen").classList.remove("admin-hidden");
    $("#adminShell").classList.add("admin-hidden");
  }

  async function showShell() {
    $("#loginScreen").classList.add("admin-hidden");
    $("#adminShell").classList.remove("admin-hidden");
    await refreshContent();
    goToSection("dashboard");
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#loginUsername").value.trim();
    const password = $("#loginPassword").value;
    const btn = $("#loginBtn");
    const errBox = $("#loginError");
    errBox.classList.add("admin-hidden");
    btn.disabled = true;
    btn.textContent = "Logging in…";
    try {
      const res = await api("/api/login", "POST", { username, password });
      await showShell();
      if (res.mustChangePassword) {
        toast("You're in! Please change the default password from Account & Password.");
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove("admin-hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Log In";
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", "POST");
    showLogin();
  });

  // ---------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------
  const SECTION_TITLES = {
    dashboard: "Dashboard",
    "page-home": "Home Page — Text",
    "page-services": "Services Page — Text",
    "page-team": "Founders Page — Text",
    "page-process": "How We Work Page — Text",
    "page-casestudies": "Case Studies Page — Text",
    "page-contact": "Contact Page — Text",
    services: "Manage Services",
    founders: "Manage Founders",
    casestudies: "Manage Case Studies",
    "contact-info": "Contact & Social Links",
    theme: "Color Theme",
    account: "Account & Password"
  };

  function goToSection(section) {
    state.section = section;
    $("#topbarTitle").textContent = SECTION_TITLES[section] || "Dashboard";
    $$(".admin-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.section === section));
    render();
  }

  $$(".admin-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToSection(btn.dataset.section));
  });

  // ---------------------------------------------------------
  // Render dispatcher
  // ---------------------------------------------------------
  function render() {
    const root = $("#adminContent");
    switch (state.section) {
      case "dashboard": return renderDashboard(root);
      case "page-home": return renderPageEditor(root, "home", HOME_FIELDS, true);
      case "page-services": return renderPageEditor(root, "services", SERVICES_PAGE_FIELDS, true);
      case "page-team": return renderPageEditor(root, "team", TEAM_FIELDS, true);
      case "page-process": return renderProcessPageEditor(root);
      case "page-casestudies": return renderPageEditor(root, "caseStudies", CASESTUDIES_PAGE_FIELDS);
      case "page-contact": return renderPageEditor(root, "contact", CONTACT_PAGE_FIELDS);
      case "services": return renderServices(root);
      case "founders": return renderFounders(root);
      case "casestudies": return renderCaseStudies(root);
      case "contact-info": return renderContactInfo(root);
      case "theme": return renderTheme(root);
      case "account": return renderAccount(root);
    }
  }

  // ---------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------
  const DASH_TILES = [
    { section: "page-home", label: "Home Page", desc: "Hero, section headings & intros", icon: "home" },
    { section: "page-services", label: "Services Page", desc: "Hero text & pricing note", icon: "grid" },
    { section: "page-team", label: "Founders Page", desc: "Hero & shared team copy", icon: "users" },
    { section: "page-process", label: "How We Work Page", desc: "Timeline steps & FAQ", icon: "steps" },
    { section: "page-casestudies", label: "Case Studies Page", desc: "Hero & note text", icon: "case" },
    { section: "page-contact", label: "Contact Page", desc: "Hero & contact person", icon: "mail" },
    { section: "services", label: "Manage Services", desc: "Add, edit, remove & price services", icon: "grid" },
    { section: "founders", label: "Manage Founders", desc: "Profiles, bios, skills & headshots", icon: "users" },
    { section: "casestudies", label: "Manage Case Studies", desc: "Add, edit, remove & upload thumbnails", icon: "case" },
    { section: "contact-info", label: "Contact & Social Links", desc: "Email address & social URLs", icon: "mail" },
    { section: "theme", label: "Color Theme", desc: "Switch the live site's color palette", icon: "theme" },
    { section: "account", label: "Account & Password", desc: "Change your admin login", icon: "lock" }
  ];
  const DASH_ICONS = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="18" cy="9" r="2.5"/><path d="M22 20c0-3-1.8-5-4.5-5.5"/>',
    steps: '<path d="M4 6h4M4 12h8M4 18h12"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
    lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>'
  };

  function renderDashboard(root) {
    root.innerHTML = `
      <p class="muted-note" style="margin-bottom: var(--space-3);">Welcome back. Pick a section below, or use the sidebar — everything you save here updates the live website immediately.</p>
      <div class="dash-grid">
        ${DASH_TILES.map((t) => `
          <button class="dash-tile" data-goto="${t.section}">
            <div class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${DASH_ICONS[t.icon]}</svg></div>
            <h4>${t.label}</h4>
            <p>${t.desc}</p>
          </button>`).join("")}
      </div>`;
    $$("[data-goto]", root).forEach((b) => b.addEventListener("click", () => goToSection(b.dataset.goto)));
  }

  // ---------------------------------------------------------
  // Generic page-text field editor
  // Each entry: { key, label, type: 'text'|'textarea'|'html' }
  // ---------------------------------------------------------
  const HOME_FIELDS = [
    { key: "heroEyebrow", label: "Hero — small label", type: "text" },
    { key: "heroHeading", label: "Hero — heading (HTML allowed, e.g. <span class=\"accent\">)", type: "html" },
    { key: "heroDesc", label: "Hero — description", type: "textarea" },
    { key: "whyEyebrow", label: "\"Why Automation\" — small label", type: "text" },
    { key: "whyHeading", label: "\"Why Automation\" — heading", type: "text" },
    { key: "whyDesc", label: "\"Why Automation\" — description", type: "textarea" },
    { key: "servicesEyebrow", label: "Services teaser — small label", type: "text" },
    { key: "servicesHeading", label: "Services teaser — heading", type: "text" },
    { key: "servicesDesc", label: "Services teaser — description", type: "textarea" },
    { key: "teamEyebrow", label: "Founders teaser — small label", type: "text" },
    { key: "teamHeading", label: "Founders teaser — heading", type: "text" },
    { key: "teamDesc", label: "Founders teaser — description", type: "textarea" },
    { key: "processEyebrow", label: "Process teaser — small label", type: "text" },
    { key: "processHeading", label: "Process teaser — heading", type: "text" },
    { key: "processDesc", label: "Process teaser — description", type: "textarea" },
    { key: "caseEyebrow", label: "Case study teaser — small label", type: "text" },
    { key: "caseHeading", label: "Case study teaser — heading", type: "text" },
    { key: "caseDesc", label: "Case study teaser — description", type: "textarea" },
    { key: "ctaEyebrow", label: "Closing CTA — small label", type: "text" },
    { key: "ctaHeading", label: "Closing CTA — heading", type: "text" },
    { key: "ctaDesc", label: "Closing CTA — description", type: "textarea" }
  ];
  const SERVICES_PAGE_FIELDS = [
    { key: "heroEyebrow", label: "Hero — small label", type: "text" },
    { key: "heroHeading", label: "Hero — heading", type: "text" },
    { key: "heroDesc", label: "Hero — description", type: "textarea" },
    { key: "pricingNote", label: "Note shown under the pricing grid", type: "textarea" },
    { key: "scopeEyebrow", label: "\"How We Scope\" — small label", type: "text" },
    { key: "scopeHeading", label: "\"How We Scope\" — heading", type: "text" },
    { key: "scopeDesc", label: "\"How We Scope\" — description", type: "textarea" },
    { key: "ctaEyebrow", label: "Closing CTA — small label", type: "text" },
    { key: "ctaHeading", label: "Closing CTA — heading", type: "text" },
    { key: "ctaDesc", label: "Closing CTA — description", type: "textarea" }
  ];
  const TEAM_FIELDS = [
    { key: "heroEyebrow", label: "Hero — small label", type: "text" },
    { key: "heroHeading", label: "Hero — heading", type: "text" },
    { key: "heroDesc", label: "Hero — description", type: "textarea" },
    { key: "whyEyebrow", label: "\"Why We Work Well Together\" — small label", type: "text" },
    { key: "whyHeading", label: "\"Why We Work Well Together\" — heading", type: "text" },
    { key: "whyDesc", label: "\"Why We Work Well Together\" — description", type: "textarea" },
    { key: "foundationText", label: "Foundation banner text (HTML allowed)", type: "html" },
    { key: "ctaEyebrow", label: "Closing CTA — small label", type: "text" },
    { key: "ctaHeading", label: "Closing CTA — heading", type: "text" },
    { key: "ctaDesc", label: "Closing CTA — description", type: "textarea" }
  ];
  const CASESTUDIES_PAGE_FIELDS = [
    { key: "heroEyebrow", label: "Hero — small label", type: "text" },
    { key: "heroHeading", label: "Hero — heading", type: "text" },
    { key: "heroDesc", label: "Hero — description", type: "textarea" },
    { key: "note", label: "Note shown above the case study grid", type: "textarea" },
    { key: "ctaEyebrow", label: "Closing CTA — small label", type: "text" },
    { key: "ctaHeading", label: "Closing CTA — heading", type: "text" },
    { key: "ctaDesc", label: "Closing CTA — description", type: "textarea" }
  ];
  const CONTACT_PAGE_FIELDS = [
    { key: "heroEyebrow", label: "Hero — small label", type: "text" },
    { key: "heroHeading", label: "Hero — heading", type: "text" },
    { key: "heroDesc", label: "Hero — description", type: "textarea" },
    { key: "formSuccessHeading", label: "Form success — heading", type: "text" },
    { key: "formSuccessDesc", label: "Form success — description", type: "textarea" },
    { key: "personName", label: "Contact person — name", type: "text" },
    { key: "personRole", label: "Contact person — role", type: "text" },
    { key: "personBlurb", label: "Contact person — short blurb", type: "textarea" }
  ];

  function renderPageEditor(root, pageKey, fields, hasVideo) {
    const data = state.content.pages[pageKey];
    root.innerHTML = `
      <div class="admin-card">
        <h3>Editable text on this page</h3>
        <p class="card-desc">Update any field and hit Save — the live page updates immediately.</p>
        <form id="pageForm">
          ${fields.map((f) => `
            <div class="field">
              <label>${f.label}</label>
              ${f.type === "textarea" || f.type === "html"
                ? `<textarea name="${f.key}">${esc(data[f.key] || "")}</textarea>`
                : `<input type="text" name="${f.key}" value="${esc(data[f.key] || "")}">`}
            </div>`).join("")}
          <button type="submit" class="btn-admin primary" style="width:auto;">Save Changes</button>
        </form>
      </div>
      ${hasVideo ? videoCardTemplate(data.video) : ""}`;

    $("#pageForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {};
      fields.forEach((f) => { payload[f.key] = $(`[name="${f.key}"]`, e.target).value; });
      try {
        await api(`/api/pages/${pageKey}`, "PUT", payload);
        await refreshContent();
        toast("Saved — the live page is updated.");
      } catch (err) {
        toast(err.message, true);
      }
    });

    if (hasVideo) wireVideoCard(root, pageKey);
  }

  // ---------------------------------------------------------
  // Shared "Demo Video" card — used on Home, Services, and
  // Founders page editors. Accepts either a pasted YouTube/Vimeo
  // link or an uploaded video file.
  // ---------------------------------------------------------
  function videoCardTemplate(videoUrl) {
    return `
      <div class="admin-card">
        <h3>Demo Video</h3>
        <p class="card-desc">Paste a YouTube or Vimeo link, or upload a video file. Leave blank to hide the video section on this page.</p>
        <div class="field">
          <label>Video link (YouTube, Vimeo, or a direct video URL)</label>
          <input type="text" id="videoUrlInput" placeholder="https://www.youtube.com/watch?v=..." value="${esc(videoUrl || "")}">
        </div>
        <div class="upload-row">
          <div class="thumb-preview" id="videoThumbPreview">${videoUrl && !isLikelyLink(videoUrl) ? "🎬" : ""}</div>
          <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" id="videoFileInput">
        </div>
        <p class="hint">Uploaded video files can take a little while to upload depending on file size (up to 150MB).</p>
        <div style="display:flex; gap:0.6rem; margin-top: var(--space-2);">
          <button type="button" class="btn-admin primary" id="saveVideoBtn" style="width:auto;">Save Video</button>
          <button type="button" class="btn-admin secondary" id="removeVideoBtn" style="width:auto;">Remove Video</button>
        </div>
      </div>`;
  }

  function isLikelyLink(url) {
    return /^https?:\/\//.test(url) && (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com"));
  }

  function wireVideoCard(root, pageKey) {
    const urlInput = $("#videoUrlInput", root);
    const fileInput = $("#videoFileInput", root);
    const preview = $("#videoThumbPreview", root);

    fileInput.addEventListener("change", async () => {
      if (!fileInput.files[0]) return;
      try {
        toast("Uploading video… this may take a moment.");
        const url = await uploadVideo(fileInput.files[0]);
        urlInput.value = url;
        preview.textContent = "🎬";
        toast("Video uploaded — click Save Video to apply it.");
      } catch (err) { toast(err.message, true); }
    });

    $("#saveVideoBtn", root).addEventListener("click", async () => {
      try {
        await api(`/api/pages/${pageKey}`, "PUT", { video: urlInput.value.trim() });
        await refreshContent();
        toast("Video saved — live site updated.");
      } catch (err) { toast(err.message, true); }
    });

    $("#removeVideoBtn", root).addEventListener("click", async () => {
      urlInput.value = "";
      preview.textContent = "";
      try {
        await api(`/api/pages/${pageKey}`, "PUT", { video: "" });
        await refreshContent();
        toast("Video removed — live site updated.");
      } catch (err) { toast(err.message, true); }
    });
  }

  // Process page also has editable timeline steps + FAQ text
  function renderProcessPageEditor(root) {
    const data = state.content.pages.process;
    root.innerHTML = `
      <div class="admin-card">
        <h3>Editable text on this page</h3>
        <form id="pageForm">
          ${CASESTUDIES_LIKE_PROCESS_HEADER(data)}
          <button type="submit" class="btn-admin primary" style="width:auto;">Save Page Text</button>
        </form>
      </div>

      <div class="admin-card">
        <h3>"How We Work" Timeline Steps</h3>
        <p class="card-desc">These same five steps also power the 3-step preview on the Home page.</p>
        <div id="stepsList"></div>
        <button type="button" class="btn-admin secondary small" id="saveStepsBtn" style="margin-top: var(--space-2);">Save Steps</button>
      </div>

      <div class="admin-card">
        <h3>FAQ</h3>
        <div id="faqList"></div>
        <button type="button" class="btn-admin secondary small" id="saveFaqBtn" style="margin-top: var(--space-2);">Save FAQ</button>
      </div>`;

    $("#pageForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        heroEyebrow: $('[name="heroEyebrow"]', e.target).value,
        heroHeading: $('[name="heroHeading"]', e.target).value,
        heroDesc: $('[name="heroDesc"]', e.target).value,
        faqEyebrow: $('[name="faqEyebrow"]', e.target).value,
        faqHeading: $('[name="faqHeading"]', e.target).value,
        faqDesc: $('[name="faqDesc"]', e.target).value,
        ctaEyebrow: $('[name="ctaEyebrow"]', e.target).value,
        ctaHeading: $('[name="ctaHeading"]', e.target).value,
        ctaDesc: $('[name="ctaDesc"]', e.target).value
      };
      try {
        await api("/api/pages/process", "PUT", payload);
        await refreshContent();
        toast("Saved — the live page is updated.");
      } catch (err) { toast(err.message, true); }
    });

    // Steps editor
    const stepsList = $("#stepsList", root);
    function drawSteps() {
      stepsList.innerHTML = data.steps.map((s, i) => `
        <div class="item-row" style="margin-bottom: 0.6rem;">
          <div class="field"><label>Step ${i + 1} title</label><input type="text" data-step="${i}" data-field="title" value="${esc(s.title)}"></div>
          <div class="field"><label>Step ${i + 1} description</label><textarea data-step="${i}" data-field="desc">${esc(s.desc)}</textarea></div>
          <div class="field"><label>Badge (optional, e.g. "Optional")</label><input type="text" data-step="${i}" data-field="badge" value="${esc(s.badge || "")}"></div>
        </div>`).join("");
    }
    drawSteps();
    $("#saveStepsBtn", root).addEventListener("click", async () => {
      const steps = data.steps.map((s, i) => ({
        title: $(`[data-step="${i}"][data-field="title"]`, stepsList).value,
        desc: $(`[data-step="${i}"][data-field="desc"]`, stepsList).value,
        badge: $(`[data-step="${i}"][data-field="badge"]`, stepsList).value
      }));
      try {
        await api("/api/pages/process", "PUT", { steps });
        await refreshContent();
        toast("Timeline steps saved.");
      } catch (err) { toast(err.message, true); }
    });

    // FAQ editor
    const faqList = $("#faqList", root);
    function drawFaq() {
      faqList.innerHTML = data.faqs.map((f, i) => `
        <div class="item-row faq-edit-item">
          <div class="field"><label>Question ${i + 1}</label><input type="text" data-faq="${i}" data-field="q" value="${esc(f.q)}"></div>
          <div class="field"><label>Answer ${i + 1}</label><textarea data-faq="${i}" data-field="a">${esc(f.a)}</textarea></div>
        </div>`).join("");
    }
    drawFaq();
    $("#saveFaqBtn", root).addEventListener("click", async () => {
      const faqs = data.faqs.map((f, i) => ({
        q: $(`[data-faq="${i}"][data-field="q"]`, faqList).value,
        a: $(`[data-faq="${i}"][data-field="a"]`, faqList).value
      }));
      try {
        await api("/api/pages/process", "PUT", { faqs });
        await refreshContent();
        toast("FAQ saved.");
      } catch (err) { toast(err.message, true); }
    });
  }
  function CASESTUDIES_LIKE_PROCESS_HEADER(data) {
    return `
      <div class="field"><label>Hero — small label</label><input type="text" name="heroEyebrow" value="${esc(data.heroEyebrow)}"></div>
      <div class="field"><label>Hero — heading</label><input type="text" name="heroHeading" value="${esc(data.heroHeading)}"></div>
      <div class="field"><label>Hero — description</label><textarea name="heroDesc">${esc(data.heroDesc)}</textarea></div>
      <div class="field"><label>FAQ section — small label</label><input type="text" name="faqEyebrow" value="${esc(data.faqEyebrow)}"></div>
      <div class="field"><label>FAQ section — heading</label><input type="text" name="faqHeading" value="${esc(data.faqHeading)}"></div>
      <div class="field"><label>FAQ section — description</label><textarea name="faqDesc">${esc(data.faqDesc)}</textarea></div>
      <div class="field"><label>Closing CTA — small label</label><input type="text" name="ctaEyebrow" value="${esc(data.ctaEyebrow)}"></div>
      <div class="field"><label>Closing CTA — heading</label><input type="text" name="ctaHeading" value="${esc(data.ctaHeading)}"></div>
      <div class="field"><label>Closing CTA — description</label><textarea name="ctaDesc">${esc(data.ctaDesc)}</textarea></div>`;
  }

  // ---------------------------------------------------------
  // Image upload helper — used by founders & case studies
  // ---------------------------------------------------------
  async function uploadImage(file) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    return data.url;
  }

  async function uploadVideo(file) {
    const fd = new FormData();
    fd.append("video", file);
    const res = await fetch("/api/upload-video", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Video upload failed.");
    return data.url;
  }

  // ---------------------------------------------------------
  // Services manager
  // ---------------------------------------------------------
  const SERVICE_ICONS = ["workflow", "integration", "ai", "support"];

  function renderServices(root) {
    root.innerHTML = `
      <div class="admin-card">
        <h3>Services</h3>
        <p class="card-desc">Add, edit, remove, and price the services shown on the Services page (and featured on the Home page).</p>
        <div class="item-list" id="servicesList"></div>
        <button class="btn-admin secondary small" id="addServiceBtn" style="margin-top: var(--space-2);">+ Add Service</button>
      </div>`;

    drawServiceList();

    $("#addServiceBtn", root).addEventListener("click", async () => {
      try {
        await api("/api/services", "POST", {
          title: "New Service",
          desc: "Describe this service.",
          price: "0",
          priceUnit: "/ project",
          icon: "workflow",
          features: []
        });
        await refreshContent();
        drawServiceList();
        toast("Service added — edit the details below.");
      } catch (err) { toast(err.message, true); }
    });
  }

  function drawServiceList() {
    const list = $("#servicesList");
    if (!list) return;
    const services = state.content.services;
    list.innerHTML = services.map((s, i) => serviceRowTemplate(s, i)).join("");

    services.forEach((s) => {
      const row = $(`.item-row[data-id="${s.id}"]`, list);
      $(".item-row-head", row).addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        $(".item-body", row).classList.toggle("open");
      });
      $(".btn-delete", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Remove "${s.title}"? This can't be undone.`)) return;
        try {
          await api(`/api/services/${s.id}`, "DELETE");
          await refreshContent();
          drawServiceList();
          toast("Service removed.");
        } catch (err) { toast(err.message, true); }
      });
      $(".btn-save", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        const body = row.querySelector(".item-body");
        const payload = {
          title: $('[data-f="title"]', body).value,
          desc: $('[data-f="desc"]', body).value,
          price: $('[data-f="price"]', body).value,
          priceUnit: $('[data-f="priceUnit"]', body).value,
          icon: $('[data-f="icon"]', body).value,
          features: Array.from($$(".tag-chip", body)).map((c) => c.dataset.value)
        };
        try {
          await api(`/api/services/${s.id}`, "PUT", payload);
          await refreshContent();
          drawServiceList();
          toast("Service saved — live site updated.");
        } catch (err) { toast(err.message, true); }
      });

      // feature tag editor
      const body = $(`.item-row[data-id="${s.id}"] .item-body`);
      wireTagEditor(body, s.features || []);
    });
  }

  function serviceRowTemplate(s, i) {
    return `
      <div class="item-row" data-id="${s.id}">
        <div class="item-row-head">
          <div>
            <div class="name">${esc(s.title)}</div>
            <div class="meta">$${esc(s.price)} ${esc(s.priceUnit)}</div>
          </div>
          <div class="item-row-actions">
            <button class="btn-admin secondary small btn-save">Save</button>
            <button class="btn-admin danger small btn-delete">Remove</button>
          </div>
        </div>
        <div class="item-body">
          <div class="field"><label>Title</label><input type="text" data-f="title" value="${esc(s.title)}"></div>
          <div class="field"><label>Description</label><textarea data-f="desc">${esc(s.desc)}</textarea></div>
          <div class="field-row">
            <div class="field"><label>Price (number only)</label><input type="text" data-f="price" value="${esc(s.price)}"></div>
            <div class="field"><label>Price unit</label><input type="text" data-f="priceUnit" value="${esc(s.priceUnit)}"></div>
          </div>
          <div class="field">
            <label>Icon</label>
            <select data-f="icon">
              ${SERVICE_ICONS.map((ic) => `<option value="${ic}" ${ic === s.icon ? "selected" : ""}>${ic}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Feature bullets</label>
            <div class="tag-editor"></div>
            <div class="add-tag-row">
              <input type="text" class="new-tag-input" placeholder="Add a feature and press Enter">
              <button type="button" class="btn-admin secondary small add-tag-btn">Add</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function wireTagEditor(container, initialTags) {
    const editor = $(".tag-editor", container);
    const input = $(".new-tag-input", container);
    const addBtn = $(".add-tag-btn", container);
    let tags = initialTags.slice();

    function draw() {
      editor.innerHTML = tags.map((t) => `<span class="tag-chip" data-value="${esc(t)}">${t}<button type="button" data-remove>&times;</button></span>`).join("");
      $$("[data-remove]", editor).forEach((btn) => {
        btn.addEventListener("click", () => {
          const chip = btn.closest(".tag-chip");
          tags = tags.filter((t) => t !== chip.dataset.value);
          draw();
        });
      });
    }
    draw();

    function addTag() {
      const val = input.value.trim();
      if (!val) return;
      tags.push(val);
      input.value = "";
      draw();
    }
    addBtn.addEventListener("click", addTag);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addTag(); }
    });
  }

  // ---------------------------------------------------------
  // Founders manager
  // ---------------------------------------------------------
  function renderFounders(root) {
    root.innerHTML = `
      <div class="admin-card">
        <h3>Founder Profiles</h3>
        <p class="card-desc">Each founder's name, title, bio, skills, and headshot can be edited independently — changes appear on both the Founders page and the Home page teaser.</p>
        <div class="item-list" id="foundersList"></div>
        <button class="btn-admin secondary small" id="addFounderBtn" style="margin-top: var(--space-2);">+ Add Founder</button>
      </div>`;

    drawFoundersList();

    $("#addFounderBtn", root).addEventListener("click", async () => {
      try {
        await api("/api/founders", "POST", {
          name: "New Founder", role: "Role / Title", eyebrow: "Pillar", pillarOwner: "Pillar",
          initials: "NF", tone: "cyan", photo: "", bio: "Add a short bio.", skills: []
        });
        await refreshContent();
        drawFoundersList();
        toast("Founder added — edit the details below.");
      } catch (err) { toast(err.message, true); }
    });
  }

  function drawFoundersList() {
    const list = $("#foundersList");
    if (!list) return;
    const founders = state.content.founders;
    list.innerHTML = founders.map((f) => founderRowTemplate(f)).join("");

    founders.forEach((f) => {
      const row = $(`.item-row[data-id="${f.id}"]`, list);
      $(".item-row-head", row).addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        $(".item-body", row).classList.toggle("open");
      });
      $(".btn-delete", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Remove ${f.name}? This can't be undone.`)) return;
        try {
          await api(`/api/founders/${f.id}`, "DELETE");
          await refreshContent();
          drawFoundersList();
          toast("Founder removed.");
        } catch (err) { toast(err.message, true); }
      });

      const body = $(`.item-row[data-id="${f.id}"] .item-body`);
      let currentPhoto = f.photo;
      wireTagEditor(body, f.skills || []);

      const fileInput = $('input[type=file]', body);
      const preview = $(".thumb-preview", body);
      fileInput.addEventListener("change", async () => {
        if (!fileInput.files[0]) return;
        try {
          toast("Uploading photo…");
          const url = await uploadImage(fileInput.files[0]);
          currentPhoto = url;
          preview.innerHTML = `<img src="${url}" alt="">`;
          toast("Photo uploaded — click Save to apply it.");
        } catch (err) { toast(err.message, true); }
      });

      $(".btn-save", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        const payload = {
          name: $('[data-f="name"]', body).value,
          role: $('[data-f="role"]', body).value,
          eyebrow: $('[data-f="eyebrow"]', body).value,
          pillarOwner: $('[data-f="eyebrow"]', body).value,
          initials: $('[data-f="initials"]', body).value,
          tone: $('[data-f="tone"]', body).value,
          bio: $('[data-f="bio"]', body).value,
          photo: currentPhoto,
          skills: Array.from($$(".tag-chip", body)).map((c) => c.dataset.value)
        };
        try {
          await api(`/api/founders/${f.id}`, "PUT", payload);
          await refreshContent();
          drawFoundersList();
          toast("Founder saved — live site updated.");
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  function founderRowTemplate(f) {
    return `
      <div class="item-row" data-id="${f.id}">
        <div class="item-row-head">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="thumb-preview">${f.photo ? `<img src="${esc(f.photo)}" alt="">` : `<span style="font-size:0.7rem;color:var(--text-muted);">${esc(f.initials || "")}</span>`}</div>
            <div>
              <div class="name">${esc(f.name)}</div>
              <div class="meta">${f.role}</div>
            </div>
          </div>
          <div class="item-row-actions">
            <button class="btn-admin secondary small btn-save">Save</button>
            <button class="btn-admin danger small btn-delete">Remove</button>
          </div>
        </div>
        <div class="item-body">
          <div class="field-row">
            <div class="field"><label>Name</label><input type="text" data-f="name" value="${esc(f.name)}"></div>
            <div class="field"><label>Title / Role</label><input type="text" data-f="role" value="${f.role || ""}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Pillar label (e.g. "Delivery")</label><input type="text" data-f="eyebrow" value="${esc(f.eyebrow)}"></div>
            <div class="field"><label>Avatar initials (used if no photo)</label><input type="text" data-f="initials" maxlength="3" value="${esc(f.initials)}"></div>
          </div>
          <div class="field">
            <label>Accent color for the generated avatar</label>
            <select data-f="tone">
              <option value="cyan" ${f.tone === "cyan" ? "selected" : ""}>Cyan</option>
              <option value="blue" ${f.tone === "blue" ? "selected" : ""}>Blue</option>
            </select>
          </div>
          <div class="field"><label>Bio</label><textarea data-f="bio">${esc(f.bio)}</textarea></div>
          <div class="field">
            <label>Skills</label>
            <div class="tag-editor"></div>
            <div class="add-tag-row">
              <input type="text" class="new-tag-input" placeholder="Add a skill and press Enter">
              <button type="button" class="btn-admin secondary small add-tag-btn">Add</button>
            </div>
          </div>
          <div class="field">
            <label>Headshot photo</label>
            <div class="upload-row">
              <div class="thumb-preview">${f.photo ? `<img src="${esc(f.photo)}" alt="">` : ""}</div>
              <input type="file" accept="image/*">
            </div>
            <p class="hint">Uploading replaces the generated initials avatar. Click Save after uploading to apply it.</p>
          </div>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------
  // Case Studies manager
  // ---------------------------------------------------------
  function renderCaseStudies(root) {
    root.innerHTML = `
      <div class="admin-card">
        <h3>Case Studies</h3>
        <p class="card-desc">Add, edit, or remove case studies at any time — swap in real client results as projects wrap up.</p>
        <div class="item-list" id="caseList"></div>
        <button class="btn-admin secondary small" id="addCaseBtn" style="margin-top: var(--space-2);">+ Add Case Study</button>
      </div>`;

    drawCaseList();

    $("#addCaseBtn", root).addEventListener("click", async () => {
      try {
        await api("/api/caseStudies", "POST", {
          tag: "New Industry", title: "New Case Study Title",
          desc: "Short summary shown on the card.",
          result: "Key result headline.",
          problem: "Describe the problem the client had.",
          automation: "Describe the automation you built.",
          resultFull: "Describe the full result in detail.",
          sample: true, thumbnail: "", video: ""
        });
        await refreshContent();
        drawCaseList();
        toast("Case study added — edit the details below.");
      } catch (err) { toast(err.message, true); }
    });
  }

  function drawCaseList() {
    const list = $("#caseList");
    if (!list) return;
    const items = state.content.caseStudies;
    list.innerHTML = items.map((c) => caseRowTemplate(c)).join("");

    items.forEach((c) => {
      const row = $(`.item-row[data-id="${c.id}"]`, list);
      $(".item-row-head", row).addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        $(".item-body", row).classList.toggle("open");
      });
      $(".btn-delete", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Remove "${c.title}"? This can't be undone.`)) return;
        try {
          await api(`/api/caseStudies/${c.id}`, "DELETE");
          await refreshContent();
          drawCaseList();
          toast("Case study removed.");
        } catch (err) { toast(err.message, true); }
      });

      const body = $(`.item-row[data-id="${c.id}"] .item-body`);
      let currentThumb = c.thumbnail;
      const fileInput = $('input[type=file]:not(.video-file-input)', body);
      const preview = $(".thumb-preview:not(.video-thumb-preview)", body);
      fileInput.addEventListener("change", async () => {
        if (!fileInput.files[0]) return;
        try {
          toast("Uploading image…");
          const url = await uploadImage(fileInput.files[0]);
          currentThumb = url;
          preview.innerHTML = `<img src="${url}" alt="">`;
          toast("Image uploaded — click Save to apply it.");
        } catch (err) { toast(err.message, true); }
      });

      const videoFileInput = $(".video-file-input", body);
      const videoUrlField = $('[data-f="video"]', body);
      const videoPreview = $(".video-thumb-preview", body);
      videoFileInput.addEventListener("change", async () => {
        if (!videoFileInput.files[0]) return;
        try {
          toast("Uploading video… this may take a moment.");
          const url = await uploadVideo(videoFileInput.files[0]);
          videoUrlField.value = url;
          videoPreview.textContent = "🎬";
          toast("Video uploaded — click Save to apply it.");
        } catch (err) { toast(err.message, true); }
      });

      $(".btn-save", row).addEventListener("click", async (e) => {
        e.stopPropagation();
        const payload = {
          tag: $('[data-f="tag"]', body).value,
          title: $('[data-f="title"]', body).value,
          desc: $('[data-f="desc"]', body).value,
          result: $('[data-f="result"]', body).value,
          problem: $('[data-f="problem"]', body).value,
          automation: $('[data-f="automation"]', body).value,
          resultFull: $('[data-f="resultFull"]', body).value,
          sample: $('[data-f="sample"]', body).checked,
          thumbnail: currentThumb,
          video: videoUrlField.value.trim()
        };
        try {
          await api(`/api/caseStudies/${c.id}`, "PUT", payload);
          await refreshContent();
          drawCaseList();
          toast("Case study saved — live site updated.");
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  function caseRowTemplate(c) {
    return `
      <div class="item-row" data-id="${c.id}">
        <div class="item-row-head">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="thumb-preview">${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="">` : ""}</div>
            <div>
              <div class="name">${esc(c.title)}</div>
              <div class="meta">${esc(c.tag)}</div>
            </div>
          </div>
          <div class="item-row-actions">
            <button class="btn-admin secondary small btn-save">Save</button>
            <button class="btn-admin danger small btn-delete">Remove</button>
          </div>
        </div>
        <div class="item-body">
          <div class="field-row">
            <div class="field"><label>Industry / tag</label><input type="text" data-f="tag" value="${esc(c.tag)}"></div>
            <div class="field"><label>Title</label><input type="text" data-f="title" value="${esc(c.title)}"></div>
          </div>
          <div class="field"><label>Card summary (short)</label><textarea data-f="desc">${esc(c.desc)}</textarea></div>
          <div class="field"><label>Card result line (short)</label><input type="text" data-f="result" value="${esc(c.result)}"></div>
          <div class="divider"></div>
          <p class="muted-note" style="margin-bottom:0.6rem;">Shown in the full pop-up when a visitor clicks this case study:</p>
          <div class="field"><label>The Problem</label><textarea data-f="problem">${esc(c.problem)}</textarea></div>
          <div class="field"><label>The Automation</label><textarea data-f="automation">${esc(c.automation)}</textarea></div>
          <div class="field"><label>The Result (full)</label><textarea data-f="resultFull">${esc(c.resultFull)}</textarea></div>
          <div class="field">
            <label><input type="checkbox" data-f="sample" ${c.sample ? "checked" : ""} style="width:auto; margin-right:0.4rem;">This is a sample/placeholder project (shows an "Sample Project" tag)</label>
          </div>
          <div class="field">
            <label>Thumbnail image</label>
            <div class="upload-row">
              <div class="thumb-preview">${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="">` : ""}</div>
              <input type="file" accept="image/*">
            </div>
            <p class="hint">Uploading replaces the generated diagram graphic. Click Save after uploading to apply it.</p>
          </div>
          <div class="field">
            <label>Project video (optional)</label>
            <input type="text" data-f="video" placeholder="https://www.youtube.com/watch?v=..." value="${esc(c.video || "")}">
            <div class="upload-row">
              <div class="thumb-preview video-thumb-preview">${c.video && !/youtube\.com|youtu\.be|vimeo\.com/.test(c.video) ? "🎬" : ""}</div>
              <input type="file" class="video-file-input" accept="video/mp4,video/webm,video/ogg,video/quicktime">
            </div>
            <p class="hint">Paste a YouTube/Vimeo link above, or upload a video file (up to 150MB). Shown when this case study's pop-up is opened.</p>
          </div>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------
  // Contact & social links
  // ---------------------------------------------------------
  function renderContactInfo(root) {
    const c = state.content.contact;
    root.innerHTML = `
      <div class="admin-card">
        <h3>Contact Email</h3>
        <p class="card-desc">Shown in the site footer and on the Contact page.</p>
        <div class="field"><label>Email address</label><input type="email" id="contactEmail" value="${esc(c.email)}"></div>
      </div>
      <div class="admin-card">
        <h3>Social Media Links</h3>
        <div class="field"><label>LinkedIn URL</label><input type="text" id="socialLinkedin" value="${esc(c.social.linkedin)}"></div>
        <div class="field"><label>Twitter / X URL</label><input type="text" id="socialTwitter" value="${esc(c.social.twitter)}"></div>
        <div class="field"><label>YouTube URL</label><input type="text" id="socialYoutube" value="${esc(c.social.youtube)}"></div>
        <div class="field"><label>Instagram URL</label><input type="text" id="socialInstagram" value="${esc(c.social.instagram)}"></div>
        <button class="btn-admin primary" id="saveContactBtn" style="width:auto;">Save</button>
      </div>`;

    $("#saveContactBtn", root).addEventListener("click", async () => {
      try {
        await api("/api/contact", "PUT", {
          email: $("#contactEmail").value,
          social: {
            linkedin: $("#socialLinkedin").value,
            twitter: $("#socialTwitter").value,
            youtube: $("#socialYoutube").value,
            instagram: $("#socialInstagram").value
          }
        });
        await refreshContent();
        toast("Contact info saved — live site updated.");
      } catch (err) { toast(err.message, true); }
    });
  }

  // ---------------------------------------------------------
  // Theme picker
  // ---------------------------------------------------------
  function renderTheme(root) {
    const themes = state.themes;
    const active = state.content.theme;
    root.innerHTML = `
      <div class="admin-card">
        <h3>Color Theme</h3>
        <p class="card-desc">Pick a theme and it applies instantly across every page of the live site.</p>
        <div class="theme-grid" id="themeGrid">
          ${Object.entries(themes).map(([key, t]) => `
            <div class="theme-option ${key === active ? "active" : ""}" data-theme="${key}">
              <div class="swatch-row">
                ${t.swatch.map((c) => `<span class="swatch" style="background:${c};"></span>`).join("")}
              </div>
              <div class="theme-name">${t.label}</div>
              <div class="theme-check">${key === active ? "✓ Currently live" : ""}</div>
            </div>`).join("")}
        </div>
      </div>`;

    $$(".theme-option", root).forEach((opt) => {
      opt.addEventListener("click", async () => {
        try {
          await api("/api/theme", "PUT", { theme: opt.dataset.theme });
          await refreshContent();
          renderTheme(root);
          toast(`Theme changed to ${themes[opt.dataset.theme].label} — live on every page.`);
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  // ---------------------------------------------------------
  // Account / password
  // ---------------------------------------------------------
  function renderAccount(root) {
    root.innerHTML = `
      <div class="admin-card">
        <h3>Change Login</h3>
        <p class="card-desc">Change this before the site goes live — the default admin/Admin@123 login should never be used in production.</p>
        <div id="accountMsg"></div>
        <form id="accountForm">
          <div class="field"><label>Current password</label><input type="password" id="currentPassword" required></div>
          <div class="field"><label>New username (leave blank to keep current)</label><input type="text" id="newUsername"></div>
          <div class="field"><label>New password (leave blank to keep current, min 8 characters)</label><input type="password" id="newPassword"></div>
          <button type="submit" class="btn-admin primary" style="width:auto;">Update Login</button>
        </form>
      </div>`;

    $("#accountForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#accountMsg", root);
      msg.innerHTML = "";
      try {
        await api("/api/change-password", "POST", {
          currentPassword: $("#currentPassword").value,
          newUsername: $("#newUsername").value,
          newPassword: $("#newPassword").value
        });
        msg.innerHTML = `<div class="success-msg">Login updated. Use your new credentials next time you log in.</div>`;
        $("#accountForm", root).reset();
        toast("Login updated.");
      } catch (err) {
        msg.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    });
  }

  // ---------------------------------------------------------
  // Boot
  // ---------------------------------------------------------
  checkSession();
})();

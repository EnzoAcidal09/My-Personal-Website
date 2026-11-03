import { PORTFOLIO } from "./content.js";
import { avatarDataURL } from "./textures.js";

const ZONE_INFO = {
  about: { name: "THE COTTAGE", note: "About me" },
  projects: { name: "THE ARCADE", note: "Projects" },
  skills: { name: "THE CRYSTALS", note: "Skills" },
  contact: { name: "THE CAMPSITE", note: "Contact" },
};

const LEVEL_NAMES = ["CURIOUS", "LEARNING", "BUILDING", "CONFIDENT", "SHIPPING"];

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class PortfolioUI {
  constructor({ audio }) {
    this.audio = audio;
    this.content = PORTFOLIO;
    this.onStart = null;
    this.onAction = null;
    this.onOpenZone = null;

    this.dialogRoot = document.getElementById("dialog-root");
    this.prompt = document.getElementById("prompt");
    this.promptLabel = document.getElementById("prompt-label");
    this.promptBtn = document.getElementById("prompt-btn");
    this.title = document.getElementById("title");
    this.startBtn = document.getElementById("btn-start");
    this.soundBtn = document.getElementById("btn-sound");
    this.helpBtn = document.getElementById("btn-help");
    this.journalBtn = document.getElementById("journal");
    this.journalCount = document.getElementById("journal-count");
    this.journalPips = [...document.querySelectorAll("#journal-pips i")];
    this.toasts = document.getElementById("toasts");
    this.complete = document.getElementById("complete");
    this.confettiRoot = document.getElementById("confetti");
    this.sceneCanvas = document.getElementById("scene");

    this.isOpen = false;
    this.kind = null;
    this.activeProject = 0;
    this.currentPrompt = null;
    this.typing = false;
    this.typeTimer = null;
    this.typeNodes = [];
    this.typeIndex = 0;
    this.visited = new Set();
    this.secretFound = false;
    this.started = false;
    this.startLocked = false;

    this.avatar = avatarDataURL(96);

    this.bindGlobalEvents();
    this.setSound(audio.muted);
  }

  bindGlobalEvents() {
    this.startBtn.addEventListener("click", () => this.start());
    this.soundBtn.addEventListener("click", () => {
      const muted = this.audio.toggle();
      this.setSound(muted);
      if (!muted) this.audio.sfx("toggle");
    });
    this.helpBtn.addEventListener("click", () => {
      if (!this.isOpen) this.openHelp();
    });
    this.journalBtn.addEventListener("click", () => {
      if (!this.isOpen) this.openJournal();
    });

    this.promptBtn.addEventListener("click", () => {
      if (this.currentPrompt && this.onAction) this.onAction(this.currentPrompt);
    });

    window.addEventListener("keydown", (event) => {
      if (!this.started) {
        if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          this.start();
        }
        return;
      }
      if (!this.isOpen) return;
      if (this.handleKey(event)) {
        event.preventDefault();
      }
    });

    this.dialogRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (target === this.dialogRoot) {
        this.close();
        return;
      }
      if (target.closest(".js-close")) {
        this.close();
        return;
      }
      const tab = target.closest(".project-tab");
      if (tab) {
        this.setProject(Number(tab.dataset.index));
        return;
      }
      if (target.closest(".js-copy")) {
        this.copyEmail();
        return;
      }
      if (target.closest(".js-link")) {
        this.audio.sfx("select");
        return;
      }
      if (target.closest(".js-keep-exploring")) {
        this.close();
      }
    });
  }

  start() {
    if (this.startLocked || this.started) return;
    this.startLocked = true;
    this.started = true;
    this.audio.ensure();
    this.audio.sfx("start");
    this.audio.startMusic();
    this.title.classList.add("is-hidden");
    document.body.classList.remove("is-title");
    document.body.classList.add("is-playing");
    if (this.onStart) this.onStart();
  }

  setSound(muted) {
    this.soundBtn.textContent = muted ? "SND OFF" : "SND ON";
    this.soundBtn.classList.toggle("is-off", muted);
    this.soundBtn.setAttribute("aria-pressed", String(!muted));
    this.soundBtn.setAttribute(
      "aria-label",
      muted ? "SND OFF — sound is muted, press to turn sound on" : "SND ON — sound is on, press to mute",
    );
  }

  setPrompt(item) {
    this.currentPrompt = item || null;
    if (!item || this.isOpen || !this.started) {
      this.prompt.hidden = true;
      return;
    }
    this.promptLabel.textContent = item.prompt;
    this.prompt.hidden = false;
  }

  updateJournal(visited, secretFound) {
    this.visited = new Set(visited);
    this.secretFound = secretFound;
    const count = this.visited.size;
    this.journalCount.textContent = `${count}/4`;
    this.journalPips.forEach((pip, index) => {
      pip.classList.toggle("on", index < count);
    });
    this.journalBtn.setAttribute(
      "aria-label",
      `ISLE JOURNAL ${count}/4 — open the journal${secretFound ? ", secret found" : ""}`,
    );
    if (secretFound) this.journalBtn.classList.add("has-secret");
    else this.journalBtn.classList.remove("has-secret");
  }

  toast(message, { icon = "+", variant = "" } = {}) {
    const el = document.createElement("div");
    el.className = `toast${variant ? ` toast--${variant}` : ""}`;
    el.innerHTML = `<span class="toast__icon">${esc(icon)}</span><span>${esc(message)}</span>`;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild.remove();
    window.setTimeout(() => {
      el.classList.add("is-out");
      window.setTimeout(() => el.remove(), 280);
    }, 3000);
  }

  setKind(kind) {
    this.kind = kind;
    this.isOpen = Boolean(kind);
    document.body.classList.toggle("is-dialog", Boolean(kind));
    if (kind) {
      this.prompt.hidden = true;
    }
  }

  openWindow({ title, body, footLeft = "", footRight = "ESC CLOSE", kind, typed = false }) {
    this.cancelTyping();
    this.dialogRoot.innerHTML = `
      <div class="window" tabindex="-1" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="window__bar">
          <span class="window__title">${esc(title)}</span>
          <button class="window__close js-close" type="button" aria-label="Close">X</button>
        </div>
        <div class="window__body">${body}</div>
        <div class="window__foot"><span>${esc(footLeft)}</span><span>${esc(footRight)}</span></div>
      </div>
    `;
    this.dialogRoot.hidden = false;
    this.setKind(kind);
    this.audio.sfx("open");

    if (typed) {
      const nodes = [...this.dialogRoot.querySelectorAll(".typed")];
      nodes.forEach((node) => {
        node.dataset.full = node.textContent.trim();
        node.textContent = "";
      });
      this.startTyping(nodes);
    }

    const windowEl = this.dialogRoot.querySelector(".window");
    if (windowEl) windowEl.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.cancelTyping();
    this.dialogRoot.hidden = true;
    this.dialogRoot.innerHTML = "";
    this.setKind(null);
    this.audio.sfx("close");
    if (this.sceneCanvas) this.sceneCanvas.focus?.({ preventScroll: true });
    if (this.currentPrompt) this.prompt.hidden = false;
  }

  handleKey(event) {
    if (!this.isOpen) return false;
    if (event.code === "Escape") {
      this.close();
      return true;
    }
    if (this.kind === "projects") {
      if (event.code === "ArrowRight") {
        this.setProject((this.activeProject + 1) % this.content.projects.length);
        return true;
      }
      if (event.code === "ArrowLeft") {
        this.setProject(
          (this.activeProject - 1 + this.content.projects.length) % this.content.projects.length,
        );
        return true;
      }
      if (event.code === "Enter") {
        this.openCurrentProject();
        return true;
      }
    }
    if (event.code === "KeyE" || event.code === "Space" || event.code === "Enter") {
      if (this.typing) {
        this.finishTyping();
        return true;
      }
      if (event.code === "Enter" && this.kind === "projects") return true;
      if (this.kind !== "secret") {
        this.close();
        return true;
      }
      this.close();
      return true;
    }
    return false;
  }

  openZone(id) {
    this.setPrompt(null);
    if (id === "about") this.openAbout();
    else if (id === "projects") this.openProjects();
    else if (id === "skills") this.openSkills();
    else if (id === "contact") this.openContact();
  }

  openAbout() {
    const { about, name, role, location, school } = this.content;
    const paragraphs = about.paragraphs
      .map((text, index) => `<p class="body-copy typed" data-delay="${index}">${esc(text)}</p>`)
      .join("");
    this.openWindow({
      title: about.heading,
      kind: "about",
      typed: true,
      body: `
        <div class="about-head">
          <img class="avatar" src="${this.avatar}" alt="Pixel portrait of ${esc(name)}" width="96" height="96" />
          <div>
            <h2 class="about-head__name">${esc(name)}</h2>
            <p class="about-head__meta">${esc(role)}<br /><span class="about-head__loc">${esc(location)}</span><span class="about-head__sep"> · </span><span class="about-head__school">${esc(school)}</span></p>
          </div>
        </div>
        ${paragraphs}
        <div class="about-status"><span>STATUS</span> — ${esc(about.status)}</div>
      `,
      footLeft: "THE COTTAGE · ABOUT ME",
    });
  }

  projectMarkup() {
    const project = this.content.projects[this.activeProject];
    const tabs = this.content.projects
      .map(
        (item, index) => `
          <button class="project-tab${index === this.activeProject ? " is-active" : ""}" type="button" data-index="${index}" aria-label="Show ${esc(item.title)}">
            ${String(index + 1).padStart(2, "0")}
          </button>`,
      )
      .join("");
    const tags = project.tech.map((tag) => `<li>${esc(tag)}</li>`).join("");
    const soon = project.status === "SOON";
    return `
      <div class="projects__tabs" role="tablist" aria-label="Projects">${tabs}</div>
      <div class="project">
        <p class="project__kicker">
          <span>PROJECT ${String(this.activeProject + 1).padStart(2, "0")}</span>
          <span class="project__status${soon ? " project__status--soon" : ""}">${esc(project.status)}</span>
        </p>
        <h3 class="project__title">${esc(project.title)}</h3>
        <p class="project__desc">${esc(project.blurb)}</p>
        <ul class="tags">${tags}</ul>
        <div class="project__actions">
          <a class="btn js-link" href="${esc(project.link)}" target="_blank" rel="noopener noreferrer">OPEN PROJECT</a>
          <a class="btn btn--ghost js-link" href="${esc(this.content.github)}?tab=repositories" target="_blank" rel="noopener noreferrer">ALL REPOS</a>
        </div>
      </div>
    `;
  }

  openProjects() {
    this.activeProject = 0;
    this.openWindow({
      title: "THE ARCADE",
      kind: "projects",
      body: this.projectMarkup(),
      footLeft: "ARROWS BROWSE · ENTER OPEN",
      footRight: "ESC CLOSE",
    });
  }

  setProject(index) {
    if (index === this.activeProject) return;
    this.activeProject = index;
    this.audio.sfx("move");
    const body = this.dialogRoot.querySelector(".window__body");
    if (body) body.innerHTML = this.projectMarkup();
  }

  openCurrentProject() {
    const project = this.content.projects[this.activeProject];
    if (!project) return;
    this.audio.sfx("select");
    window.open(project.link, "_blank", "noopener,noreferrer");
  }

  openSkills() {
    const rows = this.content.skills
      .map((skill) => {
        const level = Math.max(1, Math.min(5, skill.level));
        const bars = Array.from({ length: 5 }, (_, index) => `<i class="${index < level ? "on" : ""}"></i>`).join("");
        return `
          <div class="skill">
            <div class="skill__top">
              <span class="skill__name">${esc(skill.name)}</span>
              <span class="skill__level">${esc(LEVEL_NAMES[level - 1])} · ${level}/5</span>
            </div>
            <div class="skill__bars" aria-hidden="true">${bars}</div>
            <p class="skill__note">${esc(skill.note)}</p>
          </div>
        `;
      })
      .join("");
    this.openWindow({
      title: "THE CRYSTALS",
      kind: "skills",
      body: `
        <p class="help-copy">Each crystal is something I'm learning or building with. The bars are vibes, not certificates.</p>
        <div class="skill-list">${rows}</div>
        <p class="skill-foot">TIP: levels live in <strong>src/content.js</strong> — edit them any time.</p>
      `,
      footLeft: "THE CRYSTALS · SKILLS",
    });
  }

  openContact() {
    const { contact } = this.content;
    this.openWindow({
      title: "THE CAMPSITE",
      kind: "contact",
      typed: true,
      body: `
        <p class="body-copy typed">${esc(contact.intro)}</p>
        <div class="contact-email">
          <span class="contact-email__label">EMAIL</span>
          <span class="contact-email__value">${esc(this.content.email)}</span>
          <button class="btn btn--small js-copy" type="button">COPY EMAIL</button>
        </div>
        <div class="contact-links">
          <a class="btn js-link" href="mailto:${esc(this.content.email)}">SEND AN EMAIL</a>
          <a class="btn btn--ghost js-link" href="${esc(this.content.github)}" target="_blank" rel="noopener noreferrer">GITHUB</a>
        </div>
        <dl class="contact-grid">
          <div class="contact-cell">
            <dt>BASED IN</dt>
            <dd>${esc(this.content.location)}</dd>
          </div>
          <div class="contact-cell">
            <dt>STUDYING AT</dt>
            <dd>${esc(this.content.school)}</dd>
          </div>
        </dl>
        <p class="body-copy">${esc(contact.note)}</p>
      `,
      footLeft: "THE CAMPSITE · CONTACT",
    });
  }

  openJournal() {
    const entries = Object.entries(ZONE_INFO)
      .map(([id, info]) => {
        const found = this.visited.has(id);
        return `
          <li class="entry${found ? " is-found" : ""}">
            <span class="entry__icon">${found ? "★" : "·"}</span>
            <span class="entry__name">${esc(info.name)}</span>
            <span class="entry__note">${found ? esc(info.note) : "Not visited yet"}</span>
          </li>
        `;
      })
      .join("");
    const secret = this.secretFound
      ? "You found Quackers. The duck is still bragging about it."
      : "Something golden is hiding near the water.";
    this.openWindow({
      title: "ISLE JOURNAL",
      kind: "journal",
      body: `
        <p class="help-copy">Four landmarks, one small island. Visit each one to fill the journal — the last entry is optional and a little bit silly.</p>
        <ul class="entry-list">${entries}</ul>
        <p class="help-section">SECRET ENTRY</p>
        <ul class="entry-list">
          <li class="entry${this.secretFound ? " is-found" : ""}">
            <span class="entry__icon">${this.secretFound ? "★" : "?"}</span>
            <span class="entry__name">${this.secretFound ? "QUACKERS" : "???"}</span>
            <span class="entry__note">${esc(secret)}</span>
          </li>
        </ul>
        <p class="help-copy">Progress resets when you reload the page.</p>
      `,
      footLeft: `${this.visited.size}/4 LANDMARKS`,
    });
  }

  openHelp() {
    this.openWindow({
      title: "ISLE GUIDE",
      kind: "help",
      body: `
        <p class="help-section">CONTROLS</p>
        <dl class="help-grid">
          <dt><span class="keycap">WASD</span><span class="keycap">↑←↓→</span></dt><dd>Walk around the island</dd>
          <dt><span class="keycap">SHIFT</span></dt><dd>Run (and kick up dust)</dd>
          <dt><span class="keycap">E</span><span class="keycap">SPACE</span></dt><dd>Interact / skip text</dd>
          <dt><span class="keycap">H</span></dt><dd>Open this guide</dd>
          <dt><span class="keycap">M</span></dt><dd>Toggle sound</dd>
          <dt><span class="keycap">ESC</span></dt><dd>Close a window</dd>
        </dl>
        <p class="help-section">THE QUEST</p>
        <p class="help-copy">Visit the four landmarks to fill the Isle Journal: the cottage, the arcade, the crystals, and the campsite. There is also a small golden secret near the pond. The signpost brought you here, so you're already doing great.</p>
        <p class="help-copy"><strong>On a phone?</strong> Use the joystick, then tap the E button when a prompt appears.</p>
        <p class="help-section">CREDITS</p>
        <p class="help-credits">${this.content.credits.map(esc).join("<br />")}</p>
      `,
      footLeft: "ISLE GUIDE",
    });
  }

  openSecret() {
    this.openWindow({
      title: "SECRET FOUND",
      kind: "secret",
      typed: true,
      body: `
        <p class="project__kicker"><span>★ SECRET ENTRY</span></p>
        <h3 class="project__title">${esc(this.content.secret.title)}</h3>
        <p class="body-copy typed">${esc(this.content.secret.text)}</p>
        <div class="project__actions">
          <button class="btn js-keep-exploring" type="button">KEEP EXPLORING</button>
        </div>
      `,
      footLeft: "★ JOURNAL UPDATED",
    });
  }

  startTyping(nodes) {
    this.typeNodes = nodes;
    this.typeIndex = 0;
    if (!nodes.length) {
      this.typing = false;
      return;
    }
    this.typing = true;
    if (reduceMotion()) {
      this.finishTyping();
      return;
    }
    nodes.forEach((node) => node.classList.add("typed"));
    this.typeNext();
  }

  typeNext() {
    if (!this.isOpen) return;
    if (this.typeIndex >= this.typeNodes.length) {
      this.typing = false;
      return;
    }
    const node = this.typeNodes[this.typeIndex];
    const full = node.dataset.full || "";
    let index = 0;
    node.classList.remove("is-done");
    const tick = () => {
      if (!this.isOpen) return;
      index += 1;
      node.textContent = full.slice(0, index);
      if (index >= full.length) {
        node.classList.add("is-done");
        this.typeIndex += 1;
        this.typeTimer = window.setTimeout(() => this.typeNext(), 110);
        return;
      }
      this.typeTimer = window.setTimeout(tick, 15);
    };
    tick();
  }

  finishTyping() {
    this.cancelTyping();
    this.typeNodes.forEach((node) => {
      node.textContent = node.dataset.full || "";
      node.classList.add("is-done");
    });
    this.typeIndex = this.typeNodes.length;
    this.typing = false;
  }

  cancelTyping() {
    if (this.typeTimer) {
      window.clearTimeout(this.typeTimer);
      this.typeTimer = null;
    }
    this.typing = false;
  }

  async copyEmail() {
    const email = this.content.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = email;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch (inner) {
        this.toast("Could not copy — select the email manually.", { icon: "!" });
        area.remove();
        return;
      }
      area.remove();
    }
    this.audio.sfx("select");
    this.toast("EMAIL COPIED TO CLIPBOARD", { icon: "*" });
  }

  celebrate({ complete = false, sound = true } = {}) {
    if (!reduceMotion()) {
      const colors = ["#ffcd75", "#41a6f6", "#73eff7", "#38b764", "#ef7d57", "#f4f4f4", "#a7f070"];
      const count = complete ? 70 : 36;
      for (let i = 0; i < count; i += 1) {
        const bit = document.createElement("span");
        bit.className = "confetti__bit";
        bit.style.left = `${Math.random() * 100}%`;
        bit.style.background = colors[Math.floor(Math.random() * colors.length)];
        bit.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
        bit.style.animationDelay = `${Math.random() * 0.5}s`;
        bit.style.setProperty("--drift", `${(Math.random() - 0.5) * 260}px`);
        bit.style.width = `${5 + Math.random() * 6}px`;
        bit.style.height = `${8 + Math.random() * 8}px`;
        this.confettiRoot.appendChild(bit);
        window.setTimeout(() => bit.remove(), 4200);
      }
    }
    if (sound) this.audio.sfx("fanfare");
    if (complete) {
      this.complete.hidden = false;
      window.setTimeout(() => {
        this.complete.hidden = true;
      }, 3600);
    }
  }
}

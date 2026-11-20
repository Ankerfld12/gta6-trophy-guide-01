"use strict";
/* Leonida Ledger — guide & tracker for the 55 official GTA VI trophies.
   Plain browser script, no modules, no network beyond the two data files
   that ship with the app. Progress lives in localStorage only. */

const EARNED_KEY = "leonida-ledger:earned:v1";
const SPOILER_KEY = "leonida-ledger:spoilers:v1";
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const GRADE_TOTALS = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
const KIND_LABELS = {
  story: "Story", collectible: "Collectible", combat: "Combat",
  vehicle: "Vehicle", exploration: "Exploration", social: "Social", misc: "Misc",
};

const PHASES = [
  { n: 1, title: "Phase 1 — Play the story", hours: "≈ 35–50 hours (rough estimate)",
    text: "Chapters 1 to 4, the named story missions and the final mission, in the order the game offers them. Two flagged trophies ride along here: make the unscheduled VCIA departure during VCIA Takedown, and treat every choice as one that counts toward the 500." },
  { n: 2, title: "Phase 2 — Strands & partners", hours: "≈ 8–12 hours (rough estimate)",
    text: "The stranger strands and their finales (Andy, Kenton, Billy, Randy, Tyrone), then the partner trophies: the 4-star escape, the three-shop chain, and the partnership moment." },
  { n: 3, title: "Phase 3 — The Leonida-wide sets", hours: "≈ 15–25 hours (rough estimate)",
    text: "The map-wide counters: 250 stunts, 100 WAiNK locations, 18 meditation spots, 3 card sets, 100 discovered vehicles and all 52 areas. Sweep region by region and let exploration trophies (the unique hunt, the Ocean Beach cocktail, the strange sighting) happen on the way." },
  { n: 4, title: "Phase 4 — Skill & score targets", hours: "≈ 10–18 hours (rough estimate)",
    text: "42 Shooting Range golds, 20 race wins, 14 drone-race wins, 50 challenges, and the one-attempt feats: 5 takedowns in one Combat Focus, the showroom breakout, the melee drive-by, and a successful second try." },
  { n: 5, title: "Phase 5 — Money & property", hours: "≈ 8–14 hours (rough estimate)",
    text: "The robbery set (5 bank vaults, an armored truck, one illegal operation per gang, the undetected jewelry store), then the counters they feed: $250,000 laundered, $100,000 spent, all 8 garages bought, 10 vehicles registered." },
  { n: 6, title: "Phase 6 — 100% and the platinum", hours: "≈ 5–10 hours of mop-up (rough estimate)",
    text: "Whatever the completion counter still wants, then Attain 100% Completion — and Vice Got a Price! follows on its own once the other 54 are in." },
];

const state = {
  trophies: [],
  guideById: new Map(),
  earned: new Set(),
  spoilers: false,
  expanded: new Set(),
  view: "guide",
  filters: { grade: "all", kind: "all", status: "all", query: "", sort: "list" },
};

function $(id) { return document.getElementById(id); }

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function loadStoredEarned() {
  try {
    const raw = localStorage.getItem(EARNED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch { return new Set(); }
}

function storeEarned() {
  try { localStorage.setItem(EARNED_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b))); } catch { /* storage unavailable */ }
}

function loadSpoilerPref() {
  try { return localStorage.getItem(SPOILER_KEY) === "on"; } catch { return false; }
}

function storeSpoilerPref() {
  try { localStorage.setItem(SPOILER_KEY, state.spoilers ? "on" : "off"); } catch { /* storage unavailable */ }
}

function isSpoiled(t) {
  return state.spoilers && t.kind === "story" && !state.earned.has(t.id);
}

function renderProgress() {
  const total = state.trophies.length || 55;
  const n = state.earned.size;
  $("earnedCount").textContent = String(n);
  const pct = total ? Math.round((n / total) * 100) : 0;
  $("progressFill").style.width = pct + "%";
  $("progressBarWrap").setAttribute("aria-valuenow", String(n));
  $("progressPct").textContent = pct + "% of the list";
  for (const grade of Object.keys(GRADE_TOTALS)) {
    const got = state.trophies.filter((t) => t.grade === grade && state.earned.has(t.id)).length;
    $("gp-" + grade).textContent = got + "/" + GRADE_TOTALS[grade];
  }
  const plat = $("platinumState");
  if (n >= total && total > 0) plat.textContent = "Platinum earned — Leonida Legend. Congratulations!";
  else plat.textContent = "Platinum locked — " + (total - n) + (total - n === 1 ? " trophy" : " trophies") + " to go";
}

function visibleTrophies() {
  const f = state.filters;
  const q = f.query.trim().toLowerCase();
  const out = state.trophies.filter((t) => {
    if (f.grade !== "all" && t.grade !== f.grade) return false;
    if (f.kind !== "all" && t.kind !== f.kind) return false;
    if (f.status === "earned" && !state.earned.has(t.id)) return false;
    if (f.status === "remaining" && state.earned.has(t.id)) return false;
    if (f.status === "missable" && !t.missable) return false;
    if (q) {
      const g = state.guideById.get(t.id);
      const hay = (t.name + " " + t.description + " " + (g ? g.tip : "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (f.sort === "grade") out.sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id);
  else if (f.sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort((a, b) => a.id - b.id);
  return out;
}

function buildGuidePanel(t) {
  const g = state.guideById.get(t.id);
  const panel = makeEl("div", "guide-panel");
  panel.id = "guide-" + t.id;
  if (!g) { panel.append(makeEl("p", null, "No guide entry.")); return panel; }

  panel.append(makeEl("h4", null, "Guide — in our words"));
  panel.append(makeEl("p", null, g.tip));

  panel.append(makeEl("h4", null, g.missable ? "Why this is flagged missable" : "Why this is not flagged missable"));
  const reason = makeEl("p", g.missable ? "missable-reason" : "safe-reason", g.missableReason);
  panel.append(reason);

  panel.append(makeEl("h4", null, "Roadmap"));
  panel.append(makeEl("p", null, "Stage " + g.stage + " of 6 — see the roadmap view for the phase this belongs to."));

  panel.append(makeEl("h4", null, "Sources"));
  const ul = makeEl("ul", "sources-list");
  for (const s of g.sources) ul.append(makeEl("li", null, s));
  panel.append(ul);
  return panel;
}

function buildCard(t) {
  const earned = state.earned.has(t.id);
  const card = makeEl("article", "card grade-" + t.grade + (earned ? " is-earned" : "") + (isSpoiled(t) ? " is-spoiled" : ""));
  card.id = "trophy-" + t.id;

  const head = makeEl("div", "card-head");
  const boxWrap = makeEl("label", "earn-box");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = earned;
  box.setAttribute("aria-label", "Mark “" + t.name + "” as earned");
  box.addEventListener("change", () => toggleEarned(t.id, box.checked));
  boxWrap.append(box);
  head.append(boxWrap);

  const main = makeEl("div", "card-main");
  const titleRow = makeEl("div", "card-title");
  titleRow.append(makeEl("span", "card-num", "#" + t.id));
  const h3 = makeEl("h3", "spoiler-target", t.name);
  titleRow.append(h3);
  titleRow.append(makeEl("span", "badge badge-grade-" + t.grade, t.grade));
  titleRow.append(makeEl("span", "badge badge-kind", KIND_LABELS[t.kind] || t.kind));
  if (t.missable) titleRow.append(makeEl("span", "badge badge-missable", "Missable — flagged"));
  titleRow.append(makeEl("span", "badge badge-stage", "Stage " + t.stage));
  main.append(titleRow);

  main.append(makeEl("p", "card-desc spoiler-target", t.description));
  if (isSpoiled(t)) {
    main.append(makeEl("p", "spoiler-note", "Hidden by spoiler mode — earn it or switch spoiler mode off to read it."));
  }

  const toggle = makeEl("button", "guide-toggle", state.expanded.has(t.id) ? "Hide guide & sources" : "Guide & sources");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", state.expanded.has(t.id) ? "true" : "false");
  toggle.addEventListener("click", () => {
    if (state.expanded.has(t.id)) state.expanded.delete(t.id); else state.expanded.add(t.id);
    refreshCard(t.id);
  });
  main.append(toggle);
  if (state.expanded.has(t.id)) main.append(buildGuidePanel(t));

  head.append(main);
  card.append(head);
  return card;
}

function refreshCard(id) {
  const t = state.trophies.find((x) => x.id === id);
  const old = $("trophy-" + id);
  if (t && old) old.replaceWith(buildCard(t));
}

function toggleEarned(id, on) {
  if (on) state.earned.add(id); else state.earned.delete(id);
  storeEarned();
  renderProgress();
  refreshCard(id);
  renderRoadmap();
}

function renderList() {
  const list = $("trophyList");
  list.textContent = "";
  const visible = visibleTrophies();
  for (const t of visible) list.append(buildCard(t));
  $("emptyNote").hidden = visible.length !== 0;
  const earnedVisible = visible.filter((t) => state.earned.has(t.id)).length;
  $("resultCount").textContent =
    "Showing " + visible.length + " of " + state.trophies.length + " trophies · " +
    earnedVisible + " of them earned · progress saves automatically in this browser.";
}

function renderRoadmap() {
  const wrap = $("roadmapPhases");
  if (!wrap) return;
  wrap.textContent = "";
  for (const phase of PHASES) {
    const members = state.trophies.filter((t) => t.stage === phase.n);
    const doneCount = members.filter((t) => state.earned.has(t.id)).length;
    const box = makeEl("section", "phase");
    const head = makeEl("div", "phase-head");
    head.append(makeEl("h3", null, phase.title));
    head.append(makeEl("span", "phase-hours", phase.hours));
    head.append(makeEl("span", "phase-progress", doneCount + " / " + members.length + " earned"));
    box.append(head);
    box.append(makeEl("p", null, phase.text));
    const ul = makeEl("ul", "phase-list");
    for (const t of members) {
      const li = document.createElement("li");
      const done = state.earned.has(t.id);
      li.append(makeEl("span", done ? "done" : "todo", done ? "✓" : "○"));
      const a = makeEl("a", null, "#" + t.id + " " + t.name);
      a.href = "#trophy-" + t.id;
      li.append(a);
      li.append(makeEl("span", "badge badge-grade-" + t.grade, t.grade));
      if (t.missable) li.append(makeEl("span", "badge badge-missable", "Missable — flagged"));
      ul.append(li);
    }
    box.append(ul);
    wrap.append(box);
  }
  const ml = $("missableList");
  ml.textContent = "";
  for (const t of state.trophies.filter((x) => x.missable)) {
    const g = state.guideById.get(t.id);
    const li = document.createElement("li");
    const a = makeEl("a", null, "#" + t.id + " " + t.name);
    a.href = "#trophy-" + t.id;
    li.append(a);
    li.append(document.createTextNode(" — " + (g ? g.missableReason : "")));
    ml.append(li);
  }
}

function setView(view) {
  state.view = view;
  $("view-guide").hidden = view !== "guide";
  $("view-roadmap").hidden = view !== "roadmap";
  $("navGuide").classList.toggle("is-active", view === "guide");
  $("navRoadmap").classList.toggle("is-active", view === "roadmap");
}

function setStatusFilter(status) {
  state.filters.status = status;
  for (const chip of $("statusChips").querySelectorAll(".chip")) {
    chip.classList.toggle("is-active", chip.dataset.status === status);
  }
}

function applyHash() {
  const hash = location.hash || "";
  if (hash === "#roadmap") { setView("roadmap"); return; }
  setView("guide");
  if (hash === "#filter-missable") {
    setStatusFilter("missable");
    renderList();
    return;
  }
  if (hash === "#spoilers") {
    if (!state.spoilers) {
      state.spoilers = true;
      storeSpoilerPref();
      $("spoilerToggle").checked = true;
      renderList();
    }
    return;
  }
  const m = /^#trophy-(\d+)$/.exec(hash);
  if (m) {
    const id = Number(m[1]);
    if (state.guideById.has(id)) {
      state.expanded.add(id);
      renderList();
      const card = $("trophy-" + id);
      if (card) {
        card.scrollIntoView({ block: "start" });
        const btn = card.querySelector(".guide-toggle");
        if (btn) btn.focus({ preventScroll: true });
      }
    }
  }
}

function wireControls() {
  const chipGroup = (containerId, key) => {
    $(containerId).addEventListener("click", (ev) => {
      const btn = ev.target.closest(".chip");
      if (!btn) return;
      for (const chip of $(containerId).querySelectorAll(".chip")) chip.classList.remove("is-active");
      btn.classList.add("is-active");
      state.filters[key] = btn.dataset.grade || btn.dataset.kind || btn.dataset.status;
      renderList();
    });
  };
  chipGroup("gradeChips", "grade");
  chipGroup("kindChips", "kind");
  chipGroup("statusChips", "status");

  $("searchInput").addEventListener("input", (ev) => {
    state.filters.query = ev.target.value;
    renderList();
  });
  $("sortSelect").addEventListener("change", (ev) => {
    state.filters.sort = ev.target.value;
    renderList();
  });
  $("spoilerToggle").addEventListener("change", (ev) => {
    state.spoilers = ev.target.checked;
    storeSpoilerPref();
    renderList();
  });

  $("markVisibleBtn").addEventListener("click", () => {
    for (const t of visibleTrophies()) state.earned.add(t.id);
    storeEarned(); renderProgress(); renderList(); renderRoadmap();
  });
  $("clearVisibleBtn").addEventListener("click", () => {
    for (const t of visibleTrophies()) state.earned.delete(t.id);
    storeEarned(); renderProgress(); renderList(); renderRoadmap();
  });

  $("exportBtn").addEventListener("click", () => {
    const payload = JSON.stringify({
      app: "leonida-ledger", version: 1,
      earned: [...state.earned].sort((a, b) => a - b),
    }, null, 1);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leonida-ledger-progress.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        const ids = Array.isArray(parsed) ? parsed : parsed.earned;
        if (!Array.isArray(ids)) throw new Error("no earned list");
        const valid = ids.filter((n) => Number.isInteger(n) && state.guideById.has(n));
        state.earned = new Set(valid);
        storeEarned(); renderProgress(); renderList(); renderRoadmap();
        $("resultCount").textContent = "Imported progress: " + valid.length + " trophies marked earned.";
      } catch {
        $("resultCount").textContent = "That file could not be read as Leonida Ledger progress; nothing was changed.";
      }
      ev.target.value = "";
    });
  });

  $("resetBtn").addEventListener("click", () => {
    if (!window.confirm("Reset all earned trophies? This clears the progress saved in this browser.")) return;
    state.earned = new Set();
    storeEarned(); renderProgress(); renderList(); renderRoadmap();
  });

  $("navGuide").addEventListener("click", () => { location.hash = "#guide"; });
  $("navRoadmap").addEventListener("click", () => { location.hash = "#roadmap"; });
  window.addEventListener("hashchange", applyHash);
}

async function loadData() {
  const [listRes, guideRes] = await Promise.all([fetch("data/trophies.json"), fetch("data/guide.json")]);
  if (!listRes.ok || !guideRes.ok) throw new Error("data files missing");
  const listDoc = await listRes.json();
  const guideDoc = await guideRes.json();
  const official = Array.isArray(listDoc) ? listDoc : listDoc.trophies;
  const guides = Array.isArray(guideDoc) ? guideDoc : guideDoc.guides;
  state.guideById = new Map(guides.map((g) => [g.id, g]));
  state.trophies = official.map((t) => {
    const g = state.guideById.get(t.id) || {};
    return {
      id: t.id, name: t.name, description: t.description, grade: t.grade,
      kind: g.kind || "misc", stage: g.stage || 6, missable: Boolean(g.missable),
    };
  });
}

async function boot() {
  state.earned = loadStoredEarned();
  state.spoilers = loadSpoilerPref();
  $("spoilerToggle").checked = state.spoilers;
  wireControls();
  try {
    await loadData();
  } catch {
    $("trophyList").append(makeEl("p", "empty-note",
      "The trophy data could not be loaded. Serve this folder with any static file server (for example the kit's serve.ts) rather than opening the page as a file."));
    return;
  }
  renderProgress();
  renderList();
  renderRoadmap();
  applyHash();
}

boot();


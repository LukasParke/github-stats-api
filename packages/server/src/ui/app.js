const $ = (sel) => document.querySelector(sel);

const state = {
  compositions: null,
  filter: "all",
  polls: new Map(),
  jobsById: new Map(),
};

function storageKey(username) {
  return `github-stats:jobs:${(username || "").toLowerCase()}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function showInstallBanner({ installUrl, message }) {
  $("#installBanner").classList.remove("hidden");
  $("#installMessage").textContent =
    message || "GitHub App installation is required to render for this user.";
  const link = $("#installLink");
  link.href = installUrl || "#";
  link.classList.toggle("disabled", !installUrl);
}

function hideInstallBanner() {
  $("#installBanner").classList.add("hidden");
}

function getUsername() {
  return ($("#username").value || "").trim();
}

function normalizeJobs(jobs) {
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((j) => j && typeof j === "object" && typeof j.jobId === "string")
    .map((j) => ({
      jobId: String(j.jobId),
      username: String(j.username || ""),
      compositionId: String(j.compositionId || ""),
      createdAt: Number(j.createdAt || Date.now()),
      last: j.last || null,
    }));
}

function loadJobsFor(username) {
  const raw = localStorage.getItem(storageKey(username));
  const jobs = normalizeJobs(raw ? safeJsonParse(raw, []) : []);
  for (const job of jobs) {
    state.jobsById.set(job.jobId, job);
  }
  renderJobs();
  for (const job of jobs) startPolling(job.jobId);
}

function persistJobsFor(username) {
  const key = storageKey(username);
  const all = [];
  for (const j of state.jobsById.values()) {
    if ((j.username || "").toLowerCase() === (username || "").toLowerCase()) all.push(j);
  }
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  localStorage.setItem(key, JSON.stringify(all.slice(0, 50)));
}

async function apiGetJson(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function apiPostJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function groupIdForFilter(filter) {
  switch (filter) {
    case "readme":
      return "readme";
    case "commitStreak":
      return "commitStreak";
    case "topLanguages":
      return "topLanguages";
    case "contribution":
      return "contribution";
    case "commitGraph":
      return "commitGraph";
    default:
      return "all";
  }
}

function compositionVisible(id) {
  const f = state.filter;
  if (f === "all") return true;
  if (!state.compositions || !state.compositions.grouped) return true;
  const group = state.compositions.grouped[groupIdForFilter(f)] || [];
  return group.includes(id);
}

function renderCompositions() {
  const root = $("#compositions");
  root.innerHTML = "";

  const total = state.compositions?.total ?? 0;
  $("#compositionMeta").textContent = total ? `${total} available` : "No compositions";

  const list = state.compositions?.compositions || [];
  for (const id of list) {
    if (!compositionVisible(id)) continue;

    const el = document.createElement("div");
    el.className = "comp";
    el.innerHTML = `
      <div class="compTop">
        <div>
          <div class="compId">${escapeHtml(id)}</div>
          <div class="compMeta">${id.includes("light") ? "light" : "dark"}</div>
        </div>
      </div>
      <div class="compActions">
        <button class="btn small" data-action="render" data-comp="${escapeAttr(id)}" type="button">Render</button>
        <button class="btn secondary small" data-action="preview" data-comp="${escapeAttr(
          id
        )}" type="button">Preview latest</button>
      </div>
    `;
    root.appendChild(el);
  }

  root.querySelectorAll("button[data-action='render']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const comp = btn.getAttribute("data-comp");
      if (!comp) return;
      await queueRender(comp);
    });
  });

  root.querySelectorAll("button[data-action='preview']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const comp = btn.getAttribute("data-comp");
      if (!comp) return;
      const username = getUsername();
      if (!username) return;
      addOrUpdateJob({
        jobId: `render:${username}:${comp}`,
        username,
        compositionId: comp,
        createdAt: Date.now(),
        last: {
          state: "preview",
          progress: 100,
          imageUrl: `/api/image/${encodeURIComponent(username)}/${encodeURIComponent(comp)}`,
        },
      });
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#096;");
}

function setActiveFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("active", c.getAttribute("data-filter") === filter);
  });
  renderCompositions();
}

function renderJobs() {
  const root = $("#jobs");
  const username = getUsername();
  const jobs = Array.from(state.jobsById.values())
    .filter((j) => (j.username || "").toLowerCase() === (username || "").toLowerCase())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  $("#jobsMeta").textContent = jobs.length ? `${jobs.length} job(s)` : "No jobs yet";
  root.innerHTML = "";

  for (const job of jobs) {
    const last = job.last || {};
    const stateText = last.state || "unknown";
    const progress = clamp(Number(last.progress ?? 0), 0, 100);
    const imageUrl = last.imageUrl || job.imageUrl || (job.result && job.result.imageUrl);
    const err = last.error || job.error || (job.result && job.result.error);

    const el = document.createElement("div");
    el.className = "job";
    el.innerHTML = `
      <div class="jobHeader">
        <div class="jobTitle">${escapeHtml(job.compositionId || job.jobId)}</div>
        <div class="jobState">${escapeHtml(stateText)} · ${progress}%</div>
      </div>
      <div class="barWrap"><div class="bar" style="width:${progress}%"></div></div>
      <div class="jobFooter">
        <div class="mini">${escapeHtml(job.jobId)}</div>
        <div class="compActions">
          <button class="btn secondary small" data-action="copy" data-url="${escapeAttr(
            imageUrl || ""
          )}" type="button" ${imageUrl ? "" : "disabled"}>Copy image URL</button>
          <button class="btn secondary small" data-action="refresh" data-job="${escapeAttr(
            job.jobId
          )}" type="button">Refresh status</button>
        </div>
      </div>
      ${
        err
          ? `<div class="mini danger">${escapeHtml(err)}</div>`
          : imageUrl
          ? `<img class="preview" src="${escapeAttr(imageUrl)}" alt="preview" />`
          : ""
      }
    `;
    root.appendChild(el);
  }

  root.querySelectorAll("button[data-action='refresh']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.getAttribute("data-job");
      if (!jobId) return;
      await pollOnce(jobId);
    });
  });

  root.querySelectorAll("button[data-action='copy']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.getAttribute("data-url") || "";
      if (!url) return;
      const abs = new URL(url, window.location.origin).toString();
      await navigator.clipboard.writeText(abs);
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy image URL"), 900);
    });
  });
}

function addOrUpdateJob(job) {
  state.jobsById.set(job.jobId, job);
  persistJobsFor(job.username);
  renderJobs();
}

async function queueRender(compositionId) {
  hideInstallBanner();
  const username = getUsername();
  if (!username) return;

  const { res, json } = await apiPostJson("/api/render", {
    username,
    compositionId,
    priority: "normal",
  });

  if (res.status === 409 && json && json.installRequired) {
    showInstallBanner({ installUrl: json.installUrl, message: json.message });
    return;
  }

  if (!res.ok) {
    showInstallBanner({
      installUrl: json?.installUrl,
      message: json?.message || json?.error || `Failed to queue render (${res.status})`,
    });
    return;
  }

  const jobId = json?.jobId;
  addOrUpdateJob({
    jobId,
    username,
    compositionId,
    createdAt: Date.now(),
    last: { state: "queued", progress: 0 },
  });
  startPolling(jobId);
}

async function queueRenderAll() {
  hideInstallBanner();
  const username = getUsername();
  if (!username) return;

  const { res, json } = await apiPostJson("/api/render/bulk", {
    username,
    theme: "all",
    priority: "normal",
  });

  if (res.status === 409 && json && json.installRequired) {
    showInstallBanner({ installUrl: json.installUrl, message: json.message });
    return;
  }
  if (!res.ok) {
    showInstallBanner({
      installUrl: json?.installUrl,
      message: json?.message || json?.error || `Failed to queue renders (${res.status})`,
    });
    return;
  }

  const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
  for (const j of jobs) {
    addOrUpdateJob({
      jobId: j.id,
      username,
      compositionId: j.compositionId,
      createdAt: Date.now(),
      last: { state: "queued", progress: 0 },
    });
    startPolling(j.id);
  }
}

async function pollOnce(jobId) {
  const { res, json } = await apiGetJson(`/api/status/${encodeURIComponent(jobId)}`);
  if (!res.ok || !json) return;

  const existing = state.jobsById.get(jobId) || { jobId };
  const updated = {
    ...existing,
    last: {
      state: json.state,
      progress: json.progress,
      imageUrl: json.imageUrl || json.result?.imageUrl,
      error: json.error || json.result?.error,
    },
    result: json.result,
    error: json.error || json.result?.error,
    imageUrl: json.imageUrl || json.result?.imageUrl,
  };
  state.jobsById.set(jobId, updated);
  persistJobsFor(updated.username || getUsername());
  renderJobs();

  const done = json.state === "completed" || json.state === "failed";
  if (done) stopPolling(jobId);
}

function startPolling(jobId) {
  if (!jobId) return;
  if (state.polls.has(jobId)) return;

  const interval = window.setInterval(() => pollOnce(jobId), 1000);
  state.polls.set(jobId, interval);
  pollOnce(jobId);
}

function stopPolling(jobId) {
  const interval = state.polls.get(jobId);
  if (interval) window.clearInterval(interval);
  state.polls.delete(jobId);
}

async function loadCompositions() {
  const { res, json } = await apiGetJson("/api/compositions");
  if (!res.ok || !json) {
    $("#compositionMeta").textContent = `Failed to load compositions (${res.status})`;
    return;
  }
  state.compositions = json;
  renderCompositions();
}

function wireEvents() {
  $("#loadCompositions").addEventListener("click", async () => {
    await loadCompositions();
  });

  $("#renderAll").addEventListener("click", async () => {
    await queueRenderAll();
  });

  $("#dismissInstall").addEventListener("click", () => hideInstallBanner());

  document.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => setActiveFilter(btn.getAttribute("data-filter") || "all"));
  });

  $("#username").addEventListener("change", () => {
    const username = getUsername();
    hideInstallBanner();
    loadJobsFor(username);
  });
}

async function main() {
  wireEvents();
  await loadCompositions();
  setActiveFilter("all");

  const username = getUsername();
  if (username) loadJobsFor(username);
}

main();



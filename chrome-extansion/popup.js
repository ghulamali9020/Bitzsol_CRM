// ─── Config ───────────────────────────────────────────────────────────────────
const CRM_BASE_URL = "http://localhost:3000";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const syncBtn = document.getElementById("syncBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const statusEl = document.getElementById("status");
const profileCard = document.getElementById("profile-card");
const pipelineSelect = document.getElementById("pipelineSelect");
const urlEl = document.getElementById("profile-url");
const platformBadge = document.getElementById("platform-badge");

const fields = {
  name: document.getElementById("profile-name"),
  headline: document.getElementById("profile-headline"),
  location: document.getElementById("profile-location"),
  company: document.getElementById("profile-company"),
  jobTitle: document.getElementById("profile-job-title"),
  email: document.getElementById("profile-email"),
  phone: document.getElementById("profile-phone"),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  statusEl.innerHTML = msg;
  statusEl.className = type;
}

function setLoading(loading) {
  syncBtn.disabled = loading;
  syncBtn.textContent = loading ? "Syncing…" : "Sync Lead";
  copyAllBtn.disabled = loading;
}

function showSpinner() {
  return `<span class="spinner"></span>`;
}

// ─── Platform Detection ───────────────────────────────────────────────────────
function detectPlatform(url) {
  if (!url) return "Other";
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("upwork.com")) return "Upwork";
  if (url.includes("fiverr.com")) return "Fiverr";
  return "Other";
}

function getPlatformColor(platform) {
  switch (platform) {
    case "LinkedIn": return { bg: "#0A66C2", text: "#fff" };
    case "Upwork": return { bg: "#14a800", text: "#fff" };
    case "Fiverr": return { bg: "#1dbf73", text: "#fff" };
    default: return { bg: "#334155", text: "#e2e8f0" };
  }
}

function getPlatformIcon(platform) {
  switch (platform) {
    case "LinkedIn": return "💼";
    case "Upwork": return "🔗";
    case "Fiverr": return "🎯";
    default: return "🌐";
  }
}

function showPlatformBadge(platform) {
  if (!platformBadge) return;
  const color = getPlatformColor(platform);
  const icon = getPlatformIcon(platform);
  platformBadge.textContent = `${icon} ${platform}`;
  platformBadge.style.background = color.bg;
  platformBadge.style.color = color.text;
  platformBadge.style.display = "inline-block";
}

// ─── Auto-select pipeline by platform ────────────────────────────────────────
function autoSelectPipeline(platform, allPipelines) {
  if (!platform || platform === "Other") return;
  const platformLower = platform.toLowerCase();
  const exactMatch = allPipelines.find(
    (p) => p.name.toLowerCase() === platformLower
  );
  const partialMatch = allPipelines.find(
    (p) => p.name.toLowerCase().includes(platformLower) ||
           platformLower.includes(p.name.toLowerCase())
  );
  const match = exactMatch || partialMatch;
  if (match) {
    pipelineSelect.value = match.id;
    console.log(`[Bitzsol CRM] Auto-selected pipeline: ${match.name} for platform: ${platform}`);
  }
}

// ─── Copy buttons ────────────────────────────────────────────────────────────
function setupCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.target;
      const el = document.getElementById(targetId);
      if (!el) return;
      const text = el.textContent.trim();
      if (!text || text === "—") return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "✅";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "📋";
          btn.classList.remove("copied");
        }, 2000);
      } catch (err) {
        console.warn("Copy failed", err);
      }
    });
  });
}

// ─── Copy All ────────────────────────────────────────────────────────────────
copyAllBtn.addEventListener("click", async () => {
  const data = {
    "👤 Name": fields.name.textContent,
    "💼 Headline": fields.headline.textContent,
    "🌍 Location": fields.location.textContent,
    "🏢 Company": fields.company.textContent,
    "💼 Job Title": fields.jobTitle.textContent,
    "✉️ Email": fields.email.textContent,
    "📞 Phone": fields.phone.textContent,
    "🔗 Profile URL": urlEl.textContent,
  };
  const text = Object.entries(data)
    .filter(([_, v]) => v && v !== "—")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (!text) {
    setStatus("No data to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    copyAllBtn.textContent = "✅ Copied!";
    setTimeout(() => {
      copyAllBtn.textContent = "📋 Copy All";
    }, 2000);
    setStatus("All data copied.", "success");
  } catch (err) {
    setStatus("Copy failed.", "error");
  }
});

// ─── Load pipelines ──────────────────────────────────────────────────────────
let allPipelines = [];

async function loadPipelines(autoSelectPlatform = null) {
  try {
    const res = await fetch(`${CRM_BASE_URL}/api/pipelines`, {
      credentials: "include",
    });
    if (res.status === 401) {
      pipelineSelect.innerHTML = `<option value="">Not logged in — open CRM first</option>`;
      setStatus("Log in to the CRM, then reopen.", "error");
      syncBtn.disabled = true;
      return;
    }
    const json = await res.json();
    allPipelines = json?.data ?? [];
    if (!allPipelines.length) {
      pipelineSelect.innerHTML = `<option value="">No pipelines found</option>`;
      return;
    }
    pipelineSelect.innerHTML = allPipelines
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    
    if (autoSelectPlatform) {
      autoSelectPipeline(autoSelectPlatform, allPipelines);
    }
  } catch (err) {
    pipelineSelect.innerHTML = `<option value="">Failed to load pipelines</option>`;
    setStatus("Could not reach CRM.", "error");
    console.error(err);
  }
}

// ─── Scrape with auto‑injection ─────────────────────────────────────────────
let latestData = null;

/**
 * Tries to send a message to the content script.
 * If it fails because the script isn't loaded, injects it and retries.
 */
async function getProfileFromTab(tabId, maxRetries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "GET_PROFILE" });
      if (response && response.error) throw new Error(response.error);
      return response;
    } catch (err) {
      lastError = err;
      // If the error indicates no receiver, inject the content script
      if (err.message.includes("Could not establish connection") ||
          err.message.includes("Receiving end does not exist")) {
        console.log(`[Bitzsol CRM] Content script not found, injecting (attempt ${attempt+1})...`);
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });
        // Wait a moment for the script to initialize
        await new Promise(r => setTimeout(r, 300));
      } else {
        // Other errors – break retry
        break;
      }
    }
  }
  throw new Error(lastError?.message || "Failed to retrieve profile after retries");
}

async function scrapeAndDisplay(showLoading = true) {
  if (showLoading) setStatus(`${showSpinner()} Reading profile…`, "loading");
  profileCard.classList.remove("visible");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || "";
  const platform = detectPlatform(tabUrl);
  showPlatformBadge(platform);

  const isLinkedIn = tabUrl.includes("linkedin.com/in/");
  const isUpwork = tabUrl.includes("upwork.com/freelancers/") || tabUrl.includes("upwork.com/fl/");
  const isFiverr = tabUrl.includes("fiverr.com/");
  if (!(isLinkedIn || isUpwork || isFiverr)) {
    setStatus("Open a LinkedIn, Upwork, or Fiverr profile.", "error");
    return;
  }

  try {
    const data = await getProfileFromTab(tab.id);
    latestData = {
      name: data.name || null,
      headline: data.headline || null,
      location: data.location || null,
      company: data.company || null,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      profileUrl: data.profileUrl || tabUrl,
      platform: data.platform || platform,
    };

    // Update UI
    fields.name.textContent = latestData.name || "—";
    fields.headline.textContent = latestData.headline || "—";
    fields.location.textContent = latestData.location || "—";
    fields.company.textContent = latestData.company || "—";
    fields.jobTitle.textContent = latestData.jobTitle || "—";
    fields.email.textContent = latestData.email || "—";
    fields.phone.textContent = latestData.phone || "—";
    urlEl.textContent = latestData.profileUrl || tabUrl;

    profileCard.classList.add("visible");
    const count = Object.values(latestData).filter((v) => v && v !== "—" && typeof v === "string").length;
    setStatus(`✅ ${latestData.platform} profile loaded (${count} fields).`, "success");

    // Auto-select pipeline based on platform
    autoSelectPipeline(latestData.platform, allPipelines);
  } catch (err) {
    console.error(err);
    setStatus(`❌ Scrape failed: ${err.message}`, "error");
    latestData = null;
  }
}

// ─── Sync button ─────────────────────────────────────────────────────────────
syncBtn.addEventListener("click", async () => {
  const pipelineId = pipelineSelect.value;
  if (!pipelineId) {
    setStatus("Select a pipeline first.", "error");
    return;
  }
  if (!latestData || !latestData.name) {
    setStatus("No profile data. Open the popup again.", "error");
    return;
  }

  setLoading(true);
  setStatus(`${showSpinner()} Syncing to CRM…`, "loading");

  const platform = latestData.platform || detectPlatform(latestData.profileUrl);

  try {
    const res = await fetch(`${CRM_BASE_URL}/api/linkedin/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        source: "extension",
        platform,
        linkedInUrl: latestData.profileUrl,
        pipelineId,
        name: latestData.name,
        headline: latestData.headline,
        location: latestData.location,
        company: latestData.company,
        jobTitle: latestData.jobTitle,
        email: latestData.email,
        phone: latestData.phone,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    setStatus(`✅ Lead synced to CRM: ${latestData.name}`, "success");
  } catch (err) {
    console.error(err);
    setStatus(`❌ Sync error: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const platform = detectPlatform(tab?.url || "");
  showPlatformBadge(platform);
  await loadPipelines(platform);
  setupCopyButtons();
  // Wait a bit for page to settle, then scrape
  setTimeout(() => scrapeAndDisplay(true), 600);
})();
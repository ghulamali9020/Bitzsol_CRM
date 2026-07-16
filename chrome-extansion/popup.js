// ─── Config ───────────────────────────────────────────────────────────────────
const CRM_BASE_URL = "http://localhost:3000";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const syncBtn = document.getElementById("syncBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const statusEl = document.getElementById("status");
const profileCard = document.getElementById("profile-card");
const pipelineSelect = document.getElementById("pipelineSelect");
const urlEl = document.getElementById("profile-url");

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

async function loadPipelines() {
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
    // Auto-select first pipeline
    if (allPipelines.length > 0) pipelineSelect.value = allPipelines[0].id;
  } catch (err) {
    pipelineSelect.innerHTML = `<option value="">Failed to load pipelines</option>`;
    setStatus("Could not reach CRM.", "error");
    console.error(err);
  }
}

// ─── Scrape and display ─────────────────────────────────────────────────────
let latestData = null;

async function scrapeAndDisplay() {
  setStatus(`${showSpinner()} Reading profile…`, "loading");
  profileCard.classList.remove("visible");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("linkedin.com/in/")) {
    setStatus("Navigate to a LinkedIn profile (linkedin.com/in/…).", "error");
    return;
  }

  try {
    // Try to send message to content script; if fails, inject it 
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "GET_PROFILE",
      });
    } catch (err) {
      // Inject content script and retry
      console.log("[Bitzsol CRM] Injecting content script...");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await new Promise((r) => setTimeout(r, 300));
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "GET_PROFILE",
      });
    }

    if (response?.error) throw new Error(response.error);

    latestData = {
      name: response.name || null,
      headline: response.headline || null,
      location: response.location || null,
      company: response.company || null,
      jobTitle: response.jobTitle || null,
      email: response.email || null,
      phone: response.phone || null,
      profileUrl: response.profileUrl || tab.url,
    };

    // Update UI
    fields.name.textContent = latestData.name || "—";
    fields.headline.textContent = latestData.headline || "—";
    fields.location.textContent = latestData.location || "—";
    fields.company.textContent = latestData.company || "—";
    fields.jobTitle.textContent = latestData.jobTitle || "—";
    fields.email.textContent = latestData.email || "—";
    fields.phone.textContent = latestData.phone || "—";
    urlEl.textContent = latestData.profileUrl || tab.url;

    profileCard.classList.add("visible");
    const count = Object.values(latestData).filter(
      (v) => v && v !== "—",
    ).length;
    setStatus(`✅ Profile loaded (${count} fields).`, "success");
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

  try {
    const res = await fetch(`${CRM_BASE_URL}/api/linkedin/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        source: "extension",
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
    setStatus(`✅ Lead synced: ${latestData.name}`, "success");
  } catch (err) {
    console.error(err);
    setStatus(`❌ Sync error: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  await loadPipelines();
  setTimeout(scrapeAndDisplay, 600);
})();

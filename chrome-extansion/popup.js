// ─── Config ───────────────────────────────────────────────────────────────────
const CRM_BASE_URL = "http://localhost:3000";

// ─── Platform detection ────────────────────────────────────────────────────────
// Recognises a profile URL on any of the three supported platforms and returns
// its canonical name, or null if the current tab isn't a supported profile page.
function detectPlatform(url) {
  if (!url) return null;
  if (/linkedin\.com\/in\//i.test(url)) return "LinkedIn";
  if (/upwork\.com\/(freelancers|fl)\//i.test(url)) return "Upwork";
  if (
    /fiverr\.com\/[a-z0-9_.]+\/?(\?|$)/i.test(url) &&
    !/fiverr\.com\/(categories|search|users|gigs|requests|inbox|notifications|start_selling|logout|login|join|start)(\/|$)/i.test(
      url,
    )
  )
    return "Fiverr";
  return null;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const syncBtn = document.getElementById("syncBtn");
const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");
const profileCard = document.getElementById("profile-card");
const nameInput = document.getElementById("profile-name");
const headlineInput = document.getElementById("profile-headline");
const companyInput = document.getElementById("profile-company");
const locationInput = document.getElementById("profile-location");
const emailInput = document.getElementById("profile-email");
const phoneInput = document.getElementById("profile-phone");
const urlInput = document.getElementById("profile-url");
const pipelineSelect = document.getElementById("pipelineSelect");

// Set once a scrape has completed (even if some fields came back empty) so
// the fields become an editable form. Nothing is sent to the CRM until the
// user presses "Sync Lead" — the inputs are read live at that point, so any
// manual correction the user makes is what actually gets synced.
let hasFetchedProfile = false;
let detectedPlatform = null;
let isSyncing = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
  console.log(`[Bitzsol CRM] [${type || "info"}] ${msg}`);
}

// Reads whatever is currently in the editable fields — including any manual
// corrections the user made after the automatic scrape.
function getFieldValues() {
  return {
    name: nameInput.value.trim() || null,
    headline: headlineInput.value.trim() || null,
    company: companyInput.value.trim() || null,
    location: locationInput.value.trim() || null,
    email: emailInput.value.trim() || null,
    phone: phoneInput.value.trim() || null,
    profileUrl: urlInput.value.trim() || null,
  };
}

// Sync requires a scraped profile AND a pipeline; Copy only needs the profile.
function updateButtonStates() {
  copyBtn.disabled = !hasFetchedProfile;
  syncBtn.disabled = isSyncing || !hasFetchedProfile || !pipelineSelect.value;
  syncBtn.textContent = isSyncing ? "Syncing…" : "Sync Lead";
}

// ─── Load pipelines on popup open ─────────────────────────────────────────────
async function loadPipelines() {
  try {
    const res = await fetch(`${CRM_BASE_URL}/api/pipelines`, {
      credentials: "include",
    });

    if (res.status === 401) {
      pipelineSelect.innerHTML = `<option value="">Not logged in — open CRM first</option>`;
      setStatus("Log in to the CRM, then reopen this popup.", "error");
      syncBtn.disabled = true;
      return;
    }

    const json = await res.json();
    const pipelines = json?.data ?? [];

    if (pipelines.length === 0) {
      pipelineSelect.innerHTML = `<option value="">No pipelines found</option>`;
      return;
    }

    pipelineSelect.innerHTML = pipelines
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");

    console.log("[Bitzsol CRM] Loaded pipelines:", pipelines.length);
  } catch (err) {
    pipelineSelect.innerHTML = `<option value="">Failed to load pipelines</option>`;
    setStatus("Could not reach CRM. Is it running?", "error");
    console.error("[Bitzsol CRM] Pipeline load error:", err);
  }
}

// Voyager email fetch removed

// ─── Scraping function (runs inside every LinkedIn frame) ─────────────────────
// Must be a top-level named function for chrome.scripting.executeScript.
async function scrapeLinkedInPage() {
  // ── Name ──────────────────────────────────────────────────────────────────
  // document.title = "Hasnain Aftab | LinkedIn" — always reliable
  const titleName = (() => {
    const raw = document.title.split("|")[0]?.trim();
    return raw && raw.toLowerCase() !== "linkedin" ? raw : null;
  })();
  const name = titleName || null;

  // ── Find the DOM element that actually holds the name ──────────────────────
  // Search by text content — immune to LinkedIn's class renames.
  let nameEl = null;
  if (name) {
    // Fast: headings and role=heading
    nameEl = [...document.querySelectorAll("h1,h2,h3,[role='heading']")].find(
      (el) => el.innerText?.trim() === name,
    );
    // Slow: any leaf-ish span/div containing only the name
    if (!nameEl) {
      nameEl = [...document.querySelectorAll("span,div")].find(
        (el) => el.childElementCount <= 1 && el.innerText?.trim() === name,
      );
    }
  }

  // ── Headline ──────────────────────────────────────────────────────────────
  let headline = null;

  // LinkedIn shows a "· 1st", "· 2nd" connection badge near the name —
  // we must skip those. A real headline is long and doesn't start with "·".
  const isConnectionBadge = (text) =>
    !text ||
    /^[·•]\s*(1st|2nd|3rd)/i.test(text) ||
    /^(1st|2nd|3rd)\s*$/i.test(text) ||
    text.length < 5;

  // CSS fast path
  const headlineCss =
    document.querySelector(".text-body-medium.break-words") ||
    document.querySelector(".text-body-medium") ||
    document.querySelector("[data-generated-suggestion-target]");

  if (
    headlineCss?.innerText?.trim() &&
    !isConnectionBadge(headlineCss.innerText.trim()) &&
    headlineCss.innerText.trim() !== name
  ) {
    headline = headlineCss.innerText.trim().split("\n")[0];
  }

  // DOM walk from nameEl — climb ancestors until meaningful siblings found
  if (!headline && nameEl) {
    let container = nameEl.parentElement;
    for (let depth = 0; depth < 10 && container && !headline; depth++) {
      const siblings = [...(container.parentElement?.children || [])];
      const nameIdx = siblings.indexOf(container);
      if (nameIdx >= 0) {
        for (
          let i = nameIdx + 1;
          i < Math.min(nameIdx + 5, siblings.length);
          i++
        ) {
          const text = siblings[i]?.innerText?.trim()?.split("\n")[0];
          if (text && !isConnectionBadge(text) && text !== name) {
            headline = text;
            break;
          }
        }
      }
      container = container.parentElement;
    }
  }

  // JSON-LD structured data fallback
  if (!headline) {
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.jobTitle) {
          headline = data.jobTitle;
          break;
        }
        if (data["@graph"]) {
          for (const node of data["@graph"]) {
            if (node.jobTitle) {
              headline = node.jobTitle;
              break;
            }
          }
        }
      } catch {}
    }
  }

  // ── Email (from LinkedIn's "Contact info" modal) ───────────────────────────
  // LinkedIn only puts the email in the DOM when the contact info modal/panel is open.
  // We try to open it automatically if it's not already open, scrape the email, and then close it.
  let modalOpen = !!(
    document.querySelector("#artdeco-modal-outlet") ||
    document.querySelector(".artdeco-modal")
  );
  let openedProgrammatically = false;

  if (!modalOpen) {
    // Try to find the contact info button/link
    const contactBtn =
      document.querySelector('a[href*="/overlay/contact-info/"]') ||
      document.querySelector('a[href*="contact-info"]') ||
      document.querySelector("#topcard-contact-info-cd") ||
      [...document.querySelectorAll("a, button, span")].find(
        (el) => el.innerText?.trim()?.toLowerCase() === "contact info",
      );

    if (contactBtn) {
      contactBtn.click();
      openedProgrammatically = true;

      // Wait up to 1.5s for the modal to load in the DOM
      await new Promise((resolve) => {
        let elapsed = 0;
        const interval = setInterval(() => {
          const hasModal =
            document.querySelector("#artdeco-modal-outlet") ||
            document.querySelector(".artdeco-modal");
          if (hasModal || elapsed >= 1500) {
            clearInterval(interval);
            resolve();
          }
          elapsed += 100;
        }, 100);
      });
    }
  }

  const isContactOverlay = window.location.href.includes(
    "/overlay/contact-info/",
  );

  const emailSelectors = [
    '#artdeco-modal-outlet a[href^="mailto:"]', // modal (any LinkedIn modal)
    '.pv-contact-info__contact-type a[href^="mailto:"]', // contact section (older LinkedIn)
    '.ci-email a[href^="mailto:"]', // ci-email section
    '.pv-contact-info a[href^="mailto:"]', // parent contact-info wrapper
    '.artdeco-modal a[href^="mailto:"]', // generic artdeco modal
    'section[class*="contact"] a[href^="mailto:"]', // any contact section
  ];

  if (isContactOverlay) {
    emailSelectors.unshift('a[href^="mailto:"]');
  }

  let email = null;
  for (const sel of emailSelectors) {
    const link = document.querySelector(sel);
    if (link) {
      const addr = link.href.replace("mailto:", "").trim();
      // Basic validation: must have @ and a dot, and not be LinkedIn's own
      if (
        addr.includes("@") &&
        addr.includes(".") &&
        !addr.endsWith("@linkedin.com")
      ) {
        email = addr;
        break;
      }
    }
  }

  // ── Phone (from the same "Contact info" modal) ─────────────────────────────
  // LinkedIn never uses tel: links for the phone number — it's plain text
  // under a "Phone" label — so we scan the modal text near that label instead.
  const modalRoot =
    document.querySelector("#artdeco-modal-outlet") ||
    document.querySelector(".artdeco-modal") ||
    (isContactOverlay ? document.body : null);

  let phone = null;
  const phoneRegex = /(\+?\d[\d\s\-().]{6,}\d)/;

  if (modalRoot) {
    // Prefer a block whose own label/heading text is exactly "Phone"
    const phoneBlock = [
      ...modalRoot.querySelectorAll("li, section, div"),
    ].find((el) => {
      const label = el.querySelector("h3, span")?.innerText?.trim()?.toLowerCase();
      return label === "phone";
    });

    if (phoneBlock) {
      const match = phoneBlock.innerText.match(phoneRegex);
      if (match) phone = match[1].trim();
    }

    // Fallback: scan the whole modal text for a phone-like pattern that
    // appears shortly after the word "Phone"
    if (!phone) {
      const modalText = modalRoot.innerText || "";
      const idx = modalText.toLowerCase().indexOf("phone");
      if (idx !== -1) {
        const snippet = modalText.slice(idx, idx + 100);
        const match = snippet.match(phoneRegex);
        if (match) phone = match[1].trim();
      }
    }
  }

  // If we opened the modal programmatically, close it so the user's view remains clean
  if (openedProgrammatically) {
    const closeBtn =
      document.querySelector(
        '#artdeco-modal-outlet button[aria-label="Dismiss"]',
      ) ||
      document.querySelector(".artdeco-modal__dismiss") ||
      document.querySelector(
        "#artdeco-modal-outlet [data-test-modal-close-btn]",
      ) ||
      document.querySelector(".artdeco-modal button");
    if (closeBtn) {
      closeBtn.click();
    }
  }

  // ── Location ──────────────────────────────────────────────────────────────
  // CSS fast path first (works on some LinkedIn builds), but these class
  // names churn often, so we fall back to a text-pattern DOM walk: the top
  // card renders Name → Headline → Location as consecutive sibling blocks,
  // and location text looks like "City, Region" / "City, Country" — short,
  // comma-separated, capitalized words, unlike the headline or a connection
  // count.
  let location =
    document
      .querySelector(".not-first-middot span[aria-hidden='true']")
      ?.innerText?.trim() ||
    document
      .querySelector(".pv-text-details__left-panel .t-black--light")
      ?.innerText?.trim() ||
    null;

  if (!location) {
    const isLocationLike = (text) =>
      !!text &&
      text !== name &&
      text !== headline &&
      text.length <= 80 &&
      !/connection|follower/i.test(text) &&
      /^[A-Z][\w.'\-]*(?:\s[A-Z]?[\w.'\-]*){0,4},\s*[A-Z]/.test(text);

    let container = nameEl?.parentElement;
    for (let depth = 0; depth < 6 && container && !location; depth++) {
      const siblings = [...(container.parentElement?.children || [])];
      for (const sib of siblings) {
        const text = sib?.innerText?.trim()?.split("\n")[0];
        if (isLocationLike(text)) {
          location = text;
          break;
        }
      }
      container = container.parentElement;
    }
  }

  location = location?.split("·")[0]?.trim() || null;

  // ── Company ───────────────────────────────────────────────────────────────
  // LinkedIn doesn't expose company as a discrete field on the profile header,
  // so we try, in order: (1) the first entry in the "Experience" section,
  // which is usually "Job Title" then "Company · Employment type"; (2) an
  // "at Company" / "@ Company" pattern inside the headline itself.
  //
  // The Experience section is looked up via the #experience anchor — a
  // stable jump-link id LinkedIn has used for years, far less likely to
  // change than heading text or class names. If it hasn't rendered yet
  // (LinkedIn lazy-loads content below the fold), we scroll it into view
  // and give it a moment before reading it, the same trick used above for
  // the contact-info modal.
  let company = null;

  let expAnchor = document.getElementById("experience");
  let expSection = expAnchor?.closest("section");

  if (expAnchor && !expSection?.querySelector("li")) {
    expAnchor.scrollIntoView({ block: "center" });
    await new Promise((resolve) => setTimeout(resolve, 800));
    expSection = expAnchor.closest("section");
  }

  if (!expSection) {
    const expHeading = [
      ...document.querySelectorAll("h2,h3,[role='heading']"),
    ].find((h) => h.innerText?.trim().toLowerCase() === "experience");
    expSection =
      expHeading?.closest("section") ||
      expHeading?.parentElement?.parentElement ||
      null;
  }

  const firstExpItem = expSection?.querySelector("li");
  if (firstExpItem) {
    const lines = firstExpItem.innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      company = lines[1].split("·")[0]?.trim() || null;
    }
  }

  if (!company && headline) {
    const atMatch = headline.match(/\b(?:at|@)\s+([A-Z][\w&.,'\- ]{1,60})$/);
    if (atMatch) company = atMatch[1].trim();
  }

  // ── Debug (appears in popup console) ──────────────────────────────────────
  const debug = {
    frameUrl: window.location.href,
    title: document.title,
    nameElFound: nameEl
      ? `${nameEl.tagName} class="${nameEl.className?.slice(0, 60)}"`
      : "none",
    allHeadings: [
      ...document.querySelectorAll("h1,h2,h3,[role='heading']"),
    ].map((el) => `${el.tagName}: "${el.innerText?.trim()?.slice(0, 80)}"`),
    headlineResult: headline || "none",
    emailResult: email || "none",
    phoneResult: phone || "none",
    companyResult: company || "none",
    locationResult: location || "none",
    openedModal: openedProgrammatically,
  };

  return {
    name,
    headline,
    company,
    location,
    email,
    phone,
    profileUrl: window.location.href,
    debug,
  };
}

// ─── Scraping function for Upwork / Fiverr profile pages ──────────────────────
// Both platforms deliberately strip contact info from public profiles (it's
// against their ToS to share it outside the platform), and their DOM class
// names churn constantly like LinkedIn's. So instead of chasing CSS selectors
// we lean on stable, SEO-oriented sources: <title>, OpenGraph meta tags, and
// schema.org JSON-LD — all of which these platforms populate for search
// engines and are far less likely to change than internal class names.
async function scrapeGenericProfilePage() {
  const host = window.location.hostname.replace(/^www\./, "");
  const platform = host.includes("upwork.com")
    ? "Upwork"
    : host.includes("fiverr.com")
      ? "Fiverr"
      : "Other";
  const suffixRegex =
    platform === "Upwork" ? /\s*\|\s*Upwork\s*$/i : /\s*[-|]\s*Fiverr\s*$/i;

  const rawTitle = (document.title || "").replace(suffixRegex, "").trim();
  let name = null;
  let headline = null;

  if (rawTitle && rawTitle.toLowerCase() !== platform.toLowerCase()) {
    const parts = rawTitle.split(/\s+[-|]\s+/);
    name = parts[0]?.trim() || null;
    headline = parts.slice(1).join(" - ").trim() || null;
  }

  const ogTitle =
    document.querySelector('meta[property="og:title"]')?.content?.trim() ||
    null;
  const ogDesc =
    document
      .querySelector('meta[property="og:description"]')
      ?.content?.trim() ||
    document.querySelector('meta[name="description"]')?.content?.trim() ||
    null;

  if (!name && ogTitle) {
    const parts = ogTitle.split(/\s+[-|]\s+/);
    name = parts[0]?.trim() || null;
    if (!headline) headline = parts.slice(1).join(" - ").trim() || null;
  }
  if (!headline && ogDesc) headline = ogDesc.split("\n")[0]?.slice(0, 200) || null;

  // Structured data (schema.org Person/ProfilePage), when the page embeds it
  let location = null;
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const data = JSON.parse(script.textContent);
      const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      const person = nodes.find(
        (n) => n && (n["@type"] === "Person" || n["@type"] === "ProfilePage"),
      );
      if (person) {
        if (!name && person.name) name = person.name;
        if (!headline && person.jobTitle) headline = person.jobTitle;
        const addr = person.address || person.homeLocation?.address;
        if (addr && !location) {
          location =
            [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(", ") || null;
        }
      }
    } catch {}
  }

  // Last-resort DOM fallback for the name
  if (!name) {
    name = document.querySelector("h1")?.innerText?.trim() || null;
  }

  // Only trust genuine mailto:/tel: links — never guess contact info that
  // isn't literally present, since these platforms intentionally hide it.
  const emailLink = document.querySelector('a[href^="mailto:"]');
  const email = emailLink
    ? emailLink.href.replace("mailto:", "").trim() || null
    : null;
  const phoneLink = document.querySelector('a[href^="tel:"]');
  const phone = phoneLink
    ? phoneLink.href.replace("tel:", "").trim() || null
    : null;

  const debug = {
    frameUrl: window.location.href,
    platform,
    title: document.title,
    ogTitle: ogTitle || "none",
    ogDesc: ogDesc || "none",
    nameResult: name || "none",
    headlineResult: headline || "none",
  };

  return {
    name,
    headline,
    company: null, // these are individual profiles, not employer records
    location,
    email,
    phone,
    profileUrl: window.location.href,
    debug,
  };
}

// ─── Fetch + preview (runs automatically when the popup opens) ────────────────
// This only reads the page — it never talks to the CRM. The user reviews what
// was found and decides whether to press "Sync Lead".
async function fetchAndPreviewProfile() {
  profileCard.classList.remove("visible");
  hasFetchedProfile = false;
  detectedPlatform = null;
  updateButtonStates();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("[Bitzsol CRM] Active tab:", tab?.url);

  const platform = detectPlatform(tab?.url);
  if (!platform) {
    setStatus(
      "Navigate to a linkedin.com/in/…, upwork.com/freelancers/…, or fiverr.com/… page first.",
      "error",
    );
    return;
  }

  setStatus(`Reading ${platform} profile…`, "loading");

  const scraperFn =
    platform === "LinkedIn" ? scrapeLinkedInPage : scrapeGenericProfilePage;

  // Run scraper in ALL frames (some of these sites use iframes)
  let profile;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: scraperFn,
    });

    // Score each frame: prefer ones with headline > headings > name
    const score = (r) =>
      (r?.headline ? 20 : 0) +
      (r?.debug?.allHeadings?.length > 0 ? 10 : 0) +
      (r?.name ? 5 : 0) +
      (r?.email ? 3 : 0) +
      (r?.phone ? 3 : 0) +
      (r?.company ? 2 : 0);

    const sorted = (results || [])
      .map((r) => r.result)
      .filter(Boolean)
      .sort((a, b) => score(b) - score(a));

    if (sorted.length === 0)
      throw new Error("Script returned no data from any frame.");

    // Merge results from all frames (highest score takes precedence)
    profile = {
      name: null,
      headline: null,
      company: null,
      location: null,
      email: null,
      phone: null,
      profileUrl: tab.url,
      platform,
    };
    for (const r of [...sorted].reverse()) {
      if (r.name) profile.name = r.name;
      if (r.headline) profile.headline = r.headline;
      if (r.company) profile.company = r.company;
      if (r.location) profile.location = r.location;
      if (r.email) profile.email = r.email;
      if (r.phone) profile.phone = r.phone;
      if (r.profileUrl) profile.profileUrl = r.profileUrl;
    }

    // Clean profileUrl (remove overlay path if present)
    if (
      profile.profileUrl &&
      profile.profileUrl.includes("/overlay/contact-info")
    ) {
      profile.profileUrl = profile.profileUrl.split("/overlay/contact-info")[0];
    }

    console.log(
      "[Bitzsol CRM] All frame debug:",
      results.map((r) => r.result?.debug),
    );
    console.log("[Bitzsol CRM] Scraped (merged):", profile);
  } catch (err) {
    console.error("[Bitzsol CRM] Scraping error:", err);
    setStatus(`Scraping error: ${err.message}`, "error");
    return;
  }

  // Populate the editable fields — nothing has been sent to the CRM yet, and
  // the user can correct any of these before syncing.
  nameInput.value = profile.name || "";
  headlineInput.value = profile.headline || "";
  companyInput.value = profile.company || "";
  locationInput.value = profile.location || "";
  emailInput.value = profile.email || "";
  phoneInput.value = profile.phone || "";
  urlInput.value = profile.profileUrl || tab.url || "";
  profileCard.classList.add("visible");

  hasFetchedProfile = true;
  detectedPlatform = platform;
  setStatus(`${platform} profile loaded. Review the fields, then press “Sync Lead”.`, "");
  updateButtonStates();
}

// ─── Copy button click ──────────────────────────────────────────────────────
// Copies the (possibly hand-edited) fields to the clipboard as plain text.
copyBtn.addEventListener("click", async () => {
  const fields = getFieldValues();
  const lines = [
    `Name: ${fields.name || "—"}`,
    `Headline: ${fields.headline || "—"}`,
    `Company: ${fields.company || "—"}`,
    `Location: ${fields.location || "—"}`,
    `Email: ${fields.email || "—"}`,
    `Phone: ${fields.phone || "—"}`,
    `Profile: ${fields.profileUrl || "—"}`,
  ];

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    setStatus("Copied to clipboard.", "success");
  } catch (err) {
    console.error("[Bitzsol CRM] Copy error:", err);
    setStatus(`Copy failed: ${err.message}`, "error");
  }
});

// ─── Sync button click ────────────────────────────────────────────────────────
// Only fires on explicit user action — sends whatever is currently in the
// editable fields (including manual corrections) to the CRM, no re-scraping.
syncBtn.addEventListener("click", async () => {
  const pipelineId = pipelineSelect.value;
  if (!pipelineId) {
    setStatus("Select a pipeline first.", "error");
    return;
  }
  if (!hasFetchedProfile) {
    setStatus("No profile data to sync yet.", "error");
    return;
  }

  const fields = getFieldValues();

  isSyncing = true;
  updateButtonStates();
  setStatus("Syncing to CRM…", "loading");

  try {
    const res = await fetch(`${CRM_BASE_URL}/api/linkedin/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        source: "extension",
        linkedInUrl: fields.profileUrl,
        platform: detectedPlatform,
        pipelineId,
        name: fields.name,
        headline: fields.headline,
        company: fields.company,
        location: fields.location,
        email: fields.email,
        phone: fields.phone,
      }),
    });

    const json = await res.json();
    console.log("[Bitzsol CRM] API response:", json);

    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

    setStatus(`✓ Lead synced: ${fields.name}`, "success");
  } catch (err) {
    console.error("[Bitzsol CRM] API error:", err);
    setStatus(`API error: ${err.message}`, "error");
  } finally {
    isSyncing = false;
    updateButtonStates();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
pipelineSelect.addEventListener("change", updateButtonStates);
loadPipelines().then(updateButtonStates);
fetchAndPreviewProfile();

if (!window.__bitzsol_crm_loaded) {
  window.__bitzsol_crm_loaded = true;

  console.log("[Bitzsol CRM] Content script loaded on:", window.location.href);

  function detectPlatform(url) {
    if (!url) return "Other";
    if (url.includes("linkedin.com")) return "LinkedIn";
    if (url.includes("upwork.com")) return "Upwork";
    if (url.includes("fiverr.com")) return "Fiverr";
    return "Other";
  }

  function cleanText(el) {
    if (!el) return null;
    const t = (el.innerText || el.textContent || "").trim();
    return t.split(/[·•\n]/)[0].trim() || null;
  }

  function findElement(selectors, container = document) {
    for (const sel of selectors) {
      const el = container.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  async function scrapeLinkedInPage() {
    let name = null,
      headline = null,
      company = null,
      jobTitle = null,
      location = null;

    // ---------- 1. JSON‑LD (unchanged) ----------
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        if (data["@type"] === "Person") {
          name = data.name || null;
          headline = data.jobTitle || null;
          if (data.worksFor) company = data.worksFor.name || null;
          if (data.address) {
            location =
              data.address.addressLocality ||
              data.address.addressRegion ||
              data.address.addressCountry ||
              null;
          }
          break;
        }
        if (data["@graph"]) {
          for (const node of data["@graph"]) {
            if (node["@type"] === "Person") {
              name = node.name || name;
              headline = node.jobTitle || headline;
              if (node.worksFor) company = node.worksFor.name || company;
              if (node.address)
                location =
                  node.address.addressLocality ||
                  node.address.addressRegion ||
                  node.address.addressCountry ||
                  location;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    // ---------- 2. DOM fallbacks ----------
    // --- Name (your original) ---
    if (!name) {
      const raw = document.title.split("|")[0]?.trim();
      const titleName = raw && raw.toLowerCase() !== "linkedin" ? raw : null;
      const h1Name = document.querySelector("h1")?.innerText?.trim() || null;
      name = titleName || h1Name || null;
    }

    // --- Headline (improved) ---
    if (!headline) {
      const headlineSelectors = [
        ".text-body-medium.break-words",
        ".pv-text-details__left-panel .text-body-medium",
        "h2.text-body-medium",
      ];
      const el = findElement(headlineSelectors);
      if (el) headline = el.innerText.trim().split("\n")[0].trim();
      if (!headline) {
        const h1 = document.querySelector("h1");
        if (h1 && h1.parentElement) {
          const siblings = [...h1.parentElement.children];
          const idx = siblings.indexOf(h1);
          for (let i = idx + 1; i < siblings.length; i++) {
            const text = siblings[i]?.innerText?.trim() || "";
            if (text.length > 10 && !text.match(/^[·•]/) && !text.match(/^\d+ connections?$/i)) {
              headline = text.split("\n")[0].trim();
              break;
            }
          }
        }
      }
    }

    // --- Location (EXPANDED selectors + text fallback) ---
    if (!location) {
      const locSelectors = [
        ".not-first-middot span[aria-hidden='true']",
        "span.t-black--light.t-normal",
        ".pv-text-details__left-panel .t-black--light",
        ".pv-top-card--list .t-black--light",
        ".pv-top-card__location",                // common new UI
        "[data-generated-location]",              // sometimes used
        ".pv-top-card .pv-top-card__location",   // explicit
        ".pv-top-card .t-black--light",          // generic fallback
      ];
      const el = findElement(locSelectors);
      if (el) {
        let loc = el.innerText.trim().split("·")[0].trim();
        if (loc.length > 2 && !loc.match(/^\d/)) location = loc;
      }
      // If still missing, look for any text containing city/country pattern
      if (!location) {
        const allText = document.body.innerText || "";
        // Try to find a line with a city, state, or country (common format)
        const lines = allText.split("\n").map(l => l.trim()).filter(l => l.length > 3);
        for (const line of lines) {
          // Match common location patterns: "City, State" or "City, Country"
          if (/^[A-Za-z\s\-]+,\s*[A-Za-z\s]+$/.test(line) && !line.includes("LinkedIn") && !line.includes("Profile")) {
            location = line;
            break;
          }
        }
      }
    }

    // --- Company & Job Title (already improved) ---
    // ... (keep the same code you have from the previous version) ...
    // I'll include it here to avoid repetition, but you already have it.

    // ---------- 3. Email & Phone (EXPANDED phone extraction) ----------
    let email = null;
    let phone = null;
    let openedModal = false;

    const modalExists = !!(
      document.querySelector("#artdeco-modal-outlet") ||
      document.querySelector(".artdeco-modal")
    );

    if (!modalExists) {
      const contactBtn =
        document.querySelector('a[href*="/overlay/contact-info/"]') ||
        document.querySelector('a[href*="contact-info"]') ||
        document.querySelector("#topcard-contact-info-cd") ||
        [...document.querySelectorAll("a, button, span")].find(
          (el) => el.innerText?.trim()?.toLowerCase() === "contact info"
        );
      if (contactBtn) {
        contactBtn.click();
        openedModal = true;
        await new Promise((resolve) => {
          let elapsed = 0;
          const interval = setInterval(() => {
            const hasModal =
              document.querySelector("#artdeco-modal-outlet") ||
              document.querySelector(".artdeco-modal");
            if (hasModal || elapsed >= 2500) {
              clearInterval(interval);
              resolve();
            }
            elapsed += 100;
          }, 100);
        });
      }
    }

    const isContactOverlay = window.location.href.includes("/overlay/contact-info/");

    // --- Email (unchanged) ---
    const emailSelectors = [
      '#artdeco-modal-outlet a[href^="mailto:"]',
      '.pv-contact-info__contact-type a[href^="mailto:"]',
      '.ci-email a[href^="mailto:"]',
      '.pv-contact-info a[href^="mailto:"]',
      '.artdeco-modal a[href^="mailto:"]',
      'section[class*="contact"] a[href^="mailto:"]',
    ];
    if (isContactOverlay) emailSelectors.unshift('a[href^="mailto:"]');
    for (const sel of emailSelectors) {
      const link = document.querySelector(sel);
      if (link) {
        const addr = link.href.replace("mailto:", "").trim();
        if (addr.includes("@") && addr.includes(".") && !addr.endsWith("@linkedin.com")) {
          email = addr;
          break;
        }
      }
    }

    // --- Phone (EXPANDED: more selectors + text extraction) ---
    // First try tel: links
    const phoneSelectors = [
      '#artdeco-modal-outlet a[href^="tel:"]',
      '.pv-contact-info__contact-type a[href^="tel:"]',
      '.ci-phone a[href^="tel:"]',
      '.pv-contact-info a[href^="tel:"]',
      '.artdeco-modal a[href^="tel:"]',
      'section[class*="contact"] a[href^="tel:"]',
      // Additional common classes
      '.pv-contact-info__contact-item a[href^="tel:"]',
      '.contact-info__phone a[href^="tel:"]',
    ];
    if (isContactOverlay) phoneSelectors.unshift('a[href^="tel:"]');
    for (const sel of phoneSelectors) {
      const link = document.querySelector(sel);
      if (link) {
        const num = link.href.replace("tel:", "").trim();
        if (num.length > 5) { phone = num; break; }
      }
    }

    // If no tel: link, scan the modal text for a phone number
    if (!phone) {
      const modal = document.querySelector("#artdeco-modal-outlet, .artdeco-modal, .pv-contact-info");
      if (modal) {
        const text = modal.innerText || "";
        // Look for "Phone" label then number
        const phoneMatch = text.match(/Phone\s*[:|]\s*([+\d\s()-]+)/i);
        if (phoneMatch) {
          phone = phoneMatch[1].trim();
        } else {
          // Fallback: any number with at least 10 digits
          const regex = /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
          const match = text.match(regex);
          if (match) phone = match[0];
        }
      }
    }

    // If still no phone, try scanning the whole page for a phone number (last resort)
    if (!phone) {
      const bodyText = document.body.innerText || "";
      // Look for lines with "Phone" or a number pattern
      const lines = bodyText.split("\n").map(l => l.trim()).filter(l => l.length > 5);
      for (const line of lines) {
        if (/Phone/i.test(line)) {
          const num = line.replace(/Phone\s*[:|]/i, "").trim();
          if (num.length > 5 && /\d/.test(num)) {
            phone = num;
            break;
          }
        }
      }
      if (!phone) {
        const regex = /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
        const match = bodyText.match(regex);
        if (match) phone = match[0];
      }
    }

    if (openedModal) {
      const closeBtn =
        document.querySelector('#artdeco-modal-outlet button[aria-label="Dismiss"]') ||
        document.querySelector(".artdeco-modal__dismiss") ||
        document.querySelector("#artdeco-modal-outlet [data-test-modal-close-btn]") ||
        document.querySelector(".artdeco-modal button");
      if (closeBtn) closeBtn.click();
    }

    // Profile URL cleanup
    let profileUrl = window.location.href;
    if (profileUrl.includes("/overlay/contact-info")) {
      profileUrl = profileUrl.split("/overlay/contact-info")[0];
    }

    const platform = detectPlatform(profileUrl);

    // Log the results for debugging
    console.log("[Bitzsol CRM] Scraped data:", { name, headline, location, company, jobTitle, email, phone, profileUrl, platform });

    return {
      name,
      headline,
      location,
      company,
      jobTitle,
      email,
      phone,
      profileUrl,
      platform,
    };
  }

  // ─── Message listener (unchanged) ──────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_PROFILE") {
      scrapeLinkedInPage()
        .then((profile) => {
          console.log("[Bitzsol CRM] Scraped (content):", profile);
          sendResponse(profile);
        })
        .catch((err) => {
          console.error("[Bitzsol CRM] Scrape error:", err);
          sendResponse({ error: err.message });
        });
      return true;
    }

    if (request.action === "GET_PLATFORM") {
      sendResponse({ platform: detectPlatform(window.location.href) });
      return true;
    }
  });
}
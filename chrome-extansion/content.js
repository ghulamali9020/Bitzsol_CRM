if (!window.__bitzsol_crm_loaded) {
  window.__bitzsol_crm_loaded = true;

  console.log("[Bitzsol CRM] Content script loaded on:", window.location.href);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function normalizeText(value) {
    return (value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function waitForElement(selector, timeout = 4000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // ─── Extract from JSON‑LD ──────────────────────────────────────────────
  function extractFromJsonLd() {
    const result = {
      name: null,
      headline: null,
      company: null,
      location: null,
    };
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        const data = JSON.parse(script.textContent);
        const nodes = data["@graph"] ? data["@graph"] : [data];
        for (const node of nodes) {
          if (node["@type"] === "Person") {
            result.name = result.name || node.name || null;
            result.headline = result.headline || node.jobTitle || null;
            result.company = result.company || node.worksFor?.name || null;
            if (node.address) {
              result.location =
                result.location ||
                node.address.addressLocality ||
                node.address.addressRegion ||
                node.address.addressCountry ||
                null;
            }
          }
        }
      } catch (_) {}
    }
    return result;
  }

  // ─── Main LinkedIn scraper ──────────────────────────────────────────────
  async function scrapeLinkedIn() {
    console.log("[Bitzsol CRM] Starting LinkedIn scrape...");

    // Wait for the main container
    await waitForElement(".pv-top-card, .pv-top-card-v2-section", 3000);

    // ── 1. JSON‑LD (most reliable) ──────────────────────────────────────
    let ld = extractFromJsonLd();
    console.log("[Bitzsol CRM] JSON‑LD data:", ld);

    // ── 2. Name ──────────────────────────────────────────────────────────
    let name = ld.name;
    if (!name) {
      const nameSelectors = [
        "h1.text-heading-xlarge",
        "h1.top-card-layout__title",
        "h1.pv-top-card-section__name",
        "h1",
      ];
      for (const sel of nameSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          name = normalizeText(el.innerText);
          break;
        }
      }
    }
    if (!name) {
      const titleParts = document.title.split("|");
      if (titleParts.length > 1) name = normalizeText(titleParts[0]);
    }
    console.log("[Bitzsol CRM] Name:", name);

    // ── 3. Headline ──────────────────────────────────────────────────────
    let headline = ld.headline;
    if (!headline) {
      const headlineSelectors = [
        ".text-body-medium.break-words",
        ".pv-text-details__left-panel .text-body-medium",
        "h2.text-body-medium",
        ".pv-top-card--list .text-body-medium",
        ".pv-top-card-v2-section__headline",
        ".pv-top-card__headline",
      ];
      for (const sel of headlineSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = normalizeText(el.innerText);
          // Skip connection badges
          if (!/^[·•]\s*(1st|2nd|3rd)/i.test(text)) {
            headline = text;
            break;
          }
        }
      }
    }
    console.log("[Bitzsol CRM] Headline:", headline);

    // ── 4. Location ──────────────────────────────────────────────────────
    let location = ld.location;
    if (!location) {
      const locationSelectors = [
        ".pv-top-card__location",
        ".pv-top-card-v2-section__location",
        "span.text-body-small.inline.t-black--light.break-words",
        ".pv-text-details__left-panel .t-black--light",
        "[data-generated-location]",
        ".pv-top-card--list .t-black--light",
      ];
      for (const sel of locationSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          location = normalizeText(el.innerText);
          break;
        }
      }
    }
    console.log("[Bitzsol CRM] Location:", location);

    // ── 5. Company & Job Title ──────────────────────────────────────────
    let company = ld.company;
    let jobTitle = null;

    // First try the top card company link
    if (!company) {
      const companySelectors = [
        ".pv-top-card-v2-section__company-name a",
        ".pv-top-card__experience-list a",
        ".pv-top-card__experience-list span",
      ];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = normalizeText(el.innerText);
          const parts = text.split(/\s+at\s+/i);
          if (parts.length === 2) {
            jobTitle = parts[0];
            company = parts[1];
          } else {
            company = text;
          }
          break;
        }
      }
    }

    // If not found, look in experience section
    if (!company || !jobTitle) {
      const expSection = document.querySelector(
        "section#experience, section[data-section='experience'], section[data-view-name='profile-experience'], div[data-section='experience'], main",
      );
      if (expSection) {
        const items = expSection.querySelectorAll(
          ".pvs-list__paged-list-item, .pv-entity__position-group-role-item, .pv-profile-section__card-item, li",
        );
        for (const item of items) {
          const titleEl = item.querySelector(
            "h3 span[aria-hidden='true'], h3 span, .t-16.t-black--bold, .mr1.t-bold, .t-bold",
          );
          const companyEl = item.querySelector(
            ".pv-entity__secondary-title, .pv-entity__company-summary-info a, .pv-entity__company-summary-info, .t-14.t-black--light",
          );
          let role = titleEl ? normalizeText(titleEl.innerText) : null;
          let comp = companyEl ? normalizeText(companyEl.innerText) : null;
          if (comp && comp.toLowerCase().includes("full-time")) {
            comp = comp.replace(/full-time/i, "").trim();
          }
          if (!comp) {
            const text = normalizeText(item.innerText);
            const atMatch = text.match(/at\s+(.{2,80})/i);
            if (atMatch) comp = normalizeText(atMatch[1]).split(/\s+\|\s+/)[0];
          }
          if (role && !jobTitle) jobTitle = role;
          if (comp && !company) company = comp;
          if (jobTitle && company) break;
        }
      }
    }

    // If jobTitle still null, use headline
    if (!jobTitle && headline) jobTitle = headline;
    console.log("[Bitzsol CRM] Job Title:", jobTitle);
    console.log("[Bitzsol CRM] Company:", company);

    // ── 6. Email & Phone ──────────────────────────────────────────────────
    let email = null;
    let phone = null;
    let openedModal = false;

    // Check if modal already open
    const modalExists = !!(
      document.querySelector("#artdeco-modal-outlet") ||
      document.querySelector(".artdeco-modal")
    );

    if (!modalExists) {
      // Find contact info button
      const contactBtn =
        document.querySelector('a[href*="/overlay/contact-info/"]') ||
        document.querySelector('a[href*="contact-info"]') ||
        document.querySelector("#topcard-contact-info-cd") ||
        [...document.querySelectorAll("a, button, span")].find(
          (el) =>
            normalizeText(el.innerText || "").toLowerCase() === "contact info",
        );
      if (contactBtn) {
        contactBtn.click();
        openedModal = true;
        console.log(
          "[Bitzsol CRM] Clicked contact info button, waiting for modal...",
        );
        await waitForElement("#artdeco-modal-outlet, .artdeco-modal", 4000);
      }
    }

    const modal = document.querySelector(
      "#artdeco-modal-outlet, .artdeco-modal, .pv-contact-info",
    );
    if (modal) {
      console.log("[Bitzsol CRM] Modal found, extracting email/phone...");
      // Email
      const emailLinks = modal.querySelectorAll('a[href^="mailto:"]');
      for (const link of emailLinks) {
        const addr = normalizeText(link.href.replace("mailto:", ""));
        if (
          addr.includes("@") &&
          addr.includes(".") &&
          !addr.endsWith("@linkedin.com")
        ) {
          email = addr;
          break;
        }
      }
      if (!email) {
        const text = modal.innerText;
        const match = text.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
        );
        if (match) email = match[0];
      }

      // Phone
      const phoneLinks = modal.querySelectorAll('a[href^="tel:"]');
      for (const link of phoneLinks) {
        const num = normalizeText(link.href.replace("tel:", ""));
        if (num.length > 5) {
          phone = num;
          break;
        }
      }
      if (!phone) {
        const text = modal.innerText;
        const phoneMatch = text.match(/Phone\s*[:|]\s*([+\d\s()-]+)/i);
        if (phoneMatch) phone = phoneMatch[1].trim();
      }
      if (!phone) {
        const regex =
          /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
        const match = modal.innerText.match(regex);
        if (match) phone = match[0];
      }
    } else {
      console.log(
        "[Bitzsol CRM] Modal not found, scanning page for email/phone...",
      );
      const bodyText = document.body.innerText;
      const emailMatch = bodyText.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      );
      if (emailMatch) email = emailMatch[0];
      const phoneRegex =
        /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
      const phoneMatch = bodyText.match(phoneRegex);
      if (phoneMatch) phone = phoneMatch[0];
    }

    // Close modal if we opened it
    if (openedModal) {
      const closeBtn =
        document.querySelector(
          '#artdeco-modal-outlet button[aria-label="Dismiss"]',
        ) ||
        document.querySelector(".artdeco-modal__dismiss") ||
        document.querySelector(
          "#artdeco-modal-outlet [data-test-modal-close-btn]",
        ) ||
        document.querySelector(".artdeco-modal button");
      if (closeBtn) closeBtn.click();
    }

    console.log("[Bitzsol CRM] Email:", email);
    console.log("[Bitzsol CRM] Phone:", phone);

    // Clean up profile URL
    let profileUrl = window.location.href;
    if (profileUrl.includes("/overlay/contact-info")) {
      profileUrl = profileUrl.split("/overlay/contact-info")[0];
    }

    const result = {
      name: name || null,
      headline: headline || null,
      location: location || null,
      company: company || null,
      jobTitle: jobTitle || null,
      email: email || null,
      phone: phone || null,
      profileUrl: profileUrl,
      platform: "LinkedIn",
    };

    console.log("[Bitzsol CRM] Final scraped data:", result);
    return result;
  }

  // ─── Upwork Scraper ──────────────────────────────────────────────────────
  async function scrapeUpwork() {
    console.log("[Bitzsol CRM] Scraping Upwork...");
    const result = {
      name: null,
      headline: null,
      location: null,
      company: null,
      jobTitle: null,
      email: null,
      phone: null,
      platform: "Upwork",
      profileUrl: window.location.href,
    };
    const nameEl = document.querySelector(
      'h1[data-test="freelancer-name"], h1.profile-name, h1',
    );
    if (nameEl) result.name = normalizeText(nameEl.innerText);
    const titleEl = document.querySelector(
      'div[data-test="freelancer-title"], .profile-title',
    );
    if (titleEl) result.headline = normalizeText(titleEl.innerText);
    if (result.headline) result.jobTitle = result.headline;
    const locEl = document.querySelector(
      'span[data-test="location"], .profile-location',
    );
    if (locEl) result.location = normalizeText(locEl.innerText);
    const companyMatch = result.headline?.match(/at\s+(.{2,80})/i);
    if (companyMatch) result.company = normalizeText(companyMatch[1]);
    console.log("[Bitzsol CRM] Upwork data:", result);
    return result;
  }

  // ─── Fiverr Scraper ──────────────────────────────────────────────────────
  async function scrapeFiverr() {
    console.log("[Bitzsol CRM] Scraping Fiverr...");
    const result = {
      name: null,
      headline: null,
      location: null,
      company: null,
      jobTitle: null,
      email: null,
      phone: null,
      platform: "Fiverr",
      profileUrl: window.location.href,
    };
    const nameEl = document.querySelector(
      "h1.seller-name, h1.profile-name, h1",
    );
    if (nameEl) result.name = normalizeText(nameEl.innerText);
    const descEl = document.querySelector(
      "p.seller-description, .profile-description",
    );
    if (descEl) result.headline = normalizeText(descEl.innerText);
    if (result.headline) result.jobTitle = result.headline;
    const locEl = document.querySelector(
      "span.seller-location, .profile-location",
    );
    if (locEl) result.location = normalizeText(locEl.innerText);
    const companyMatch = result.headline?.match(/at\s+(.{2,80})/i);
    if (companyMatch) result.company = normalizeText(companyMatch[1]);
    console.log("[Bitzsol CRM] Fiverr data:", result);
    return result;
  }

  // ─── Main dispatcher ────────────────────────────────────────────────────
  async function scrapePlatform() {
    const url = window.location.href;
    if (url.includes("linkedin.com/in/")) {
      return await scrapeLinkedIn();
    } else if (
      url.includes("upwork.com/freelancers/") ||
      url.includes("upwork.com/fl/")
    ) {
      return await scrapeUpwork();
    } else if (
      url.includes("fiverr.com/") &&
      !url.includes("fiverr.com/support")
    ) {
      return await scrapeFiverr();
    } else {
      return { error: "Unsupported platform" };
    }
  }

  // ─── Message Listener ──────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_PROFILE") {
      scrapePlatform()
        .then((profile) => {
          console.log("[Bitzsol CRM] Sending response:", profile);
          sendResponse(profile);
        })
        .catch((err) => {
          console.error("[Bitzsol CRM] Scrape error:", err);
          sendResponse({ error: err.message });
        });
      return true;
    }

    if (request.action === "GET_PLATFORM") {
      const url = window.location.href;
      let platform = "Other";
      if (url.includes("linkedin.com")) platform = "LinkedIn";
      else if (url.includes("upwork.com")) platform = "Upwork";
      else if (url.includes("fiverr.com")) platform = "Fiverr";
      sendResponse({ platform });
      return true;
    }
  });
}

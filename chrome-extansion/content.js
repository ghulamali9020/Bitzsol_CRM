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

  function normalizeText(value) {
    return (value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function findElement(selectors, container = document) {
    for (const sel of selectors) {
      const el = container.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

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
      } catch (error) {
        // ignore malformed JSON-LD
      }
    }

    return result;
  }

  function extractExperienceData() {
    const containers = [
      document.querySelector('section[id*="experience"]'),
      document.querySelector('section[data-section="experience"]'),
      document.querySelector('section[data-view-name="profile-experience"]'),
      document.querySelector('div[data-section="experience"]'),
      document.querySelector("main"),
    ].filter(Boolean);

    const items = [];

    for (const container of containers) {
      const roleNodes = [
        ...container.querySelectorAll(
          ".pvs-entity, .pv-entity__position-group-role-item, .pv-profile-section__card-item, .pvs-list__paged-list-item, li",
        ),
      ];

      for (const node of roleNodes) {
        const titleEl = node.querySelector(
          "h3 span[aria-hidden='true'], h3 span, .t-16.t-black--bold, .mr1.t-bold, .t-bold",
        );
        const companyEl = node.querySelector(
          ".pv-entity__secondary-title, .pv-entity__company-summary-info a, .pv-entity__company-summary-info, .pv-entity__secondary-title span, .t-14.t-black--light",
        );

        let role = normalizeText(titleEl?.innerText || "");
        let company = normalizeText(companyEl?.innerText || "");
        if (company && company.toLowerCase().includes("full-time")) {
          company = company.replace(/full-time/i, "").trim();
        }

        const text = normalizeText(node.innerText || "");
        if (!role && !company) continue;

        if (!company) {
          const atMatch = text.match(/at\s+(.{2,80})/i);
          if (atMatch) company = normalizeText(atMatch[1]).split(/\s+\|\s+/)[0];
        }

        if (!role) {
          const lines = text
            .split(/\n|•|·/)
            .map((line) => normalizeText(line))
            .filter(Boolean);
          const firstLine = lines[0] || "";
          if (firstLine) role = firstLine.replace(/\s+at\s+.+$/i, "").trim();
        }

        if (role) {
          items.push({ role, company });
          break;
        }
      }
      if (items.length) break;
    }

    return items;
  }

  function extractTopCardValues(topCard) {
    const result = {
      headline: null,
      company: null,
      location: null,
      jobTitle: null,
    };

    if (!topCard) return result;

    const headlineEl = findElement(
      [
        ".text-body-medium.break-words",
        ".pv-text-details__left-panel .text-body-medium",
        "h2.text-body-medium",
        ".pv-top-card--list .text-body-medium",
        ".pv-top-card-v2-section__headline",
      ],
      topCard,
    );
    if (headlineEl) result.headline = normalizeText(headlineEl.innerText || "");

    const companyEl = findElement(
      [
        ".pv-top-card-v2-section__company-name a",
        'a[href*="/company/"]',
        ".pv-top-card__experience-list a",
        ".pv-top-card__experience-list span",
      ],
      topCard,
    );
    if (companyEl) {
      const companyText = normalizeText(
        companyEl.innerText || companyEl.textContent || "",
      );
      if (companyText && !/linkedin/i.test(companyText))
        result.company = companyText;
    }

    const topCardText = normalizeText(topCard.innerText || "");
    const lines = topCardText
      .split("\n")
      .map((line) => normalizeText(line))
      .filter((line) => line && !/^\d+ connections?$/i.test(line));

    if (!result.headline && lines.length > 1) {
      result.headline = lines[1];
    }

    if (!result.location && lines.length > 2) {
      const candidate = lines[lines.length - 1];
      if (
        candidate.includes(",") ||
        /\b(united states|india|uk|canada|germany|france)\b/i.test(candidate)
      ) {
        result.location = candidate;
      }
    }

    const atMatch = topCardText.match(/(.{2,80})\s+at\s+(.{2,80})/i);
    if (atMatch) {
      if (!result.jobTitle) result.jobTitle = normalizeText(atMatch[1]);
      if (!result.company) result.company = normalizeText(atMatch[2]);
    }

    const locationEl = findElement(
      [
        "span.text-body-small.inline.t-black--light.break-words",
        ".pv-top-card__location",
        ".pv-top-card-v2-section__location",
        ".pv-top-card--list .t-black--light",
        ".pv-text-details__left-panel .t-black--light",
        "[data-generated-location]",
        ".text-body-small.inline.t-black--light",
      ],
      topCard,
    );
    if (locationEl && !result.location)
      result.location = normalizeText(
        locationEl.innerText || locationEl.textContent || "",
      );

    return result;
  }

  async function scrapeLinkedInPage() {
    let name = null;
    let headline = null;
    let company = null;
    let jobTitle = null;
    let location = null;
    let experience = null;

    const ldData = extractFromJsonLd();
    name = ldData.name || null;
    headline = ldData.headline || null;
    company = ldData.company || null;
    location = ldData.location || null;

    if (!name) {
      const raw = document.title.split("|")[0]?.trim();
      const titleName = raw && raw.toLowerCase() !== "linkedin" ? raw : null;
      const h1Name = document.querySelector("h1")?.innerText?.trim() || null;
      name = titleName || h1Name || null;
    }

    const topCard = findElement([
      ".pv-top-card",
      ".pv-top-card-v2-section",
      "[data-view-name='profile-topcard']",
      "main",
    ]);

    const topCardValues = extractTopCardValues(topCard);
    headline = headline || topCardValues.headline;
    company = company || topCardValues.company;
    location = location || topCardValues.location;
    jobTitle = jobTitle || topCardValues.jobTitle;

    if (!headline) {
      const headlineSelectors = [
        ".text-body-medium.break-words",
        ".pv-text-details__left-panel .text-body-medium",
        "h2.text-body-medium",
        ".pv-top-card--list .text-body-medium",
        ".pv-top-card-v2-section__headline",
      ];
      const el = findElement(headlineSelectors);
      if (el) headline = normalizeText(el.innerText || "");
      if (!headline) {
        const h1 = document.querySelector("h1");
        if (h1 && h1.parentElement) {
          const siblings = [...h1.parentElement.children];
          const idx = siblings.indexOf(h1);
          for (let i = idx + 1; i < siblings.length; i++) {
            const text = normalizeText(siblings[i]?.innerText || "");
            if (
              text.length > 10 &&
              !text.match(/^[·•]/) &&
              !text.match(/^\d+ connections?$/i)
            ) {
              headline = text;
              break;
            }
          }
        }
      }
    }

    if (!name) {
      const nameEl = document.querySelector("h1.text-heading-xlarge, h1");
      name = normalizeText(nameEl?.innerText || "") || name;
    }

    if (!company || !jobTitle) {
      const experienceItems = extractExperienceData();
      if (experienceItems.length) {
        const first = experienceItems[0];
        jobTitle = jobTitle || first.role || null;
        company = company || first.company || null;
      }
    }

    if (!location) {
      const locationSelectors = [
        ".pv-top-card__location",
        ".pv-top-card-v2-section__location",
        ".pv-top-card--list .t-black--light",
        ".pv-text-details__left-panel .t-black--light",
        ".t-black--light.t-normal",
        '.not-first-middot span[aria-hidden="true"]',
        "[data-generated-location]",
        "span.text-body-small.inline.t-black--light.break-words",
      ];
      const locationEl = findElement(locationSelectors, topCard || document);
      if (locationEl) {
        const value = normalizeText(
          locationEl.innerText || locationEl.textContent || "",
        );
        if (value && value.length > 2 && !value.match(/^\d/)) location = value;
      }
    }

    if (!location) {
      const allText = document.body.innerText || "";
      const lines = allText
        .split("\n")
        .map((line) => normalizeText(line))
        .filter((line) => line.length > 3);

      for (const line of lines) {
        if (
          /^[A-Za-z\s\-]+,\s*[A-Za-z\s]+$/.test(line) &&
          !line.includes("LinkedIn") &&
          !line.includes("Profile")
        ) {
          location = line;
          break;
        }
      }
    }

    if (!company || !jobTitle) {
      const experienceItems = extractExperienceData();
      if (experienceItems.length) {
        const first = experienceItems[0];
        jobTitle = jobTitle || first.role || null;
        company = company || first.company || null;
      }
    }

    if (!experience) {
      const experienceItems = extractExperienceData();
      if (experienceItems.length) {
        experience = experienceItems
          .slice(0, 2)
          .map((item) =>
            item.role && item.company
              ? `${item.role} @ ${item.company}`
              : item.role || item.company || "",
          )
          .filter(Boolean)
          .join(" | ");
      }
    }

    if (!jobTitle && headline) jobTitle = headline;
    if (!headline && jobTitle) headline = jobTitle;

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
          (el) =>
            normalizeText(el.innerText || "").toLowerCase() === "contact info",
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

    const isContactOverlay = window.location.href.includes(
      "/overlay/contact-info/",
    );

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
    }

    const phoneSelectors = [
      '#artdeco-modal-outlet a[href^="tel:"]',
      '.pv-contact-info__contact-type a[href^="tel:"]',
      '.ci-phone a[href^="tel:"]',
      '.pv-contact-info a[href^="tel:"]',
      '.artdeco-modal a[href^="tel:"]',
      'section[class*="contact"] a[href^="tel:"]',
      '.pv-contact-info__contact-item a[href^="tel:"]',
      '.contact-info__phone a[href^="tel:"]',
    ];
    if (isContactOverlay) phoneSelectors.unshift('a[href^="tel:"]');
    for (const sel of phoneSelectors) {
      const link = document.querySelector(sel);
      if (link) {
        const num = normalizeText(link.href.replace("tel:", ""));
        if (num.length > 5) {
          phone = num;
          break;
        }
      }
    }

    if (!phone) {
      const modal = document.querySelector(
        "#artdeco-modal-outlet, .artdeco-modal, .pv-contact-info",
      );
      if (modal) {
        const text = normalizeText(modal.innerText || "");
        const phoneMatch = text.match(/Phone\s*[:|]\s*([+\d\s()-]+)/i);
        if (phoneMatch) {
          phone = phoneMatch[1].trim();
        } else {
          const regex =
            /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
          const match = text.match(regex);
          if (match) phone = match[0];
        }
      }
    }

    if (!phone) {
      const bodyText = normalizeText(document.body.innerText || "");
      const lines = bodyText.split("\n").filter((line) => line.length > 5);
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
        const regex =
          /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/;
        const match = bodyText.match(regex);
        if (match) phone = match[0];
      }
    }

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

    let profileUrl = window.location.href;
    if (profileUrl.includes("/overlay/contact-info")) {
      profileUrl = profileUrl.split("/overlay/contact-info")[0];
    }

    const platform = detectPlatform(profileUrl);

    console.log("[Bitzsol CRM] Scraped data:", {
      name,
      headline,
      location,
      company,
      jobTitle,
      experience,
      email,
      phone,
      profileUrl,
      platform,
    });

    return {
      name,
      headline,
      location,
      company,
      jobTitle,
      experience,
      email,
      phone,
      profileUrl,
      platform,
    };
  }

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

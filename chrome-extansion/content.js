if (!window.__bitzsol_crm_loaded) {
  window.__bitzsol_crm_loaded = true;

  console.log("[Bitzsol CRM] Content script loaded on:", window.location.href);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "GET_PROFILE") return;

    // ── Name ──────────────────────────────────────────────────────────────
    const h1Name = document.querySelector("h1")?.innerText?.trim() || null;

    // document.title is always "Name | LinkedIn" — rock-solid fallback
    const titleName = (() => {
      const raw = document.title.split("|")[0]?.trim();
      return raw && raw.toLowerCase() !== "linkedin" ? raw : null;
    })();

    const name = h1Name || titleName;

    // ── Headline & Location via DOM walking ────────────────────────────────
    // Instead of relying on class names (which LinkedIn changes constantly),
    // we walk siblings of the h1's parent container. The structure is:
    //
    //   <div>           ← intro section
    //     <div>
    //       <h1>Name</h1>
    //       <div>Headline</div>    ← index 1 after h1
    //       <span>Location...</span>
    //     </div>
    //   </div>
    //
    // This is far more stable than class-based selectors.

    const h1 = document.querySelector("h1");
    const introContainer = h1?.closest("div");

    // Collect all direct-child text nodes/elements inside the intro container
    // that come after the h1
    let headline = null;
    let location = null;

    if (introContainer) {
      const children = [...introContainer.children];
      const h1Index = children.indexOf(h1);

      // The element immediately after h1 is the headline
      if (h1Index >= 0 && children[h1Index + 1]) {
        headline = children[h1Index + 1]?.innerText?.trim() || null;
      }

      // Location is typically further down — find a span/div containing
      // a city name (often has a "·" separator or "Connect" nearby)
      for (let i = h1Index + 2; i < children.length; i++) {
        const text = children[i]?.innerText?.trim();
        if (text && text.length < 120) {
          // location lines are short
          location = text.split("·")[0]?.trim() || text;
          break;
        }
      }
    }

    // ── CSS fallbacks (in case DOM walk yields nothing) ────────────────────
    if (!headline) {
      headline =
        document
          .querySelector(".text-body-medium.break-words")
          ?.innerText?.trim() ||
        document.querySelector(".text-body-medium")?.innerText?.trim() ||
        null;
    }

    if (!location) {
      location =
        document
          .querySelector(".not-first-middot span[aria-hidden='true']")
          ?.innerText?.trim() ||
        document
          .querySelector("span.t-black--light.t-normal")
          ?.innerText?.trim()
          ?.split("·")[0]
          ?.trim() ||
        null;
    }

    const profileUrl = window.location.href;
    const profile = { name, headline, location, profileUrl };

    console.log("[Bitzsol CRM] Scraped:", profile);
    // Debug: log raw siblings so we can tune selectors if needed
    if (introContainer) {
      console.log(
        "[Bitzsol CRM] Intro children:",
        [...introContainer.children].map(
          (el, i) =>
            `[${i}] ${el.tagName}: "${el.innerText?.trim()?.slice(0, 60)}"`,
        ),
      );
    }

    sendResponse(profile);
  });
}

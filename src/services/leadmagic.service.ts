/**
 * LeadMagic Service
 * Uses the LeadMagic API to enrich a LinkedIn profile with verified
 * contact details (email and phone number).
 *
 * Docs: https://docs.leadmagic.io
 * Requires LEADMAGIC_API_KEY in environment variables.
 */

import type { ApifyLinkedInProfile } from "@/services/apify.service";

const LEADMAGIC_API_KEY = process.env.LEADMAGIC_API_KEY ?? "";
const LEADMAGIC_BASE_URL = "https://api.leadmagic.io";

export interface LeadMagicEnrichment {
  verifiedEmail: string | null;
  verifiedPhone: string | null;
  company: string | null;
  companyDomain: string | null;
  location: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** POST to LeadMagic's profile-email endpoint to find a verified email. */
async function fetchVerifiedEmail(
  linkedInUrl: string
): Promise<{ email: string | null }> {
  if (!LEADMAGIC_API_KEY) return { email: null };

  try {
    const res = await fetch(`${LEADMAGIC_BASE_URL}/profile-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": LEADMAGIC_API_KEY,
      },
      body: JSON.stringify({ linkedin_url: linkedInUrl }),
    });

    if (!res.ok) return { email: null };

    const json = await res.json();
    // LeadMagic returns { email, ... } or { work_email, ... }
    const email: string | null =
      json?.email ?? json?.work_email ?? null;

    return { email };
  } catch {
    return { email: null };
  }
}

/** POST to LeadMagic's profile-phone endpoint to find a verified phone. */
async function fetchVerifiedPhone(
  linkedInUrl: string
): Promise<{ phone: string | null }> {
  if (!LEADMAGIC_API_KEY) return { phone: null };

  try {
    const res = await fetch(`${LEADMAGIC_BASE_URL}/profile-phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": LEADMAGIC_API_KEY,
      },
      body: JSON.stringify({ linkedin_url: linkedInUrl }),
    });

    if (!res.ok) return { phone: null };

    const json = await res.json();
    const phone: string | null =
      json?.phone ?? json?.phone_number ?? null;

    return { phone };
  } catch {
    return { phone: null };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich a scraped LinkedIn profile with LeadMagic verified contact data.
 * Both email and phone lookups run in parallel for speed.
 *
 * If LEADMAGIC_API_KEY is not set, returns null values without throwing —
 * the CRM service will fall back to whatever Apify provided.
 */
export async function enrichLead(
  profile: ApifyLinkedInProfile
): Promise<LeadMagicEnrichment> {
  const { linkedInUrl, location } = profile;

  if (!linkedInUrl) {
    return {
      verifiedEmail: null,
      verifiedPhone: null,
      company: null,
      companyDomain: null,
      location: location ?? null,
    };
  }

  // Run both lookups in parallel
  const [emailResult, phoneResult] = await Promise.all([
    fetchVerifiedEmail(linkedInUrl),
    fetchVerifiedPhone(linkedInUrl),
  ]);

  return {
    verifiedEmail: emailResult.email,
    verifiedPhone: phoneResult.phone,
    company: null,       // extend when LeadMagic company endpoint is needed
    companyDomain: null,
    location: location ?? null,
  };
}
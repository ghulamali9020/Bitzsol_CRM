/**
 * Apify Service
 * Calls the Apify REST API to scrape a LinkedIn profile.
 * Requires APIFY_TOKEN in environment variables.
 *
 * Actor used: "dev_fusion/linkedin-profile-scraper"
 * You can swap APIFY_ACTOR_ID in your .env to use a different actor.
 */

const APIFY_TOKEN = process.env.APIFY_TOKEN ?? "";
const APIFY_ACTOR_ID =
  process.env.APIFY_ACTOR_ID ?? "dev_fusion/linkedin-profile-scraper";

// How long to wait for the actor run to finish (ms)
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 60_000;

export interface ApifyLinkedInProfile {
  firstName: string;
  lastName: string;
  headline: string | null;         // job title / designation
  linkedInUrl: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Start an actor run and return its run ID. */
async function startRun(linkedInUrl: string): Promise<string> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: linkedInUrl }],
        // Some actors accept a flat array instead — adjust if your actor requires it
        profileUrls: [linkedInUrl],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify run start failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const runId: string = json?.data?.id;
  if (!runId) throw new Error("Apify did not return a run ID.");
  return runId;
}

/** Poll the run until it finishes (SUCCEEDED / FAILED / ABORTED). */
async function waitForRun(runId: string): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!res.ok) throw new Error(`Apify run status check failed (${res.status})`);

    const json = await res.json();
    const status: string = json?.data?.status;

    if (status === "SUCCEEDED") return;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify actor run ended with status: ${status}`);
    }
    // RUNNING / READY — keep waiting
  }

  throw new Error("Apify actor run timed out waiting for completion.");
}

/** Fetch the first item from the run's default dataset. */
async function fetchDatasetItem(runId: string): Promise<Record<string, any>> {
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1`
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed (${res.status})`);

  const items: Record<string, any>[] = await res.json();
  if (!items || items.length === 0) {
    throw new Error("Apify returned no results for this LinkedIn profile.");
  }
  return items[0];
}

/** Normalise the raw Apify item into our typed shape.
 *  Field names differ between actors, so we check common variants. */
function normaliseProfile(raw: Record<string, any>): ApifyLinkedInProfile {
  const firstName: string =
    raw.firstName ?? raw.first_name ?? raw.name?.split(" ")[0] ?? "";
  const lastName: string =
    raw.lastName ?? raw.last_name ?? raw.name?.split(" ").slice(1).join(" ") ?? "";
  const headline: string | null =
    raw.headline ?? raw.title ?? raw.jobTitle ?? raw.occupation ?? null;
  const linkedInUrl: string =
    raw.linkedInUrl ?? raw.url ?? raw.profileUrl ?? raw.linkedin_url ?? "";
  const email: string | null =
    raw.email ?? raw.emailAddress ?? null;
  const phone: string | null =
    raw.phone ?? raw.phoneNumber ?? null;
  const location: string | null =
    raw.location ?? raw.locationName ?? raw.geoLocationName ?? null;
  const summary: string | null =
    raw.summary ?? raw.about ?? raw.description ?? null;

  return { firstName, lastName, headline, linkedInUrl, email, phone, location, summary };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scrape a LinkedIn profile URL via the Apify REST API.
 * Starts a run, waits for it to complete, and returns a normalised profile.
 */
export async function scrapeLinkedIn(
  linkedInUrl: string
): Promise<ApifyLinkedInProfile> {
  if (!APIFY_TOKEN) {
    throw new Error(
      "APIFY_TOKEN is not set. Add it to your .env.local file."
    );
  }

  const runId = await startRun(linkedInUrl);
  await waitForRun(runId);
  const raw = await fetchDatasetItem(runId);
  return normaliseProfile(raw);
}
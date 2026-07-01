import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = process.env.APIFY_LINKEDIN_ACTOR_ID;
const APOLLO_API_URL = process.env.APOLLO_API_URL;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const LEADMAGIC_API_URL = process.env.LEADMAGIC_API_URL;
const LEADMAGIC_API_KEY = process.env.LEADMAGIC_API_KEY;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const profileUrl = body.profileUrl?.trim();
  const service = body.enrichService || body.service || "apify";

  if (!profileUrl) {
    return NextResponse.json(
      { error: "profileUrl is required." },
      { status: 400 },
    );
  }

  try {
    if (service === "apify") {
      if (!APIFY_TOKEN || !APIFY_ACTOR_ID) {
        return NextResponse.json(
          { error: "Apify token or actor ID missing." },
          { status: 400 },
        );
      }

      // 1. Start the run
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs?token=${encodeURIComponent(APIFY_TOKEN)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: profileUrl }],
            maxItems: 1,
          }),
        },
      );
      const runData = await runRes.json();
      if (!runData.data?.defaultDatasetId) {
        return NextResponse.json(
          { error: "Apify run failed to start", details: runData },
          { status: 502 },
        );
      }

      const { defaultDatasetId, id: runId } = runData.data;

      // 2. Poll until finished
      let attempts = 0;
      const maxAttempts = 60;
      let status = "RUNNING";
      while (attempts < maxAttempts && status === "RUNNING") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(APIFY_TOKEN)}`,
        );
        const statusData = await statusRes.json();
        status = statusData.data?.status;
        if (status === "SUCCEEDED") break;
        if (
          status === "FAILED" ||
          status === "ABORTED" ||
          status === "TIMED_OUT"
        ) {
          return NextResponse.json(
            { error: `Apify run ${status}` },
            { status: 502 },
          );
        }
        attempts++;
      }
      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: "Apify run timeout" },
          { status: 504 },
        );
      }

      // 3. Fetch dataset items
      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${encodeURIComponent(APIFY_TOKEN)}`,
      );
      const items = await datasetRes.json();
      const firstItem = items[0] || {};

      // Map to expected schema
      const enriched = {
        name: firstItem.name || firstItem.fullName,
        headline: firstItem.headline || firstItem.jobTitle,
        company: firstItem.companyName || firstItem.employer,
        location: firstItem.location,
        about: firstItem.summary || firstItem.about,
        emails: firstItem.emails || [],
        phones: firstItem.phones || [],
      };

      return NextResponse.json({ data: enriched, source: "apify" });
    }

    if (service === "apollo") {
      if (!APOLLO_API_URL || !APOLLO_API_KEY) {
        return NextResponse.json(
          { error: "Apollo URL or API key missing." },
          { status: 400 },
        );
      }

      // Apollo expects X-API-Key header and person.linkedin_url
      const enrichRes = await fetch(APOLLO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify({ person: { linkedin_url: profileUrl } }),
      });

      if (!enrichRes.ok) {
        return NextResponse.json(
          { error: `Apollo error: ${enrichRes.statusText}` },
          { status: enrichRes.status },
        );
      }
      const enrichData = await enrichRes.json();
      const person = enrichData.person || {};

      const enriched = {
        name: person.name,
        headline: person.title,
        company: person.organization?.name,
        location: person.location,
        about: person.bio,
        emails: person.email ? [person.email] : [],
        phones: person.phone_number ? [person.phone_number] : [],
      };

      return NextResponse.json({ data: enriched, source: "apollo" });
    }

    if (service === "leadmagic") {
      if (!LEADMAGIC_API_URL || !LEADMAGIC_API_KEY) {
        return NextResponse.json(
          { error: "LeadMagic URL or API key missing." },
          { status: 400 },
        );
      }

      const enrichRes = await fetch(LEADMAGIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LEADMAGIC_API_KEY}`,
        },
        body: JSON.stringify({ linkedinUrl: profileUrl }),
      });

      if (!enrichRes.ok) {
        return NextResponse.json(
          { error: `LeadMagic error: ${enrichRes.statusText}` },
          { status: enrichRes.status },
        );
      }
      const enrichData = await enrichRes.json();
      const lead = enrichData.data || enrichData;

      const enriched = {
        name: lead.fullName || lead.name,
        headline: lead.title,
        company: lead.company,
        location: lead.location,
        about: lead.bio,
        emails: lead.email ? [lead.email] : [],
        phones: lead.phone ? [lead.phone] : [],
      };

      return NextResponse.json({ data: enriched, source: "leadmagic" });
    }

    return NextResponse.json(
      { error: "Unknown enrichment service." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[ENRICHMENT]", error);
    return NextResponse.json(
      { error: "Enrichment request failed." },
      { status: 500 },
    );
  }
}

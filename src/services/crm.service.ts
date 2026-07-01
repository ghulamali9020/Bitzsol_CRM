/**
 * CRM Service
 * Business-logic layer for persisting leads in the database.
 */

import { prisma } from "@/lib/prisma";
import type { ApifyLinkedInProfile } from "@/services/apify.service";
import type { LeadMagicEnrichment } from "@/services/leadmagic.service";

export type CreateLeadInput = ApifyLinkedInProfile & LeadMagicEnrichment & {
  pipelineId: string;
  createdById: string;
  company?: string | null;
  leadSource?: string | null;
};

/**
 * Create a Lead record from a merged Apify + LeadMagic payload.
 * Called from the route as: createLead({ ...profile, ...enriched })
 *
 * Note: pipelineId and createdById must be present in the merged object.
 */
export async function createLead(input: CreateLeadInput) {
  const {
    firstName,
    lastName,
    headline,
    linkedInUrl,
    email,
    phone,
    summary,
    pipelineId,
    createdById,
    // LeadMagic enrichment fields
    verifiedEmail,
    verifiedPhone,
    company,
    leadSource,
  } = input;

  if (!firstName?.trim()) {
    throw new Error("LinkedIn profile did not return a first name.");
  }

  if (!pipelineId) {
    throw new Error("pipelineId is required to create a lead.");
  }

  // Verify pipeline exists
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);

  // Prefer LeadMagic verified contact details over Apify scraped ones
  const resolvedEmail = verifiedEmail ?? email ?? null;
  const resolvedPhone = verifiedPhone ?? phone ?? null;

  // Resolve lead source: use provided leadSource, else infer from URL, else default "LinkedIn"
  const resolvedLeadSource = leadSource?.trim() ||
    (linkedInUrl?.includes("upwork.com") ? "Upwork" :
     linkedInUrl?.includes("fiverr.com") ? "Fiverr" :
     "LinkedIn");

  const lead = await prisma.lead.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      designation: headline?.trim() || null,
      leadSource: resolvedLeadSource,
      sourceLink: linkedInUrl?.trim() || null,
      remarks: summary?.trim() || null,
      status: "New",
      pipelineId,
      createdById,
      tags: [],
      emails: resolvedEmail
        ? { create: [{ email: resolvedEmail.trim(), status: verifiedEmail ? "Verified" : "Not_Verified" }] }
        : undefined,
      phones: resolvedPhone
        ? { create: [{ phone: resolvedPhone.trim(), status: verifiedPhone ? "Verified" : "Not_Verified" }] }
        : undefined,
      customFields: company?.trim()
        ? { create: [{ key: "Company", value: company.trim() }] }
        : undefined,
    },
    include: {
      pipeline: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      emails: true,
      phones: true,
      customFields: true,
    },
  });

  return lead;
}

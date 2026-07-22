import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/leads/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        emails: true,
        phones: true,
        customFields: true,
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    // BD can only see their own
    if (session.role === "business_developer" && lead.createdById !== session.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const companyField = lead.customFields.find(
      (cf) => cf.key.toLowerCase() === "company"
    );
    const headlineField = lead.customFields.find(
      (cf) => cf.key.toLowerCase() === "headline"
    );
    const mappedLead = {
      ...lead,
      jobTitle: lead.designation || undefined,
      company: companyField?.value || undefined,
      headline: headlineField?.value || undefined,
    };

    return NextResponse.json({ data: mappedLead });
  } catch (err) {
    console.error("[GET /api/leads/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// PATCH /api/leads/[id] — BD can edit own leads; Admin can edit all
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    if (session.role === "business_developer" && existing.createdById !== session.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const {
      firstName, middleName, lastName, date, designation,
      jobTitle, company, headline,
      leadSource, sourceLink, remarks, status,
      emails, phones, customFields, tags,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (middleName !== undefined) updateData.middleName = middleName?.trim() || null;
    if (lastName !== undefined) updateData.lastName = lastName?.trim() || null;
    if (date !== undefined) updateData.date = new Date(date);
    
    if (designation !== undefined) updateData.designation = designation?.trim() || null;
    else if (jobTitle !== undefined) updateData.designation = jobTitle?.trim() || null;

    if (leadSource !== undefined) updateData.leadSource = leadSource;
    if (sourceLink !== undefined) updateData.sourceLink = sourceLink?.trim() || null;
    if (remarks !== undefined) updateData.remarks = remarks?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags;

    // Replace emails/phones/customFields if provided
    if (emails !== undefined) {
      await prisma.leadEmail.deleteMany({ where: { leadId: id } });
      updateData.emails = {
        create: emails.map((e: { email: string; status: string }) => ({
          email: e.email,
          status: e.status === "Verified" ? "Verified" : "Not_Verified",
        })),
      };
    }
    if (phones !== undefined) {
      await prisma.leadPhone.deleteMany({ where: { leadId: id } });
      updateData.phones = {
        create: phones.map((p: { phone: string; status: string }) => ({
          phone: p.phone,
          status: p.status === "Verified" ? "Verified" : "Not_Verified",
        })),
      };
    }

    if (customFields !== undefined || company !== undefined || headline !== undefined) {
      let finalFields = customFields;
      if (finalFields === undefined) {
        const currentFields = await prisma.leadCustomField.findMany({ where: { leadId: id } });
        finalFields = currentFields.map(f => ({ key: f.key, value: f.value }));
      }

      finalFields = finalFields.filter(
        (f: any) => f.key.toLowerCase() !== "company" && f.key.toLowerCase() !== "headline",
      );

      if (company !== undefined && company !== null) {
        if (company.trim()) {
          finalFields.push({ key: "Company", value: company.trim() });
        }
      } else {
        if (customFields === undefined) {
          const existingCompany = await prisma.leadCustomField.findFirst({
            where: { leadId: id, key: { equals: "Company", mode: "insensitive" } }
          });
          if (existingCompany) {
            finalFields.push({ key: "Company", value: existingCompany.value });
          }
        }
      }

      if (headline !== undefined && headline !== null) {
        if (headline.trim()) {
          finalFields.push({ key: "Headline", value: headline.trim() });
        }
      } else {
        if (customFields === undefined) {
          const existingHeadline = await prisma.leadCustomField.findFirst({
            where: { leadId: id, key: { equals: "Headline", mode: "insensitive" } }
          });
          if (existingHeadline) {
            finalFields.push({ key: "Headline", value: existingHeadline.value });
          }
        }
      }

      await prisma.leadCustomField.deleteMany({ where: { leadId: id } });
      updateData.customFields = {
        create: finalFields.map((f: { key: string; value: string }) => ({
          key: f.key,
          value: f.value,
        })),
      };
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        emails: true,
        phones: true,
        customFields: true,
      },
    });

    const companyField = lead.customFields.find(
      (cf) => cf.key.toLowerCase() === "company"
    );
    const headlineField = lead.customFields.find(
      (cf) => cf.key.toLowerCase() === "headline"
    );
    const mappedLead = {
      ...lead,
      jobTitle: lead.designation || undefined,
      company: companyField?.value || undefined,
      headline: headlineField?.value || undefined,
    };

    return NextResponse.json({ data: mappedLead, message: "Lead updated." });
  } catch (err: any) {
    console.error("[PATCH /api/leads/[id]]", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/leads/[id] — Admin only
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Only admins can delete leads." }, { status: 403 });

    const { id } = await params;
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ message: "Lead deleted." });
  } catch (err) {
    console.error("[DELETE /api/leads/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

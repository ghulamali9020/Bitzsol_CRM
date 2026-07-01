import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendDiscordNotification, formatDiscordLeadCreated } from "@/lib/discord";

// GET /api/leads — Admin: all leads; BD: own leads only
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipelineId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = searchParams.get("limit") || "10";
    const isAll = limitParam === "all";
    const limit = parseInt(limitParam, 10);

    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where: Record<string, any> = {};

    // BDs only see their own leads
    if (session.role === "business_developer") {
      where.createdById = session.id;
    }

    if (pipelineId) where.pipelineId = pipelineId;
    if (status && status !== "All") where.status = status;
    if (search) {
      const cleanSearch = search.trim();
      where.OR = [
        { firstName: { contains: cleanSearch, mode: "insensitive" } },
        { middleName: { contains: cleanSearch, mode: "insensitive" } },
        { lastName: { contains: cleanSearch, mode: "insensitive" } },
        { designation: { contains: cleanSearch, mode: "insensitive" } },
        { tags: { has: cleanSearch } },
        { tags: { has: cleanSearch.startsWith("#") ? cleanSearch : `#${cleanSearch}` } },
      ];
    }

    // Determine orderBy
    let orderBy: Record<string, any> = { createdAt: sortOrder };
    if (sortField === "name") {
      orderBy = { firstName: sortOrder };
    } else if (sortField === "date") {
      orderBy = { date: sortOrder };
    } else if (sortField === "status") {
      orderBy = { status: sortOrder };
    } else if (sortField === "source") {
      orderBy = { leadSource: sortOrder };
    }

    // Count query
    const total = await prisma.lead.count({ where });

    const leads = await prisma.lead.findMany({
      where,
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        emails: true,
        phones: true,
        customFields: true,
      },
      orderBy,
      ...(isAll ? {} : {
        skip: (page - 1) * limit,
        take: limit,
      }),
    });

    const mappedLeads = leads.map((lead) => {
      const companyField = lead.customFields.find(
        (cf) => cf.key.toLowerCase() === "company"
      );
      return {
        ...lead,
        jobTitle: lead.designation || undefined,
        company: companyField?.value || undefined,
      };
    });

    return NextResponse.json({
      data: mappedLeads,
      pagination: isAll ? null : {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[GET /api/leads]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/leads — Authenticated users (both Admin and BD can create)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const {
      firstName, middleName, lastName, date, designation,
      jobTitle, company,
      leadSource, sourceLink, remarks, status,
      pipelineId, emails, phones, customFields, tags,
    } = body;

    if (!firstName?.trim() || !pipelineId) {
      return NextResponse.json({ error: "First name and pipeline are required." }, { status: 400 });
    }

    // Verify pipeline exists
    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });
    }

    const createdById = session.id;

    const lead = await prisma.lead.create({
      data: {
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName?.trim() || null,
        date: date ? new Date(date) : new Date(),
        designation: designation?.trim() || jobTitle?.trim() || null,
        leadSource: leadSource || "Other",
        sourceLink: sourceLink?.trim() || null,
        remarks: remarks?.trim() || null,
        status: status || "New",
        pipelineId,
        createdById,
        tags: tags ?? [],
        emails: {
          create: (emails ?? []).map((e: { email: string; status: string }) => ({
            email: e.email,
            status: e.status === "Verified" ? "Verified" : "Not_Verified",
          })),
        },
        phones: {
          create: (phones ?? []).map((p: { phone: string; status: string }) => ({
            phone: p.phone,
            status: p.status === "Verified" ? "Verified" : "Not_Verified",
          })),
        },
        customFields: {
          create: [
            ...(customFields ?? []).map((f: { key: string; value: string }) => ({
              key: f.key,
              value: f.value,
            })),
            ...(company?.trim() ? [{ key: "Company", value: company.trim() }] : []),
          ],
        },
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        emails: true,
        phones: true,
        customFields: true,
      },
    });

    // Fire Discord webhook
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
    sendDiscordNotification(formatDiscordLeadCreated(fullName, session.name, pipeline.name));

    return NextResponse.json({ data: lead, message: "Lead created." }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/leads]", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

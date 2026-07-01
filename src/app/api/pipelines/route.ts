import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/pipelines — All authenticated users
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const pipelines = await prisma.pipeline.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: pipelines });
  } catch (err) {
    console.error("[GET /api/pipelines]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/pipelines — Admin only
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Only admins can create pipelines." }, { status: 403 });

    const { name, description } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Pipeline name is required." }, { status: 400 });
    }

    const createdById = session.id;

    const pipeline = await prisma.pipeline.create({
      data: { name: name.trim(), description: description?.trim() || null, createdById },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { leads: true } },
      },
    });

    return NextResponse.json({ data: pipeline, message: "Pipeline created." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/pipelines]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

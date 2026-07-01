import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/pipelines/[id] — Admin only
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Only admins can delete pipelines." }, { status: 403 });

    const { id } = await params;
    await prisma.pipeline.delete({ where: { id } });
    return NextResponse.json({ message: "Pipeline deleted." });
  } catch (err) {
    console.error("[DELETE /api/pipelines/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// PATCH /api/pipelines/[id] — Admin only
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Only admins can edit pipelines." }, { status: 403 });

    const { id } = await params;
    const { name, description } = await req.json();

    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: { name: name?.trim(), description: description?.trim() || null },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { leads: true } },
      },
    });

    return NextResponse.json({ data: pipeline, message: "Pipeline updated." });
  } catch (err) {
    console.error("[PATCH /api/pipelines/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/users/[id] — Admin only: edit or toggle status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { name, email, password, role, status, image } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (password) updateData.password = await bcrypt.hash(password, 12);
    if (image !== undefined) updateData.image = image;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, image: true },
    });

    return NextResponse.json({ data: user, message: "User updated." });
  } catch (err) {
    console.error("[PATCH /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Admin only
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const { id } = await params;

    if (id === session.id) {
      return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted." });
  } catch (err) {
    console.error("[DELETE /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

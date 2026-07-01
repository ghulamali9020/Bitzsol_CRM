import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/users — Admin only: list all users
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        image: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// POST /api/users — Admin only: create user
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const { name, email, password, role, image } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const normalizedRole =
      role === "admin"
        ? "admin"
        : role === "finance_admin"
          ? "finance_admin"
          : role === "finance_member"
            ? "finance_member"
            : "business_developer";

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: normalizedRole,
        status: "active",
        image: image || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        image: true,
      },
    });

    return NextResponse.json(
      { data: user, message: "User created." },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

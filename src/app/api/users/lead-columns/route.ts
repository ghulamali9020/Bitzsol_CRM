import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/users/lead-columns — this user's saved Leads table column visibility
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { leadColumnPrefs: true },
    });

    return NextResponse.json({ data: user?.leadColumnPrefs ?? null });
  } catch (err) {
    console.error("[GET /api/users/lead-columns]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// PATCH /api/users/lead-columns — save this user's Leads table column visibility.
// Personal to the signed-in user: it never affects what other users see.
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { columns } = await req.json();
    if (!columns || typeof columns !== "object") {
      return NextResponse.json({ error: "columns object is required." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { leadColumnPrefs: columns },
    });

    return NextResponse.json({ message: "Column preferences saved." });
  } catch (err) {
    console.error("[PATCH /api/users/lead-columns]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

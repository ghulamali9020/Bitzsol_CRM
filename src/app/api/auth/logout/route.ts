import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendDiscordNotification, formatDiscordLogin } from "@/lib/discord";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session) {
      sendDiscordNotification(formatDiscordLogin(session.name, session.email, "logout"));
    }
    const response = NextResponse.json({ message: "Logged out successfully." });
    response.cookies.set("crm_session", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ data: null }, { status: 401 });
    }
    return NextResponse.json({ data: session });
  } catch (err) {
    console.error("[GET /api/auth/logout]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

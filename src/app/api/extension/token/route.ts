import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ data: { token: signToken(session) } });
}

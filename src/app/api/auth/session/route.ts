import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null }, { status: 401 });
  }

  // Direct session return with no database queries
  return NextResponse.json({ data: session });
}


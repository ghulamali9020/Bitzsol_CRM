import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const whereClause: any = { id };
  if (
    session.role === "business_developer" ||
    session.role === "finance_member"
  ) {
    whereClause.createdById = session.id;
  }

  const { invoice_url } = await req.json();
  const transaction = await prisma.transaction.update({
    where: whereClause,
    data: { invoice_url },
  });
  return NextResponse.json(transaction);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const whereClause: any = { id };
  if (
    session.role === "business_developer" ||
    session.role === "finance_member"
  ) {
    whereClause.createdById = session.id;
  }

  await prisma.transaction.delete({
    where: whereClause,
  });
  return NextResponse.json({ success: true });
}

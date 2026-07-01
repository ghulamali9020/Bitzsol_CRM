import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const sortField = searchParams.get("sortField") || "date";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const type = searchParams.get("type") as "income" | "expense" | null;
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate")!)
    : undefined;
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate")!)
    : undefined;

  const where: any = {};

  if (
    session.role === "business_developer" ||
    session.role === "finance_member"
  ) {
    where.createdById = session.id;
  }

  if (category && category !== "All") where.category = category;
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }
  if (startDate) where.date = { gte: startDate };
  if (endDate) where.date = { ...where.date, lte: endDate };

  const statsWhere = { ...where };

  if (type) where.type = type;

  const [transactions, total, incomeAggregate, expenseAggregate] =
    await Promise.all([
      prisma.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortField]: sortOrder },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...statsWhere, type: "income" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...statsWhere, type: "expense" },
        _sum: { amount: true },
      }),
    ]);

  const totalIncome = incomeAggregate._sum.amount || 0;
  const totalExpense = Math.abs(expenseAggregate._sum.amount || 0);

  return NextResponse.json({
    data: transactions,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    stats: {
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, description, amount, category } = await req.json();
  if (!type || !description || !amount || !category)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (session.role === "business_developer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      date: new Date(),
      type,
      description,
      amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
      category,
      createdById: session.id,
    },
  });
  return NextResponse.json(transaction, { status: 201 });
}

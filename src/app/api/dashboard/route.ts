import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const baseWhere = session.role === "business_developer"
      ? { createdById: session.id }
      : {};

    const [totalLeads, leadsThisWeek, leadsThisMonth, leadsThisYear, leadsByStatusRaw] = await Promise.all([
      prisma.lead.count({ where: baseWhere }),
      prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: startOfWeek } } }),
      prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: startOfYear } } }),
      prisma.lead.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: true,
      }),
    ]);

    const leadsByStatus = leadsByStatusRaw.map((r: { status: string; _count: number }) => ({ status: r.status, _count: r._count }));

    const stats: Record<string, unknown> = {
      totalLeads,
      leadsThisWeek,
      leadsThisMonth,
      leadsThisYear,
      leadsByStatus,
    };

    // Admin-only: per-user stats
    if (session.role === "admin") {
      const users = await prisma.user.findMany({
        where: { role: "business_developer", status: "active" },
        select: { id: true, name: true, email: true },
      });

      const perUserStats = await Promise.all(
        users.map(async (u: { id: string; name: string; email: string }) => {
          const [userTotal, userMonth, userByStatus] = await Promise.all([
            prisma.lead.count({ where: { createdById: u.id } }),
            prisma.lead.count({ where: { createdById: u.id, createdAt: { gte: startOfMonth } } }),
            prisma.lead.groupBy({
              by: ["status"],
              where: { createdById: u.id },
              _count: true,
            }),
          ]);
          return {
            userId: u.id,
            userName: u.name,
            userEmail: u.email,
            totalLeads: userTotal,
            leadsThisMonth: userMonth,
            leadsByStatus: userByStatus.map((r: { status: string; _count: number }) => ({ status: r.status, _count: r._count })),
          };
        })
      );

      stats.perUserStats = perUserStats;
    }

    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

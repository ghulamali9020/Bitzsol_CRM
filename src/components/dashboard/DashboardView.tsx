"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Layers,
  Plus,
  Award,
  Calendar,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import type { AuthUser, DashboardStats, Lead, Pipeline } from "@/types";
import { LeadModal } from "@/components/leads/LeadModal";

interface Props {
  user: AuthUser | null;
  stats: DashboardStats | null;
  leads: Lead[];
  pipelines: Pipeline[];
  onLeadCreated: () => void;
}

export function DashboardView({
  user,
  stats,
  leads,
  pipelines,
  onLeadCreated,
}: Props) {
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">(
    "month",
  );
  const [showExtensionDetails, setShowExtensionDetails] = useState(false);

  const leadsCount =
    timeframe === "week"
      ? stats?.leadsThisWeek
      : timeframe === "month"
        ? stats?.leadsThisMonth
        : stats?.leadsThisYear;

  const recentLeads = leads.slice(0, 6);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ─── Top Action Row ─── */}
      <div className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-crm-text-sub text-sm">
            <span className="text-crm-text-main font-bold">{user?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe switcher */}
          <div className="flex bg-crm-panel border border-crm-border rounded-xl p-1">
            {(["week", "month", "year"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${timeframe === t
                  ? "bg-[#0164DA] text-white"
                  : "text-crm-text-sub hover:text-crm-text-main"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateLead(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0164DA] hover:opacity-90 hover:shadow-xl active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-[#0164DA]/20 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>

          {/* Toggle button for extension instructions */}
          <button
            onClick={() => setShowExtensionDetails(!showExtensionDetails)}
            className="flex items-center gap-1.5 px-3 py-2 bg-crm-panel border border-crm-border rounded-xl text-xs font-medium text-crm-text-sub hover:text-crm-text-main hover:border-crm-primary/40 transition-all"
            title="Show/hide LinkedIn extension guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Extension Guide</span>
            <span className="inline xs:hidden">Guide</span>
          </button>
        </div>
      </div>

      {/* ─── Bitzsol CRM LinkedIn Lead Capture Section (collapsible, at the top) ─── */}
      {showExtensionDetails && (
        <div className="glass p-4 sm:p-6 rounded-2xl shadow-md border border-crm-border/30">
          <h3 className="text-sm sm:text-base font-bold text-crm-text-main">
            Bitzsol CRM LinkedIn Lead Capture
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-crm-text-sub max-w-2xl">
            Use the Chrome extension to capture LinkedIn profile details and
            sync leads directly into Bitzsol CRM. Open a LinkedIn profile first,
            then use the extension popup to extract and send contact data.
          </p>
          <ol className="mt-3 space-y-2 text-xs sm:text-sm text-crm-text-sub list-decimal list-inside">
            <li>Open a LinkedIn profile page in Chrome.</li>
            <li>Click the Bitzsol CRM extension icon to open the popup.</li>
            <li>
              Use Copy Profile URL, Extract Profile Data, then Sync to CRM.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-crm-text-sub">
            Note: the extension popup is separate from the CRM website. The auth
            token is generated from <code>/api/extension/token</code> while
            logged into CRM.
          </p>
        </div>
      )}

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard
          index={0}
          label="Total Leads"
          value={stats?.totalLeads ?? 0}
          icon={FileText}
          color="#0164DA"
          trend={stats && stats.totalLeads > 0 ? "up" : undefined}
        />
        <StatCard
          index={1}
          label={`Leads / ${timeframe}`}
          value={leadsCount ?? 0}
          icon={TrendingUp}
          color="#03D9AF"
          trend={leadsCount && leadsCount > 0 ? "up" : undefined}
        />
        <StatCard
          index={2}
          label="Pipelines"
          value={pipelines.length}
          icon={Layers}
          color="#FB66BC"
        />
        <StatCard
          index={3}
          label="Active Statuses"
          value={stats?.leadsByStatus.length ?? 0}
          icon={Users}
          color="#F59E0B"
          subtitle="distinct statuses"
        />
      </div>

      {/* ─── Leads by Status ─── */}
      {stats && stats.leadsByStatus.length > 0 && (
        <div className="animate-fade-in-up glass p-4 sm:p-6 rounded-2xl shadow-md border border-crm-border/30" style={{ animationDelay: "120ms" }}>
          <h3 className="text-sm sm:text-base font-bold mb-4 text-crm-text-main">
            Leads by Status
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {stats.leadsByStatus.map((s, i) => (
              <div
                key={s.status}
                style={{ "--stagger-delay": `${i * 40}ms` } as React.CSSProperties}
                className="stagger-item animate-fade-in-up card-hover glass rounded-xl p-3 sm:p-4 flex flex-col gap-1 transition-all duration-300"
              >
                <p className="text-xs sm:text-sm text-crm-text-sub truncate">{s.status}</p>
                <p className="text-xl sm:text-2xl font-black text-crm-text-main">{s._count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Leads ─── */}
      <div className="animate-fade-in-up glass p-4 sm:p-6 rounded-2xl shadow-md border border-crm-border/30" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="text-sm sm:text-base font-bold text-crm-text-main">
            Recent Leads
          </h3>
          <span className="text-xs text-crm-text-sub bg-crm-panel-hover border border-crm-border px-2.5 py-1 rounded-lg font-bold">
            {stats?.totalLeads ?? 0} total
          </span>
        </div>

        {recentLeads.length === 0 ? (
          <EmptyState
            message={
              user?.role === "business_developer"
                ? "You haven't created any leads yet."
                : "No leads in the system yet."
            }
            action="Add your first lead using the button above."
          />
        ) : (
          <>
            {/* Desktop Table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-crm-border text-xs font-bold text-crm-text-sub uppercase tracking-widest">
                    <th className="pb-3 text-left">Name</th>
                    <th className="pb-3 text-left hidden md:table-cell">
                      Pipeline
                    </th>
                    <th className="pb-3 text-left hidden lg:table-cell">
                      Source
                    </th>
                    <th className="pb-3 text-left">Status</th>
                    <th className="pb-3 text-left hidden xl:table-cell">
                      Created By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/40">
                  {recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-crm-panel-hover/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-crm-panel-hover border border-crm-border flex items-center justify-center text-[#0164DA] font-bold text-xs shrink-0">
                            {lead.firstName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-crm-text-main truncate">
                              {[lead.firstName, lead.middleName, lead.lastName]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                            {lead.designation && (
                              <p className="text-xs text-crm-text-sub truncate">
                                {lead.designation}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-crm-text-sub hidden md:table-cell">
                        {lead.pipeline?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-crm-text-sub hidden lg:table-cell">
                        {lead.leadSource}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="py-3 text-xs text-crm-text-sub hidden xl:table-cell">
                        {lead.createdBy?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards — shown only on small screens */}
            <div className="sm:hidden space-y-2">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-start gap-3 p-3 rounded-xl glass hover:shadow-md transition-all duration-300"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0164DA]/10 border border-[#0164DA]/20 flex items-center justify-center text-[#0164DA] font-bold text-xs shrink-0">
                    {lead.firstName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-crm-text-main truncate">
                      {[lead.firstName, lead.middleName, lead.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    {lead.designation && (
                      <p className="text-xs text-crm-text-sub">{lead.designation}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StatusBadge status={lead.status} />
                      {lead.pipeline?.name && (
                        <span className="text-[0.72rem] text-crm-text-sub bg-crm-panel border border-crm-border px-1.5 py-0.5 rounded-md">
                          {lead.pipeline.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-crm-text-sub shrink-0 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(
                      lead.date ?? lead.createdAt ?? "",
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Admin BD Breakdown ─── */}
      {user?.role === "admin" &&
        stats?.perUserStats &&
        stats.perUserStats.length > 0 && (
          <div className="animate-fade-in-up glass p-4 sm:p-6 rounded-2xl shadow-md border border-crm-border/30" style={{ animationDelay: "240ms" }}>
            <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-5">
              <Award className="w-5 h-5 text-[#03D9AF] shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-crm-text-main">
                Business Developer Breakdown
              </h3>
              <span className="ml-auto text-xs font-bold text-[#03D9AF] bg-[#03D9AF]/10 px-2 py-0.5 rounded-full border border-[#03D9AF]/20">
                Admin Only
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {stats.perUserStats.map((dev, i) => (
                <div
                  key={dev.userId}
                  style={{ "--stagger-delay": `${i * 60}ms` } as React.CSSProperties}
                  className="stagger-item animate-fade-in-up card-hover glass p-4 rounded-xl hover:border-[#0164DA]/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl premium-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {dev.userName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-crm-text-main truncate">{dev.userName}</p>
                      <p className="text-xs text-crm-text-sub">#{i + 1} BD</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#03D9AF] ml-auto shrink-0" />
                  </div>
                  <div className="space-y-1.5 text-xs border-t border-crm-border/50 pt-3">
                    <div className="flex justify-between">
                      <span className="text-crm-text-sub">Total Leads</span>
                      <span className="font-bold text-crm-text-main">
                        {dev.totalLeads}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-crm-text-sub">This Month</span>
                      <span className="font-bold text-[#03D9AF]">
                        {dev.leadsThisMonth}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-crm-text-sub">Statuses</span>
                      <span className="font-bold text-[#0164DA]">
                        {dev.leadsByStatus.length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {showCreateLead && (
        <LeadModal
          pipelines={pipelines}
          onClose={() => setShowCreateLead(false)}
          onSaved={() => {
            setShowCreateLead(false);
            onLeadCreated();
          }}
        />
      )}
    </div>
  );
}

/* ─── Sub-components (unchanged) ─── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  subtitle,
  index = 0,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down";
  subtitle?: string;
  index?: number;
}) {
  return (
    <div
      style={{ "--stagger-delay": `${index * 80}ms` } as React.CSSProperties}
      className="stagger-item animate-fade-in-up card-hover group glass p-4 sm:p-5 rounded-2xl shadow-md border border-crm-border/30 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <span className="text-xs sm:text-sm font-bold text-crm-text-sub uppercase tracking-wider leading-tight pr-1">
          {label}
        </span>
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-crm-text-main leading-none">
        {value.toLocaleString()}
      </p>
      {subtitle && <p className="text-xs text-crm-text-sub mt-1">{subtitle}</p>}
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend === "up" ? (
            <TrendingUp className="w-3 h-3 text-[#03D9AF]" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span
            className={`text-xs font-bold ${trend === "up" ? "text-[#03D9AF]" : "text-red-400"
              }`}
          >
            Active
          </span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    New: "bg-[#0164DA]/10 text-[#0164DA] border-[#0164DA]/20",
    Contacted: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
    Qualified: "bg-[#03D9AF]/10 text-[#03D9AF] border-[#03D9AF]/20",
    Closed: "bg-green-500/10 text-green-400 border-green-500/20",
    Lost: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const cls =
    colorMap[status] ??
    "bg-crm-panel-hover text-crm-text-sub border-crm-border";
  return (
    <span className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function EmptyState({ message, action }: { message: string; action: string }) {
  return (
    <div className="text-center py-10 sm:py-12">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-crm-panel-hover border border-crm-border flex items-center justify-center mx-auto mb-3 sm:mb-4">
        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-crm-text-sub" />
      </div>
      <p className="text-sm font-bold text-crm-text-main mb-1">{message}</p>
      <p className="text-xs text-crm-text-sub">{action}</p>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import type {
  AuthUser,
  DashboardStats,
  Lead,
  Pipeline,
  ActiveTab,
} from "@/types"; // ✅ import ActiveTab
import { AuthGate } from "@/components/auth/AuthGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { LeadsView } from "@/components/leads/LeadsView";
import { PipelinesView } from "@/components/pipelines/PipelinesView";
import { UsersView } from "@/components/users/UsersView";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { FinanceView } from "@/components/finance/Finance";

function getVisibleTabs(role?: string): ActiveTab[] {
  if (role === "finance_admin" || role === "finance_member") {
    return ["Finance"];
  }

  const tabs: ActiveTab[] = ["Dashboard"];

  if (role === "admin" || role === "business_developer") {
    tabs.push("Leads", "Pipelines");
  }

  if (role === "admin") {
    tabs.push("Finance", "Users");
  }

  return tabs;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const visibleTabs = getVisibleTabs(user?.role);
  const isFinanceRole =
    user?.role === "finance_admin" || user?.role === "finance_member";

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) setUser(res.data);
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, user, visibleTabs]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "finance_admin" || user.role === "finance_member") {
      setActiveTab("Finance");
    }
  }, [user]);

  async function fetchAll() {
    const [statsRes, leadsRes, pipelinesRes] = await Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/leads?limit=6").then((r) => r.json()),
      fetch("/api/pipelines").then((r) => r.json()),
    ]);
    if (statsRes.data) setStats(statsRes.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (pipelinesRes.data) setPipelines(pipelinesRes.data);
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStats(null);
    setLeads([]);
    setPipelines([]);
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen crm-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-2xl bg-[#0164DA]/40 blur-lg animate-glow-pulse" />
            <div className="relative w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center text-white font-black text-xl">
              B
            </div>
          </div>
          <p className="text-crm-text-sub text-sm font-semibold">
            Loading Bitzsol...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen crm-app-bg text-crm-text-main font-sans relative">
      {/* Ambient drifting brand-color blobs behind the whole app shell */}
      <div className="crm-ambient-blobs">
        <span />
        <span />
        <span />
      </div>

      {!user && (
        <AuthGate
          onAuth={(u) => {
            setUser(u);
            fetchAll();
          }}
        />
      )}

      <div
        className={`relative z-10 flex min-h-screen transition-all duration-500 ${
          !user
            ? "filter blur-[6px] pointer-events-none select-none opacity-40"
            : ""
        }`}
      >
        <Sidebar
          user={user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div
          className={`flex-1 ${isFinanceRole ? "md:pl-20" : "md:pl-64"} flex flex-col min-h-screen transition-all duration-300`}
        >
          <DashboardHeader
            user={user}
            onMenuOpen={() => setSidebarOpen(true)}
            activeTab={activeTab}
            onSignOut={handleSignOut}
            onOpenProfileSettings={() => setShowProfileSettings(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300">
            <div key={activeTab} className="animate-fade-in-up">
              {activeTab === "Dashboard" && (
                <DashboardView
                  user={user}
                  stats={stats}
                  leads={leads}
                  pipelines={pipelines}
                  onLeadCreated={() => fetchAll()}
                />
              )}
              {activeTab === "Leads" && (
                <LeadsView
                  user={user}
                  leads={leads}
                  pipelines={pipelines}
                  onRefresh={() => fetchAll()}
                />
              )}
              {activeTab === "Pipelines" && (
                <PipelinesView
                  user={user}
                  pipelines={pipelines}
                  onRefresh={() => fetchAll()}
                />
              )}
              {activeTab === "Finance" && <FinanceView user={user} />}
              {activeTab === "Users" && user?.role === "admin" && <UsersView />}
            </div>
          </main>

          <footer className="py-4 sm:py-5 px-4 sm:px-6 text-center border-t border-crm-border text-xs text-crm-text-sub">
            Copyright © {new Date().getFullYear()}{" "}
            <span className="text-crm-text-main font-bold">Bitzsol.com</span>.
            All rights reserved.
          </footer>
        </div>
      </div>

      {showProfileSettings && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileSettings(false)}
          onSaved={(updatedUser) => {
            setUser(updatedUser);
            setShowProfileSettings(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

"use client";

import {
  Menu,
  Bell,
  ChevronRight,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";
import type { AuthUser } from "@/types";
import type { ActiveTab } from "@/types";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface Props {
  user: AuthUser | null;
  onMenuOpen: () => void;
  activeTab: ActiveTab;
  onSignOut?: () => void;
  onOpenProfileSettings?: () => void;
}

export function DashboardHeader({
  user,
  onMenuOpen,
  activeTab,
  onSignOut,
  onOpenProfileSettings,
}: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClose = () => setShowDropdown(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [showDropdown]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-16 sm:h-20 border-b border-crm-border bg-crm-bg/90 backdrop-blur-md gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuOpen}
          className="md:hidden p-2 rounded-xl bg-crm-panel border border-crm-border hover:bg-crm-panel-hover cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4 text-crm-text-sub" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-xl font-bold text-crm-text-main leading-tight truncate">
            {activeTab}
          </h2>
          <div className="hidden sm:flex items-center gap-1 text-xs text-crm-text-sub mt-0.5">
            <span>
              {user?.role === "finance_admin" || user?.role === "finance_member"
                ? "Finance Workspace"
                : "Home"}
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crm-text-sub">{activeTab}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-xl bg-crm-panel border border-crm-border flex items-center justify-center cursor-pointer transition-all hover:bg-crm-panel-hover"
          aria-label="Toggle Theme"
        >
          {mounted && theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-crm-text-sub" />
          )}
        </button>

        {/* Notifications
        <div className="w-9 h-9 rounded-xl bg-crm-panel border border-crm-border flex items-center justify-center relative">
          <Bell className="w-4 h-4 text-crm-text-sub" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FB66BC] rounded-full ring-2 ring-crm-panel" />
        </div> */}

        {user && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="flex items-center gap-2 pl-3 border-l border-crm-border cursor-pointer hover:opacity-90 select-none group"
            >
              <div className="w-9 h-9 premium-gradient rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md transition-transform group-hover:scale-[1.03] overflow-hidden">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-crm-text-main leading-tight flex items-center gap-1">
                  {user.name}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-crm-text-sub transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
                  />
                </p>
              </div>
            </button>

            {showDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-3 w-56 bg-crm-panel border border-crm-border rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200"
              >
                <div className="flex flex-col items-center text-center pb-3 border-b border-crm-border">
                  <div className="w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-md mb-2 overflow-hidden">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <p className="text-sm font-bold text-crm-text-main truncate max-w-full">
                    {user.name}
                  </p>
                  <p className="text-xs text-crm-text-sub truncate max-w-full my-0.5">
                    {user.email}
                  </p>
                  <span
                    className={`inline-block text-[0.72rem] font-bold px-2 py-0.5 rounded-full border mt-1.5 ${
                      user.role === "admin"
                        ? "bg-[#0164DA]/10 text-[#0164DA] border-[#0164DA]/20"
                        : user.role === "finance_admin" ||
                            user.role === "finance_member"
                          ? "bg-[#03D9AF]/10 text-[#03D9AF] border-[#03D9AF]/20"
                          : "bg-[#FB66BC]/10 text-[#FB66BC] border-[#FB66BC]/20"
                    }`}
                  >
                    {user.role === "admin"
                      ? "Admin"
                      : user.role === "finance_admin"
                        ? "Finance Admin"
                        : user.role === "finance_member"
                          ? "Finance Member"
                          : "Business Dev"}
                  </span>
                </div>
                <div className="pt-2 border-b border-crm-border/60 pb-2">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenProfileSettings?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-crm-text-main hover:bg-crm-panel-hover transition-colors cursor-pointer text-left"
                  >
                    <Settings className="w-4 h-4 text-crm-text-sub" />
                    Profile Settings
                  </button>
                </div>
                {onSignOut && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4.5 h-4.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import {
  LayoutDashboard,
  Layers,
  Users,
  FileText,
  LogOut,
  X,
  DollarSign,
} from "lucide-react";
import type { AuthUser, ActiveTab } from "@/types";

interface NavItem {
  label: ActiveTab;
  icon: React.ElementType;
  roles?: string[]; // if undefined, visible to all roles
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "business_developer"],
  },
  {
    label: "Leads",
    icon: FileText,
    roles: ["admin", "business_developer"], // not for finance
  },
  {
    label: "Pipelines",
    icon: Layers,
    roles: ["admin", "business_developer"], // not for finance
  },
  {
    label: "Finance",
    icon: DollarSign,
    roles: ["admin", "finance_admin", "finance_member"],
  },
  {
    label: "Users",
    icon: Users,
    roles: ["admin"], // only admin
  },
];

interface Props {
  user: AuthUser | null;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onSignOut: () => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  user,
  activeTab,
  onTabChange,
  onSignOut,
  open,
  onClose,
}: Props) {
  const userRole = user?.role;
  const isFinanceRole =
    userRole === "finance_admin" || userRole === "finance_member";
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return userRole && item.roles.includes(userRole);
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-crm-panel border-r border-crm-border flex flex-col transition-all duration-300 ease-out ${
          isFinanceRole ? "w-20" : "w-64"
        } ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex items-center justify-center h-20 border-b border-crm-border">
          <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-sm ring-1 ring-white/10">
            <img
              src="/logo.png"
              alt="Bitzsol Logo"
              className="w-6 h-6 object-contain brightness-0 invert"
            />
          </div>
          {!isFinanceRole && (
            <button
              onClick={onClose}
              className="md:hidden ml-auto mr-4 text-crm-text-sub hover:text-crm-text-main transition-colors"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isFinanceRole ? (
          <div className="flex-1 flex flex-col items-center justify-between px-3 py-4">
            <div className="flex flex-col items-center gap-3 pt-4 w-full">
              <button
                type="button"
                onClick={() => {
                  onTabChange("Finance");
                  onClose();
                }}
                className={`group flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-300 ${
                  activeTab === "Finance"
                    ? "border-[#0164DA] bg-[#0164DA]/10 text-[#0164DA] shadow-lg shadow-[#0164DA]/10"
                    : "border-crm-border bg-crm-panel-hover/80 text-crm-text-sub hover:border-[#03D9AF]/40 hover:text-[#03D9AF]"
                }`}
                title="Finance"
              >
                <DollarSign className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              </button>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 transition-all duration-300 hover:bg-red-500/20"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <nav className="flex-1 px-4 py-6 space-y-1.5">
              <p className="text-[11px] font-bold text-crm-text-sub uppercase tracking-[0.32em] px-3 mb-3">
                Manage Listings
              </p>
              {visibleNavItems.map(({ label, icon: Icon }) => {
                const active = activeTab === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onTabChange(label);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                      active
                        ? "bg-crm-panel-hover text-[#0164DA] border-l-4 border-[#0164DA] pl-4 shadow-sm"
                        : "text-crm-text-sub hover:bg-crm-panel-hover hover:text-crm-text-main"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-crm-border">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

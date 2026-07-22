"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  Download,
  Upload,
  FileText,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import type { AuthUser } from "@/types";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { ModalPortal } from "@/components/ui/ModalPortal";

type TransactionType = "income" | "expense";
type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  invoice_url?: string | null;
  createdById?: string;
  created_at?: string;
};

type Tab = "expense" | "income" | "profit";
type TimeFilter = "week" | "month" | "year" | "custom";

interface Props {
  user: AuthUser | null;
}

export function FinanceView({ user }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("expense");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState<"expense" | "income" | null>(
    null,
  );

  // State for server‑side data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    profit: 0,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useLockBodyScroll(!!showAddModal || !!deleteId);

  // Pagination & sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortField, setSortField] = useState<
    "date" | "description" | "amount" | "category"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Category filter (will be a dropdown with all distinct categories)
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Get role
  const isAdmin = user?.role === "admin";
  const isFinanceAdmin = user?.role === "finance_admin";
  const isFinanceMember = user?.role === "finance_member";
  const isBD = user?.role === "business_developer";
  const canManageFinance = isAdmin || isFinanceAdmin || isFinanceMember;
  const canAddExpense = isAdmin || isFinanceAdmin || isFinanceMember;
  const canAddIncome = isAdmin || isFinanceAdmin || isFinanceMember;
  const showIncomeColumn = isAdmin || isFinanceAdmin;
  const showProfitColumn = isAdmin || isFinanceAdmin;

  // Visible tabs
  const visibleTabs: Tab[] = [];
  if (canManageFinance) visibleTabs.push("expense");
  if (isAdmin || isFinanceAdmin || isFinanceMember) visibleTabs.push("income");
  if (isAdmin || isFinanceAdmin) visibleTabs.push("profit");

  if (!visibleTabs.includes(activeTab) && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0]);
  }

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, categoryFilter, activeTab, timeFilter, customDate]);

  // ─── Fetch transactions from API ──────────────────────────────────────
  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortField,
        sortOrder,
      });

      // Type filter
      if (activeTab !== "profit") {
        params.append("type", activeTab);
      }

      // Search
      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }

      // Category
      if (categoryFilter !== "All") {
        params.append("category", categoryFilter);
      }

      // Date range
      const now = new Date();
      let startDate: Date | null = null;
      if (timeFilter === "week") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (timeFilter === "month") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      } else if (timeFilter === "year") {
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
      } else if (timeFilter === "custom" && customDate) {
        startDate = customDate;
      }
      if (startDate) {
        params.append("startDate", startDate.toISOString());
      }

      const res = await fetch(`/api/finances?${params.toString()}`);
      const result = await res.json();
      if (result.data) {
        setTransactions(result.data);
        if (result.pagination) {
          setTotalTransactions(result.pagination.total);
          setTotalPages(result.pagination.totalPages);
        }
        if (result.stats) {
          setStats(result.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch finances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [
    currentPage,
    debouncedSearch,
    activeTab,
    categoryFilter,
    timeFilter,
    customDate,
    sortField,
    sortOrder,
  ]);

  const { totalIncome, totalExpense, profit } = stats;

  // ─── Add transaction ──────────────────────────────────────────────────
  const handleAddTransaction = async (
    type: "income" | "expense",
    data: { description: string; amount: number; category: string },
  ) => {
    if (!user) return;
    try {
      const res = await fetch("/api/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...data }),
      });
      if (!res.ok) throw new Error("Failed to add");
      await fetchTransactions();
      setShowAddModal(null);
    } catch (err) {
      console.error(err);
      alert("Failed to add transaction.");
    }
  };

  // ─── Upload invoice ──────────────────────────────────────────────────
  const handleUploadInvoice = async (id: string) => {
    if (!user) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(id);
      try {
        const filePath = `users/${user.id}/${id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("invoices")
          .getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        // Update via API
        const res = await fetch(`/api/finances/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_url: publicUrl }),
        });
        if (!res.ok) throw new Error("Failed to update");
        await fetchTransactions();
      } catch (err) {
        console.error("Upload failed:", err);
        alert("Failed to upload invoice.");
      } finally {
        setUploading(null);
        document.body.removeChild(input);
      }
    };
    document.body.appendChild(input);
    input.click();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/finances/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchTransactions();
      setDeleteId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete transaction.");
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateInvoice = (id: string) => {
    alert(`Generate invoice for transaction ${id}`);
  };

  // ─── Sorting ──────────────────────────────────────────────────────────
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="animate-fade-in-up rounded-[28px] border border-crm-border/70 bg-linear-to-br from-[#0164DA]/12 via-crm-panel to-[#03D9AF]/10 p-4 sm:p-6 shadow-[0_20px_60px_rgba(1,100,218,0.08)] backdrop-blur-sm transition-all duration-300">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-crm-text-sub">
              {isFinanceMember
                ? "Personal finance workspace"
                : isFinanceAdmin
                  ? "Finance administration"
                  : "Finance overview"}
            </p>
            <h2 className="mt-2 text-xl sm:text-2xl font-black text-crm-text-main">
              {isFinanceMember
                ? "Keep your finance activity organized in one place"
                : "Track transactions, manage controls, and stay on top of cash flow"}
            </h2>
            <p className="mt-2 text-sm text-crm-text-sub leading-6">
              {isFinanceMember
                ? "Add and review your own finance entries quickly with a clean, mobile-friendly workflow."
                : "Review financial activity with clear filtering, time ranges, and action buttons designed for daily use."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch gap-2">
            <div className="flex bg-crm-panel border border-crm-border rounded-xl p-1">
              {(["week", "month", "year"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    timeFilter === t
                      ? "bg-[#0164DA] text-white"
                      : "text-crm-text-sub hover:text-crm-text-main"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setTimeFilter("custom")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
                  timeFilter === "custom"
                    ? "bg-[#0164DA] text-white"
                    : "text-crm-text-sub hover:text-crm-text-main"
                }`}
              >
                <Calendar className="w-3 h-3" />
                Custom
              </button>
            </div>
            {timeFilter === "custom" && (
              <input
                type="date"
                value={customDate ? customDate.toISOString().split("T")[0] : ""}
                onChange={(e) =>
                  setCustomDate(
                    e.target.value ? new Date(e.target.value) : null,
                  )
                }
                className="bg-crm-panel border border-crm-border rounded-xl px-3 py-2 text-sm text-crm-text-main focus:outline-none focus:border-[#0164DA]"
              />
            )}
            {canAddExpense && (
              <button
                onClick={() => setShowAddModal("expense")}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer border border-red-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Expense
              </button>
            )}
            {canAddIncome && (
              <button
                onClick={() => setShowAddModal("income")}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#03D9AF]/10 hover:bg-[#03D9AF]/20 text-[#03D9AF] text-xs font-bold rounded-xl transition-all cursor-pointer border border-[#03D9AF]/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Income
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="animate-fade-in-up flex border-b border-crm-border/40 overflow-x-auto rounded-2xl bg-crm-panel/70 px-1 py-1 shadow-sm"
        style={{ animationDelay: "60ms" }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-b-2 whitespace-nowrap rounded-xl ${
              activeTab === tab
                ? "text-[#0164DA] border-[#0164DA] bg-[#0164DA]/8"
                : "text-crm-text-sub border-transparent hover:text-crm-text-main hover:bg-crm-panel-hover"
            }`}
          >
            {tab === "expense" && "Expenses"}
            {tab === "income" && "Income"}
            {tab === "profit" && "Profit"}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {!isFinanceMember && (
        <div
          className={`grid gap-3 sm:gap-5 ${isAdmin || isFinanceAdmin ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1 max-w-sm"}`}
        >
          {(isAdmin || isFinanceAdmin) && (
            <StatCard
              index={0}
              label="Total Income"
              value={totalIncome}
              icon={TrendingUp}
              color="#03D9AF"
            />
          )}
          <StatCard
            index={1}
            label="Total Expenses"
            value={totalExpense}
            icon={TrendingDown}
            color="#EF4444"
          />
          {(isAdmin || isFinanceAdmin) && (
            <StatCard
              index={2}
              label="Net Profit"
              value={profit}
              icon={FileText}
              color={profit >= 0 ? "#0164DA" : "#EF4444"}
            />
          )}
        </div>
      )}

      {/* Transaction Table */}
      <div
        className="animate-fade-in-up glass p-4 sm:p-6 rounded-2xl shadow-md border border-crm-border/30 overflow-hidden"
        style={{ animationDelay: "180ms" }}
      >
        {/* Search and filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description or category..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-crm-panel border border-crm-border text-crm-text-main text-sm focus:outline-none focus:border-[#0164DA]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
          </div>
          {/* Category filter (dynamic from current list) – we can build a dropdown from distinct categories */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-crm-panel border border-crm-border text-crm-text-main text-sm focus:outline-none focus:border-[#0164DA]"
          >
            <option value="All">All Categories</option>
            {Array.from(new Set(transactions.map((t) => t.category))).map(
              (cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-bold text-crm-text-main">
            Transactions
          </h3>
          <span className="text-xs text-crm-text-sub bg-crm-panel-hover border border-crm-border px-2.5 py-1 rounded-lg font-bold">
            {totalTransactions} entries
          </span>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0164DA]"></div>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            message="No transactions found"
            action="Add a new entry using the buttons above."
          />
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-crm-border text-xs font-bold text-crm-text-sub uppercase tracking-widest">
                    <th
                      className="pb-3 text-left cursor-pointer hover:text-crm-text-main"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortField === "date" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-left cursor-pointer hover:text-crm-text-main"
                      onClick={() => handleSort("description")}
                    >
                      <div className="flex items-center gap-1">
                        Description
                        {sortField === "description" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-left hidden md:table-cell cursor-pointer hover:text-crm-text-main"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center gap-1">
                        Category
                        {sortField === "category" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-right cursor-pointer hover:text-crm-text-main"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Debit (Expense)
                        {sortField === "amount" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                    {showIncomeColumn && (
                      <th
                        className="pb-3 text-right cursor-pointer hover:text-crm-text-main"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Credit (Income)
                          {sortField === "amount" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#0164DA]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#0164DA]" />
                            ))}
                        </div>
                      </th>
                    )}
                    {isFinanceMember ? (
                      <th className="pb-3 text-right">Amount</th>
                    ) : showProfitColumn ? (
                      <th className="pb-3 text-right">Profit</th>
                    ) : null}
                    <th className="pb-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/40">
                  {transactions.map((tx, index, arr) => {
                    const runningProfit = arr
                      .slice(0, index + 1)
                      .reduce((s, t) => s + t.amount, 0);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-crm-panel-hover/30 transition-colors"
                      >
                        <td className="py-3 pr-4 text-xs text-crm-text-sub whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-sm font-medium text-crm-text-main">
                            {tx.description}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-crm-text-sub hidden md:table-cell">
                          {tx.category}
                        </td>
                        <td className="py-3 pr-4 text-right text-sm font-mono text-red-400">
                          {tx.type === "expense"
                            ? `PKR${Math.abs(tx.amount).toFixed(2)}`
                            : "-"}
                        </td>
                        {showIncomeColumn && (
                          <td className="py-3 pr-4 text-right text-sm font-mono text-[#03D9AF]">
                            {tx.type === "income"
                              ? `PKR${tx.amount.toFixed(2)}`
                              : "-"}
                          </td>
                        )}
                        {isFinanceMember ? (
                          <td className="py-3 pr-4 text-right text-sm font-mono font-bold text-crm-text-main">
                            {tx.type === "income" ? "+" : "-"}PKR
                            {Math.abs(tx.amount).toFixed(2)}
                          </td>
                        ) : showProfitColumn ? (
                          <td className="py-3 pr-4 text-right text-sm font-mono font-bold text-crm-text-main">
                            PKR{runningProfit.toFixed(2)}
                          </td>
                        ) : null}
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {tx.invoice_url ? (
                              <a
                                href={tx.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0164DA] hover:opacity-80"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            ) : (
                              <button
                                onClick={() => handleUploadInvoice(tx.id)}
                                disabled={uploading === tx.id}
                                className="text-crm-text-sub hover:text-[#0164DA] disabled:opacity-50"
                                title="Upload invoice"
                              >
                                {uploading === tx.id ? (
                                  <div className="w-4 h-4 border-2 border-crm-text-sub border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerateInvoice(tx.id)}
                              className="text-crm-text-sub hover:text-[#0164DA]"
                              title="Generate invoice"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            {(isAdmin || tx.createdById === user?.id) && (
                              <button
                                onClick={() => setDeleteId(tx.id)}
                                className="text-crm-text-sub hover:text-red-500"
                                title="Delete transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 p-4 rounded-xl glass hover:shadow-md transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-crm-text-main">
                        {tx.description}
                      </p>
                      <p className="text-xs text-crm-text-sub">
                        {tx.category} •{" "}
                        {new Date(tx.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${tx.type === "income" ? "text-[#03D9AF]" : "text-red-400"}`}
                    >
                      {tx.type === "income" ? "+" : "-"}PKR
                      {Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {isAdmin ? (
                      <span className="text-xs text-crm-text-sub">
                        Running profit: PKR-
                        {transactions
                          .slice(0, transactions.indexOf(tx) + 1)
                          .reduce((s, t) => s + t.amount, 0)
                          .toFixed(2)}
                      </span>
                    ) : (
                      <div />
                    )}
                    <div className="flex gap-2">
                      {tx.invoice_url ? (
                        <a
                          href={tx.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0164DA]"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      ) : (
                        <button
                          onClick={() => handleUploadInvoice(tx.id)}
                          disabled={uploading === tx.id}
                          className="text-crm-text-sub hover:text-[#0164DA] disabled:opacity-50"
                        >
                          {uploading === tx.id ? (
                            <div className="w-4 h-4 border-2 border-crm-text-sub border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleGenerateInvoice(tx.id)}
                        className="text-crm-text-sub hover:text-[#0164DA]"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {(isAdmin || tx.createdById === user?.id) && (
                        <button
                          onClick={() => setDeleteId(tx.id)}
                          className="text-crm-text-sub hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1 pt-4 border-t border-crm-border">
                <span className="text-xs text-crm-text-sub">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, totalTransactions)} of{" "}
                  {totalTransactions}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-crm-border text-crm-text-main hover:bg-crm-panel-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page = i + 1;
                    if (totalPages > 5) {
                      if (currentPage > 3) page = currentPage - 2 + i;
                      if (page > totalPages) page = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? "bg-[#0164DA] text-white"
                            : "border border-crm-border text-crm-text-main hover:bg-crm-panel-hover"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-crm-border text-crm-text-main hover:bg-crm-panel-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-crm-panel rounded-2xl border border-crm-border p-6 max-w-sm w-full shadow-2xl text-crm-text-main animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto border border-red-500/20">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h4 className="text-lg font-bold text-center mb-2">
              Delete Transaction?
            </h4>
            <p className="text-sm text-crm-text-sub text-center mb-6">
              This action cannot be undone. The transaction will be permanently
              removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center"
              >
                {deleting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddTransactionModal
          type={showAddModal}
          onClose={() => setShowAddModal(null)}
          onSave={handleAddTransaction}
        />
      )}
    </div>
  );
}

/* ─── Helper Components ─── */

function StatCard({
  index = 0,
  label,
  value,
  icon: Icon,
  color,
}: {
  index?: number;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      style={{ "--stagger-delay": `${index * 60}ms` } as React.CSSProperties}
      className="stagger-item animate-fade-in-up card-hover group glass p-4 sm:p-5 rounded-2xl shadow-md border border-crm-border/30 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <span className="text-xs sm:text-sm font-bold text-crm-text-sub uppercase tracking-wider leading-tight">
          {label}
        </span>
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color }} />
        </div>
      </div>
      <p
        className={`text-2xl sm:text-3xl font-black leading-none ${value >= 0 ? "text-crm-text-main" : "text-red-400"}`}
      >
        PKR-{value.toFixed(2)}
      </p>
    </div>
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

function AddTransactionModal({
  type,
  onClose,
  onSave,
}: {
  type: "expense" | "income";
  onClose: () => void;
  onSave: (type: "expense" | "income", data: any) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0 || !category) return;
    onSave(type, { description, amount, category });
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-crm-panel p-6 rounded-2xl max-w-md w-full shadow-2xl border border-crm-border max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-lg font-black"
            style={{ color: type === "expense" ? "#EF4444" : "#03D9AF" }}
          >
            Add {type === "expense" ? "Expense" : "Income"}
          </h3>
          <button
            onClick={onClose}
            className="text-crm-text-sub hover:text-crm-text-main"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-crm-text-sub uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-crm-panel border border-crm-border rounded-xl px-4 py-2.5 text-sm text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-2 focus:ring-[#0164DA]/20 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-crm-text-sub uppercase tracking-wider mb-1">
              Amount (PKR)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-crm-panel border border-crm-border rounded-xl px-4 py-2.5 text-sm text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-2 focus:ring-[#0164DA]/20 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-crm-text-sub uppercase tracking-wider mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-crm-panel border border-crm-border rounded-xl px-4 py-2.5 text-sm text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-2 focus:ring-[#0164DA]/20 transition-all"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border border-crm-border text-crm-text-sub hover:bg-crm-panel-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-95 transition-all shadow-lg"
              style={{
                backgroundColor: type === "expense" ? "#EF4444" : "#03D9AF",
                boxShadow: `0 10px 25px -8px ${type === "expense" ? "#EF444440" : "#03D9AF40"}`,
              }}
            >
              Add {type === "expense" ? "Expense" : "Income"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

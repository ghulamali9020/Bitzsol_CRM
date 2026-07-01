"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import type { User } from "@/types";

// Extend the User type to include the new roles (if not already in types)
// We'll use a union type locally; you can also update the global type.
type UserRole = "admin" | "business_developer" | "finance_member" | "finance_admin";

export function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("business_developer");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [image, setImage] = useState<string | null>(null);

  // Advanced Table States
  const [searchQuery, setSearchQuery] = useState("");
  const [showColDropdown, setShowColDropdown] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    role: true,
    joined: true,
    status: true,
  });
  const [sortField, setSortField] = useState<"name" | "role" | "joined" | "status">("joined");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.data) {
        setUsers(data.data);
        setError("");
      } else {
        setError(data.error ?? "Failed to load users.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("business_developer");
    setStatus("active");
    setImage(null);
    setEditUser(null);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(u: User) {
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role as UserRole); // cast if needed
    setStatus(u.status);
    setImage(u.image || null);
    setEditUser(u);
    setFormError("");
    setShowForm(true);
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFormError("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
      const method = editUser ? "PATCH" : "POST";
      const body: Record<string, any> = { name, email, role, status, image };
      if (password) body.password = password;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed.");
        return;
      }
      setShowForm(false);
      fetchUsers();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setDeleteId(null);
    setDeleting(false);
    fetchUsers();
  }

  async function toggleStatus(u: User) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: u.status === "active" ? "inactive" : "active" }),
    });
    fetchUsers();
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const toggleColumn = (col: keyof typeof visibleCols) => {
    setVisibleCols((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const filteredUsers = users
    .filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "role") {
        comparison = a.role.localeCompare(b.role);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "joined") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] text-sm";
  const labelCls =
    "block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1.5";

  // Helper to get role badge styles
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return {
          label: "Admin",
          className: "bg-[#0164DA]/10 text-[#0164DA] border-[#0164DA]/20",
        };
      case "business_developer":
        return {
          label: "Business Dev",
          className: "bg-[#FB66BC]/10 text-[#FB66BC] border-[#FB66BC]/20",
        };
      case "finance_admin":
        return {
          label: "Finance Admin",
          className: "bg-[#03D9AF]/10 text-[#03D9AF] border-[#03D9AF]/20",
        };
      case "finance_member":
        return {
          label: "Finance Member",
          className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        };
      default:
        return {
          label: role,
          className: "bg-crm-panel-hover text-crm-text-sub border-crm-border",
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-crm-text-main">Users</h3>
          <p className="text-xs text-crm-text-sub">
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0164DA] hover:opacity-90 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {/* Advanced Toolbar */}
      <div className="flex flex-row gap-2 items-center justify-between glass p-3 sm:p-4 rounded-2xl shadow-md border border-crm-border/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-crm-text-sub" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search users..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] text-xs transition-colors"
          />
        </div>

        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowColDropdown(!showColDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-crm-panel border border-crm-border hover:bg-crm-panel-hover text-crm-text-main text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-crm-text-sub" />
            Columns
          </button>

          {showColDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowColDropdown(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-crm-panel border border-crm-border rounded-xl shadow-xl p-3 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                <p className="text-xs font-bold text-crm-text-sub uppercase tracking-wider mb-2">
                  Toggle Columns
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-crm-text-main cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.role}
                      onChange={() => toggleColumn("role")}
                      className="rounded border-crm-border text-[#0164DA] focus:ring-0 cursor-pointer"
                    />
                    Role
                  </label>
                  <label className="flex items-center gap-2 text-xs text-crm-text-main cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.joined}
                      onChange={() => toggleColumn("joined")}
                      className="rounded border-crm-border text-[#0164DA] focus:ring-0 cursor-pointer"
                    />
                    Joined Date
                  </label>
                  <label className="flex items-center gap-2 text-xs text-crm-text-main cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleCols.status}
                      onChange={() => toggleColumn("status")}
                      className="rounded border-crm-border text-[#0164DA] focus:ring-0 cursor-pointer"
                    />
                    Status
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-crm-text-sub text-sm">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16 shadow-md border border-crm-border/30">
          <Users className="w-10 h-10 text-crm-text-sub mx-auto mb-3" />
          <p className="text-sm font-bold text-crm-text-main">
            {searchQuery ? "No matching users found" : "No users yet"}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-md border border-crm-border/30">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-crm-border">
                <tr className="text-xs font-bold text-crm-text-sub uppercase tracking-widest select-none">
                  <th
                    className="px-5 py-4 text-left cursor-pointer hover:text-crm-text-main transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      User
                      {sortField === "name" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="w-3 h-3 text-[#0164DA]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#0164DA]" />
                        ))}
                    </div>
                  </th>

                  {visibleCols.role && (
                    <th
                      className="px-5 py-4 text-left cursor-pointer hover:text-crm-text-main transition-colors hidden sm:table-cell"
                      onClick={() => handleSort("role")}
                    >
                      <div className="flex items-center gap-1">
                        Role
                        {sortField === "role" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3 h-3 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                  )}

                  {visibleCols.joined && (
                    <th
                      className="px-5 py-4 text-left cursor-pointer hover:text-crm-text-main transition-colors hidden md:table-cell"
                      onClick={() => handleSort("joined")}
                    >
                      <div className="flex items-center gap-1">
                        Joined
                        {sortField === "joined" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3 h-3 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                  )}

                  {visibleCols.status && (
                    <th
                      className="px-5 py-4 text-left cursor-pointer hover:text-crm-text-main transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === "status" &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-3 h-3 text-[#0164DA]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#0164DA]" />
                          ))}
                      </div>
                    </th>
                  )}

                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/40">
                {paginatedUsers.map((u) => {
                  const roleInfo = getRoleBadge(u.role);
                  return (
                    <tr key={u.id} className="hover:bg-crm-panel-hover/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden">
                            {u.image ? (
                              <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-crm-text-main">{u.name}</p>
                            <p className="text-xs text-crm-text-sub">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {visibleCols.role && (
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <span
                            className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full border ${roleInfo.className}`}
                          >
                            {roleInfo.label}
                          </span>
                        </td>
                      )}

                      {visibleCols.joined && (
                        <td className="px-5 py-4 text-xs text-crm-text-sub hidden md:table-cell">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      )}

                      {visibleCols.status && (
                        <td className="px-5 py-4">
                          <button
                            onClick={() => toggleStatus(u)}
                            className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                              u.status === "active"
                                ? "bg-[#03D9AF]/10 text-[#03D9AF] border-[#03D9AF]/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-[#03D9AF]/10 hover:text-[#03D9AF] hover:border-[#03D9AF]/20"
                            }`}
                          >
                            {u.status === "active" ? "Active" : "Inactive"}
                          </button>
                        </td>
                      )}

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(u)}
                            className="w-7 h-7 rounded-lg bg-[#0164DA]/10 text-[#0164DA] flex items-center justify-center hover:bg-[#0164DA]/20 cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden divide-y divide-crm-border/40">
            {paginatedUsers.map((u) => {
              const roleInfo = getRoleBadge(u.role);
              return (
                <div key={u.id} className="p-4 flex items-start justify-between gap-3 bg-crm-panel-hover/10">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl premium-gradient flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden shrink-0">
                      {u.image ? (
                        <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-crm-text-main truncate">{u.name}</p>
                      <p className="text-xs text-crm-text-sub truncate leading-none">{u.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span
                          className={`text-[0.72rem] font-bold px-1.5 py-0.5 rounded-full border ${roleInfo.className}`}
                        >
                          {roleInfo.label}
                        </span>
                        <span className="text-[0.72rem] text-crm-text-sub bg-crm-panel border border-crm-border px-1.5 py-0.5 rounded-md">
                          Joined {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <button
                      onClick={() => toggleStatus(u)}
                      className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                        u.status === "active"
                          ? "bg-[#03D9AF]/10 text-[#03D9AF] border-[#03D9AF]/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-[#03D9AF]/10 hover:text-[#03D9AF] hover:border-[#03D9AF]/20"
                      }`}
                    >
                      {u.status === "active" ? "Active" : "Inactive"}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        className="w-7 h-7 rounded-lg bg-[#0164DA]/10 text-[#0164DA] flex items-center justify-center hover:bg-[#0164DA]/20 cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(u.id)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-crm-border bg-crm-panel/50 text-xs">
              <span className="text-crm-text-sub">
                Showing <span className="font-bold text-crm-text-main">{startIndex + 1}</span> to{" "}
                <span className="font-bold text-crm-text-main">
                  {Math.min(startIndex + itemsPerPage, filteredUsers.length)}
                </span>{" "}
                of <span className="font-bold text-crm-text-main">{filteredUsers.length}</span> users
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-crm-border bg-crm-panel hover:bg-crm-panel-hover text-crm-text-sub hover:text-crm-text-main disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === idx + 1
                          ? "bg-[#0164DA] text-white shadow-md shadow-[#0164DA]/25"
                          : "border border-crm-border bg-crm-panel hover:bg-crm-panel-hover text-crm-text-sub hover:text-crm-text-main"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-crm-border bg-crm-panel hover:bg-crm-panel-hover text-crm-text-sub hover:text-crm-text-main disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-crm-panel rounded-2xl border border-crm-border p-6 max-w-md w-full shadow-2xl text-crm-text-main max-h-[90vh] overflow-y-auto">
            <h4 className="text-base font-bold mb-4">
              {editUser ? "Edit User" : "Add New User"}
            </h4>
            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4">
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="john@bitzsol.com"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {editUser ? "New Password (leave blank to keep)" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + " pr-11"}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-sub hover:text-crm-text-main transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={inputCls}
                  >
                    <option value="business_developer">Business Developer</option>
                    <option value="admin">Admin</option>
                    <option value="finance_member">Finance Member</option>
                    <option value="finance_admin">Finance Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#0164DA] hover:opacity-90 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editUser ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-crm-panel rounded-2xl border border-crm-border p-6 max-w-sm w-full shadow-2xl text-crm-text-main">
            <h4 className="text-base font-bold mb-2">Delete User?</h4>
            <p className="text-sm text-crm-text-sub mb-6">
              This will permanently remove the user account. Their leads will remain.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
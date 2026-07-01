"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Layers } from "lucide-react";
import type { AuthUser, Pipeline } from "@/types";

interface Props {
  user: AuthUser | null;
  pipelines: Pipeline[];
  onRefresh: () => void;
}

export function PipelinesView({ user, pipelines, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editPipeline, setEditPipeline] = useState<Pipeline | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setName(""); setDescription(""); setEditPipeline(null); setShowForm(true); }
  function openEdit(p: Pipeline) { setName(p.name); setDescription(p.description ?? ""); setEditPipeline(p); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = editPipeline ? `/api/pipelines/${editPipeline.id}` : "/api/pipelines";
      const method = editPipeline ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setShowForm(false);
      onRefresh();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
    setDeleteId(null);
    onRefresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-crm-text-main">Pipelines</h3>
          <p className="text-xs text-crm-text-sub">{pipelines.length} pipeline{pipelines.length !== 1 ? "s" : ""} configured</p>
        </div>
        {user?.role === "admin" && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0164DA] hover:opacity-90 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg">
            <Plus className="w-3.5 h-3.5" /> New Pipeline
          </button>
        )}
      </div>

      {pipelines.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16 shadow-md border border-crm-border/30">
          <Layers className="w-10 h-10 text-crm-text-sub mx-auto mb-3" />
          <p className="text-sm font-bold text-crm-text-main mb-1">No pipelines yet</p>
          {user?.role === "admin" && <p className="text-xs text-crm-text-sub">Create your first pipeline to start organizing leads.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((p) => (
            <div key={p.id} className="glass p-5 rounded-2xl border border-crm-border/30 hover:border-[#0164DA]/30 hover:shadow-lg transition-all duration-300 group shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#0164DA]/10 flex items-center justify-center text-[#0164DA]">
                  <Layers className="w-5 h-5" />
                </div>
                {user?.role === "admin" && (
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg bg-[#0164DA]/10 text-[#0164DA] flex items-center justify-center hover:bg-[#0164DA]/20 cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h4 className="font-bold text-crm-text-main text-sm mb-1">{p.name}</h4>
              {p.description && <p className="text-xs text-crm-text-sub mb-3 line-clamp-2">{p.description}</p>}
              <div className="flex items-center justify-between text-xs text-crm-text-sub border-t border-crm-border pt-3 mt-3">
                <span>{p._count?.leads ?? 0} leads</span>
                <span>by {p.createdBy?.name ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-crm-panel rounded-2xl border border-crm-border p-6 max-w-md w-full shadow-2xl text-crm-text-main">
            <h4 className="text-base font-bold mb-4">{editPipeline ? "Edit Pipeline" : "New Pipeline"}</h4>
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1.5">Pipeline Name *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] text-sm"
                  placeholder="e.g. Inbound Sales" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] text-sm resize-none"
                  placeholder="Optional description..." />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#0164DA] hover:bg-[#0164DA]/90 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                  {loading ? "Saving..." : editPipeline ? "Update" : "Create"}
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
            <h4 className="text-base font-bold mb-2">Delete Pipeline?</h4>
            <p className="text-sm text-crm-text-sub mb-6">All leads in this pipeline will also be affected. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-semibold cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

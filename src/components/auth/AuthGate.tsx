"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import type { AuthUser } from "@/types";

interface Props {
  onAuth: (user: AuthUser) => void;
}

export function AuthGate({ onAuth }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign in fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: siEmail, password: siPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed."); return; }
      onAuth(data.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xl p-4 overflow-hidden animate-fade-in">
      {/* Ambient brand-colored blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#0164DA]/25 blur-3xl animate-blob-drift" />
        <div
          className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-[#03D9AF]/20 blur-3xl animate-blob-drift"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-[#FB66BC]/20 blur-3xl animate-blob-drift"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-crm-border bg-crm-panel text-crm-text-main transition-all duration-300 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-xl bg-[#0164DA]/40 blur-md animate-glow-pulse" />
              <div className="relative w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-sm">
                <img src="/logo.png" alt="Bitzsol Logo" className="w-8 h-8 object-contain brightness-0 invert" />
              </div>
            </div>
            <span className="text-2xl font-bold text-brand-gradient">Bitzsol</span>
          </div>
          <p className="text-crm-text-sub text-xs mt-1">Lead Management Portal · Admin Access</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center mb-4 animate-fade-in-up">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-2 focus:ring-[#0164DA]/20 text-sm transition-all duration-200"
              placeholder="admin@bitzsol.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} required value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-2 focus:ring-[#0164DA]/20 text-sm transition-all duration-200"
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
          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-bold bg-[#0164DA] hover:opacity-90 hover:shadow-xl active:scale-[0.98] transition-all mt-2 disabled:opacity-50 disabled:active:scale-100 cursor-pointer shadow-lg shadow-[#0164DA]/25"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-[0.72rem] text-crm-text-sub mt-6 border-t border-crm-border pt-4">
          Sessions expire daily · © bitzsol.com
        </p>
      </div>
    </div>
  );
}

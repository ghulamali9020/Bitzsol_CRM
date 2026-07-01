"use client";

import { useState } from "react";
import { X, User, Key, Mail, CheckCircle, Shield, Eye, EyeOff } from "lucide-react";
import type { AuthUser } from "@/types";

interface Props {
  user: AuthUser;
  onClose: () => void;
  onSaved: (updatedUser: AuthUser) => void;
}

export function ProfileModal({ user, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [image, setImage] = useState<string | null>(user.image || null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Password visibility toggles
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleCancelEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setImage(user.image || null);
    setIsEditing(false);
    setError("");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImage(null);
    const fileInput = document.getElementById("profile-image-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    // Password change validations
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setError("Current password is required to change password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        return;
      }
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
          image,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to update profile.");
        return;
      }

      setSuccessMsg("Profile updated successfully!");
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsEditing(false);

      // Notify parent to update the session state
      setTimeout(() => {
        onSaved(json.data);
      }, 1000);
    } catch {
      setError("A network error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full pl-9 pr-3 py-2.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] text-sm transition-all shadow-sm";
  const labelCls =
    "block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full ${isEditing ? 'max-w-2xl' : 'max-w-md'} bg-crm-panel border border-crm-border shadow-2xl rounded-2xl text-crm-text-main flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border bg-crm-panel flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0164DA]/10 border border-[#0164DA]/30 text-[#0164DA] rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-crm-text-main">
                {isEditing ? "Edit Profile" : "Profile Details"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-crm-panel-hover hover:bg-crm-panel border border-crm-border flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-crm-text-main hover:opacity-80" />
          </button>
        </div>

        {/* Content Body */}
        {isEditing ? (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Profile Avatar & Basic Info */}
                <div className="space-y-4 flex flex-col justify-center">
                  {/* Profile Photo Upload */}
                  <div className="flex flex-col items-center justify-center gap-3 py-2 border-b border-crm-border/30 pb-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full border-2 border-crm-border bg-crm-panel-hover overflow-hidden flex items-center justify-center text-crm-text-main text-3xl font-bold shadow-inner ring-4 ring-[#0164DA]/20 hover:ring-[#0164DA]/50 transition-all duration-300">
                        {image ? (
                          <img src={image} alt="Profile Preview" className="w-full h-full object-cover" />
                        ) : (
                          name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <label
                        htmlFor="profile-image-input"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full text-xs font-bold text-white cursor-pointer transition-opacity duration-200"
                      >
                        Change Photo
                      </label>
                      <input
                        id="profile-image-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </div>
                    {image && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-xs text-red-400 hover:underline hover:text-red-300 font-semibold cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  {/* Name Field */}
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                        placeholder="Name"
                      />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div>
                    <label className={labelCls}>Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                        placeholder="Email Address"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Update Password Fields */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-crm-border/40 pt-4 md:pt-0 md:pl-8 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1">
                      Update Password
                    </p>
                    <p className="text-[0.72rem] text-crm-text-sub uppercase tracking-widest leading-relaxed">
                      Leave blank if you do not want to change your password.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Current Password Field */}
                    <div>
                      <label className={labelCls}>Current Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={inputCls + " pr-10"}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-sub hover:text-crm-text-main transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password Field */}
                    <div>
                      <label className={labelCls}>New Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={inputCls + " pr-10"}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-sub hover:text-crm-text-main transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password Field */}
                    <div>
                      <label className={labelCls}>Confirm New Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                        <input
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputCls + " pr-10"}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-sub hover:text-crm-text-main transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-crm-border bg-crm-panel">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-xs font-bold uppercase tracking-wider text-crm-text-main transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#0164DA] hover:bg-[#0164DA]/90 border border-[#0164DA] text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#0164DA]/20"
              >
                {loading ? "Saving Details..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col">
            <div className="p-6 space-y-6 flex flex-col items-center">
              {successMsg && (
                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2 font-semibold animate-in fade-in duration-200">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Avatar display */}
              <div className="w-24 h-24 rounded-full border-2 border-crm-border bg-crm-panel-hover overflow-hidden flex items-center justify-center text-crm-text-main text-3xl font-bold shadow-inner ring-4 ring-[#0164DA]/20">
                {image ? (
                  <img src={image} alt="Profile Preview" className="w-full h-full object-cover" />
                ) : (
                  user.name.substring(0, 2).toUpperCase()
                )}
              </div>

              {/* Display fields stack */}
              <div className="w-full space-y-4 text-left">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub/70" />
                    <div className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-crm-input-bg/50 border border-crm-border text-crm-text-main text-sm font-semibold shadow-sm select-all">
                      {user.name}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub/70" />
                    <div className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-crm-input-bg/50 border border-crm-border text-crm-text-main text-sm font-semibold shadow-sm select-all">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Account Role</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#03D9AF]/80" />
                    <div className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-crm-input-bg/50 border border-crm-border text-xs font-bold text-[#03D9AF] uppercase tracking-widest shadow-sm select-all">
                      {user.role?.replace("_", " ")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-crm-border bg-crm-panel">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-xs font-bold uppercase tracking-wider text-crm-text-main transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 rounded-xl bg-[#0164DA] hover:bg-[#0164DA]/90 border border-[#0164DA] text-white text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#0164DA]/20"
              >
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

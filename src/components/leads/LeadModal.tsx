"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Mail,
  Phone,
  AlertCircle,
  Link,
  Hash,
} from "lucide-react";
import type { Pipeline, Lead } from "@/types";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface Props {
  pipelines: Pipeline[];
  lead?: Lead;
  onClose: () => void;
  onSaved: () => void;
}

export function LeadModal({ pipelines, lead, onClose, onSaved }: Props) {
  useLockBodyScroll();
  const isEdit = !!lead;

  const [firstName, setFirstName] = useState(lead?.firstName ?? "");
  const [middleName, setMiddleName] = useState(lead?.middleName ?? "");
  const [lastName, setLastName] = useState(lead?.lastName ?? "");
  const [names, setNames] = useState<
    { firstName: string; middleName: string; lastName: string }[]
  >([]);

  const [designation, setDesignation] = useState(lead?.designation ?? "");
  const [jobTitle, setJobTitle] = useState(lead?.jobTitle ?? ""); // NEW
  const [headline, setHeadline] = useState(lead?.headline ?? "");
  const [company, setCompany] = useState(lead?.company ?? "");
  const [status, setStatus] = useState(lead?.status ?? "New");
  const [leadSource, setLeadSource] = useState(lead?.leadSource ?? "Other");
  const [sourceLink, setSourceLink] = useState(lead?.sourceLink ?? "");
  const [remarks, setRemarks] = useState(lead?.remarks ?? "");
  const [pipelineId, setPipelineId] = useState(
    lead?.pipelineId ?? pipelines[0]?.id ?? "",
  );

  const [emails, setEmails] = useState<{ email: string; status: string }[]>(
    lead?.emails.map((e) => ({ email: e.email, status: e.status })) ?? [
      { email: "", status: "Not_Verified" },
    ],
  );
  const [phones, setPhones] = useState<{ phone: string; status: string }[]>(
    lead?.phones.map((p) => ({ phone: p.phone, status: p.status })) ?? [
      { phone: "", status: "Not_Verified" },
    ],
  );
  const [customFields, setCustomFields] = useState<
    { key: string; value: string }[]
  >(lead?.customFields ?? []);

  const [tags, setTags] = useState<string[]>(lead?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      let val = tagInput.trim();
      if (!val) return;
      if (!val.startsWith("#")) val = `#${val}`;
      if (!tags.includes(val)) setTags([...tags, val]);
      setTagInput("");
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  const [customStatuses, setCustomStatuses] = useState<string[]>(() => {
    const defaults = [
      "New",
      "Contacted",
      "Qualified",
      "Proposal Sent",
      "Negotiation",
      "Closed",
      "Lost",
    ];
    if (lead?.status && !defaults.includes(lead.status)) {
      defaults.push(lead.status);
    }
    return defaults;
  });
  const [customSources, setCustomSources] = useState<string[]>(() => {
    const defaults = [
      "Google Search",
      "Referral",
      "Cold Outreach",
      "LinkedIn",
      "Email Campaign",
      "Other",
    ];
    if (lead?.leadSource && !defaults.includes(lead.leadSource)) {
      defaults.push(lead.leadSource);
    }
    return defaults;
  });

  const [newStatusInput, setNewStatusInput] = useState("");
  const [showNewStatusInput, setShowNewStatusInput] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState("");
  const [showNewSourceInput, setShowNewSourceInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleAddStatus() {
    const val = newStatusInput.trim();
    if (val && !customStatuses.includes(val)) {
      setCustomStatuses([...customStatuses, val]);
      setStatus(val);
      setNewStatusInput("");
      setShowNewStatusInput(false);
    }
  }

  function handleAddSource() {
    const val = newSourceInput.trim();
    if (val && !customSources.includes(val)) {
      setCustomSources([...customSources, val]);
      setLeadSource(val);
      setNewSourceInput("");
      setShowNewSourceInput(false);
    }
  }

  function insertFormatting(prefix: string, suffix: string = "") {
    const textarea = document.getElementById(
      "remarks-textarea",
    ) as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = prefix + selectedText + suffix;
    const newRemarks =
      text.substring(0, start) + replacement + text.substring(end);
    setRemarks(newRemarks);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length,
      );
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !pipelineId) {
      setError("First name and pipeline are required.");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/leads/${lead!.id}` : "/api/leads";
      const method = isEdit ? "PATCH" : "POST";
      const body = {
        firstName,
        middleName,
        lastName,
        designation,
        jobTitle, // NEW
        headline,
        company,
        status,
        leadSource,
        sourceLink,
        remarks,
        pipelineId,
        emails: emails.filter((e) => e.email.trim()),
        phones: phones.filter((p) => p.phone.trim()),
        customFields: customFields.filter((f) => f.key.trim()),
        tags,
        additionalNames: names,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save lead.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main focus:outline-none focus:border-[#0164DA] focus:ring-1 focus:ring-[#0164DA]/40 text-sm transition-all placeholder-crm-text-sub/50 shadow-sm";
  const labelCls =
    "block text-xs font-bold text-[#0164DA] uppercase tracking-wider mb-1";

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl max-h-[85vh] bg-crm-panel border border-crm-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-crm-border bg-linear-to-r from-[#0164DA]/10 via-crm-panel to-[#0164DA]/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 btn-brand-gradient text-white rounded-xl shadow-md shadow-[#0164DA]/20">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-brand-solid">
                  {isEdit ? "Modify Lead Details" : "Create New Lead"}
                </h3>
                <p className="text-[0.7rem] text-crm-text-sub uppercase tracking-widest mt-0.5 hidden sm:block">
                  {isEdit
                    ? `Editing Lead Profile: ${firstName} ${lastName}`
                    : "Add a new lead to your business development pipeline"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-crm-text-main hover:opacity-80" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-crm-bg">
            <div className="w-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* Left Column */}
              <div className="flex-1 flex flex-col gap-3">
                {/* Primary Name */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputCls}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Middle</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      className={inputCls}
                      placeholder="William"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Last</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputCls}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {/* Additional Names */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0164DA] uppercase tracking-wider">
                      Additional Names
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNames([
                          ...names,
                          { firstName: "", middleName: "", lastName: "" },
                        ])
                      }
                      className="flex items-center gap-1 text-xs text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Name
                    </button>
                  </div>
                  <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                    {names.map((n, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={n.firstName}
                            onChange={(ev) => {
                              const updated = [...names];
                              updated[i].firstName = ev.target.value;
                              setNames(updated);
                            }}
                            className={inputCls}
                            placeholder="First"
                          />
                          <input
                            type="text"
                            value={n.middleName}
                            onChange={(ev) => {
                              const updated = [...names];
                              updated[i].middleName = ev.target.value;
                              setNames(updated);
                            }}
                            className={inputCls}
                            placeholder="Middle"
                          />
                          <input
                            type="text"
                            value={n.lastName}
                            onChange={(ev) => {
                              const updated = [...names];
                              updated[i].lastName = ev.target.value;
                              setNames(updated);
                            }}
                            className={inputCls}
                            placeholder="Last"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNames(names.filter((_, j) => j !== i))
                          }
                          className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {names.length === 0 && (
                      <div className="text-center py-2 border border-dashed border-crm-border/40 bg-crm-panel/20 text-crm-text-sub text-xs font-bold uppercase tracking-wider">
                        No additional names
                      </div>
                    )}
                  </div>
                </div>

                {/* Designation & Pipeline */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className={inputCls}
                      placeholder="CEO"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Pipeline *</label>
                    <select
                      value={pipelineId}
                      onChange={(e) => setPipelineId(e.target.value)}
                      className={inputCls}
                      required
                    >
                      <option value="">Select pipeline…</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Job Title & Company */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Software Engineer"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Google"
                    />
                  </div>
                </div>

                {/* Headline (LinkedIn tagline — kept separate from Job Title) */}
                <div>
                  <label className={labelCls}>Headline</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Full-Stack Engineer | MERN · Building AI-Integrated Web Applications"
                  />
                </div>

                {/* Status & Lead Source */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Status</label>
                      {!showNewStatusInput && (
                        <button
                          type="button"
                          onClick={() => setShowNewStatusInput(true)}
                          className="text-[0.7rem] text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {showNewStatusInput ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newStatusInput}
                          onChange={(e) => setNewStatusInput(e.target.value)}
                          placeholder="New Status"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={handleAddStatus}
                          className="px-2.5 py-1 bg-[#03D9AF]/15 text-[#03D9AF] border border-[#03D9AF]/30 rounded-lg text-xs font-bold hover:bg-[#03D9AF]/25 cursor-pointer transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewStatusInput(false);
                            setNewStatusInput("");
                          }}
                          className="px-2.5 py-1 bg-crm-panel-hover border border-crm-border rounded-lg text-xs text-crm-text-sub hover:text-crm-text-main cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={inputCls}
                      >
                        {customStatuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Lead Source</label>
                      {!showNewSourceInput && (
                        <button
                          type="button"
                          onClick={() => setShowNewSourceInput(true)}
                          className="text-[0.7rem] text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {showNewSourceInput ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSourceInput}
                          onChange={(e) => setNewSourceInput(e.target.value)}
                          placeholder="New Source"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={handleAddSource}
                          className="px-2.5 py-1 bg-[#03D9AF]/15 text-[#03D9AF] border border-[#03D9AF]/30 rounded-lg text-xs font-bold hover:bg-[#03D9AF]/25 cursor-pointer transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewSourceInput(false);
                            setNewSourceInput("");
                          }}
                          className="px-2.5 py-1 bg-crm-panel-hover border border-crm-border rounded-lg text-xs text-crm-text-sub hover:text-crm-text-main cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select
                        value={leadSource}
                        onChange={(e) => setLeadSource(e.target.value)}
                        className={inputCls}
                      >
                        {customSources.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Source Link */}
                <div>
                  <label className={labelCls}>Source Link</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                    <input
                      type="url"
                      value={sourceLink}
                      onChange={(e) => setSourceLink(e.target.value)}
                      className={`${inputCls} pl-10`}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Remarks / Notes</label>
                    <div className="flex items-center bg-crm-panel border border-crm-border p-0.5 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => insertFormatting("**", "**")}
                        className="px-2 py-0.5 text-xs font-bold hover:bg-crm-panel-hover text-crm-text-main cursor-pointer border-r border-crm-border"
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("*", "*")}
                        className="px-2 py-0.5 text-xs italic hover:bg-crm-panel-hover text-crm-text-main cursor-pointer border-r border-crm-border"
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("- ")}
                        className="px-1.5 py-0.5 text-xs hover:bg-crm-panel-hover text-crm-text-main cursor-pointer border-r border-crm-border"
                        title="Bullet List"
                      >
                        • List
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting("1. ")}
                        className="px-1.5 py-0.5 text-xs hover:bg-crm-panel-hover text-crm-text-main cursor-pointer"
                        title="Numbered List"
                      >
                        1. List
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="remarks-textarea"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className={`${inputCls} resize-none h-16 sm:h-20`}
                    placeholder="Enter detailed client requirements, notes, context..."
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="flex-1 flex flex-col gap-3">
                {/* Emails */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0164DA] uppercase tracking-wider">
                      Email Addresses
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEmails([
                          ...emails,
                          { email: "", status: "Not_Verified" },
                        ])
                      }
                      className="flex items-center gap-1 text-xs text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                    {emails.map((e, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                          <input
                            type="email"
                            value={e.email}
                            onChange={(ev) => {
                              const n = [...emails];
                              n[i].email = ev.target.value;
                              setEmails(n);
                            }}
                            className={`${inputCls} pl-10`}
                            placeholder="email@example.com"
                          />
                        </div>
                        <select
                          value={e.status}
                          onChange={(ev) => {
                            const n = [...emails];
                            n[i].status = ev.target.value;
                            setEmails(n);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main text-sm focus:outline-none focus:border-[#0164DA]"
                        >
                          <option value="Not_Verified">Not Verified</option>
                          <option value="Verified">Verified</option>
                        </select>
                        {emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEmails(emails.filter((_, j) => j !== i))
                            }
                            className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phones */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0164DA] uppercase tracking-wider">
                      Phone Numbers
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPhones([
                          ...phones,
                          { phone: "", status: "Not_Verified" },
                        ])
                      }
                      className="flex items-center gap-1 text-xs text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                    {phones.map((p, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                          <input
                            type="tel"
                            value={p.phone}
                            onChange={(ev) => {
                              const n = [...phones];
                              n[i].phone = ev.target.value;
                              setPhones(n);
                            }}
                            className={`${inputCls} pl-10`}
                            placeholder="+1 555 0000"
                          />
                        </div>
                        <select
                          value={p.status}
                          onChange={(ev) => {
                            const n = [...phones];
                            n[i].status = ev.target.value;
                            setPhones(n);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-crm-input-bg border border-crm-border text-crm-text-main text-sm focus:outline-none focus:border-[#0164DA]"
                        >
                          <option value="Not_Verified">Not Verified</option>
                          <option value="Verified">Verified</option>
                        </select>
                        {phones.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPhones(phones.filter((_, j) => j !== i))
                            }
                            className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#0164DA] uppercase tracking-wider">
                    Tags
                  </span>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-text-sub" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className={`${inputCls} pl-10`}
                      placeholder="Type tag (e.g. fiverr) and hit Enter"
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1 py-0.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0164DA]/10 border border-[#0164DA]/20 text-[#0164DA] text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:bg-[#0164DA]/15"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-400 cursor-pointer transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Custom Fields */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0164DA] uppercase tracking-wider">
                      Custom Fields
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields([
                          ...customFields,
                          { key: "", value: "" },
                        ])
                      }
                      className="flex items-center gap-1 text-xs text-[#03D9AF] hover:underline cursor-pointer font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                    {customFields.length === 0 ? (
                      <div className="text-center py-3 border border-dashed border-crm-border/40 bg-crm-panel/20 text-crm-text-sub text-xs font-bold uppercase tracking-wider">
                        No custom fields added
                      </div>
                    ) : (
                      customFields.map((f, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={f.key}
                            onChange={(ev) => {
                              const n = [...customFields];
                              n[i].key = ev.target.value;
                              setCustomFields(n);
                            }}
                            className={`${inputCls} w-2/5`}
                            placeholder="Key"
                          />
                          <input
                            type="text"
                            value={f.value}
                            onChange={(ev) => {
                              const n = [...customFields];
                              n[i].value = ev.target.value;
                              setCustomFields(n);
                            }}
                            className={`${inputCls} flex-1`}
                            placeholder="Value"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCustomFields(
                                customFields.filter((_, j) => j !== i),
                              )
                            }
                            className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 border-t border-crm-border bg-crm-panel gap-3 flex-shrink-0">
            <div className="w-full sm:w-auto">
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-sm font-semibold rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-crm-panel-hover hover:bg-crm-panel border border-crm-border text-sm font-bold uppercase tracking-wider text-crm-text-main transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl btn-brand-gradient hover:opacity-95 active:scale-95 border border-[#0164DA] text-white font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#0164DA]/20"
              >
                {loading ? "Saving…" : isEdit ? "Update Lead" : "Add Lead"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

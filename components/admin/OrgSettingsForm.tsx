"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CHAT_LIMITS, type ChatConfig } from "@/lib/chat-config";

type Props = {
  orgId: string;
  canEdit: boolean;
  initial: {
    name: string;
    slug: string;
    plan: string;
    siteSlug: string | null;
    brandName: string;
    brandTagline: string;
    brandLogoUrl: string;
    chat: ChatConfig;
  };
};

export function OrgSettingsForm({ orgId, canEdit, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [siteSlug, setSiteSlug] = useState(initial.siteSlug ?? "");
  const [brandName, setBrandName] = useState(initial.brandName);
  const [brandTagline, setBrandTagline] = useState(initial.brandTagline);
  const [brandLogoUrl, setBrandLogoUrl] = useState(initial.brandLogoUrl);
  const [assistantName, setAssistantName] = useState(initial.chat.assistantName);
  const [persona, setPersona] = useState(initial.chat.persona);
  const [greeting, setGreeting] = useState(initial.chat.greeting);
  const [suggestionsText, setSuggestionsText] = useState(
    initial.chat.suggestions.join("\n"),
  );
  const [fallbackMessage, setFallbackMessage] = useState(initial.chat.fallbackMessage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const suggestions = suggestionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, CHAT_LIMITS.suggestionMax);
      const res = await fetch("/api/admin/orgs/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name,
          siteSlug: siteSlug.trim() ? siteSlug.trim() : null,
          brandName: brandName.trim() ? brandName : null,
          brandTagline: brandTagline.trim() ? brandTagline : null,
          brandLogoUrl: brandLogoUrl.trim() ? brandLogoUrl : null,
          chat: {
            assistantName: assistantName.trim() ? assistantName.trim() : null,
            persona: persona.trim() ? persona : null,
            greeting: greeting.trim() ? greeting : null,
            suggestions,
            fallbackMessage: fallbackMessage.trim() ? fallbackMessage : null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to save (${res.status}).`);
      }
      setMessage("Saved.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSubmitting(false);
    }
  }

  const publicUrl = siteSlug.trim()
    ? `/site/${siteSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Identity</h3>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Organization name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            maxLength={120}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Internal slug
          <input
            type="text"
            value={initial.slug}
            disabled
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
          <span className="text-[11px] text-slate-500">
            Internal identifier — not user-visible. Cannot be changed here.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Plan
          <input
            type="text"
            value={initial.plan}
            disabled
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Public site</h3>
        <p className="text-xs text-slate-500">
          When you set a site slug, your branded support page becomes available at{" "}
          <code className="rounded bg-slate-100 px-1">/site/&lt;slug&gt;</code> and anonymous
          visitors can use that org&apos;s knowledge base.
        </p>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Site slug (public URL)
          <input
            type="text"
            value={siteSlug}
            onChange={(e) => setSiteSlug(e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. acme-support"
            maxLength={60}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          {publicUrl ? (
            <span className="text-[11px] text-slate-500">
              Preview: <code className="rounded bg-slate-100 px-1">{publicUrl}</code>
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">
              Leave empty to keep the public site disabled.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Brand name (shown to visitors)
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            disabled={!canEdit}
            placeholder={initial.name}
            maxLength={80}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Tagline
          <input
            type="text"
            value={brandTagline}
            onChange={(e) => setBrandTagline(e.target.value)}
            disabled={!canEdit}
            placeholder="Customer support assistant"
            maxLength={160}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Logo URL
          <input
            type="url"
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            disabled={!canEdit}
            placeholder="https://example.com/logo.png"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Chat behavior</h3>
          <p className="mt-1 text-xs text-slate-500">
            Controls how your assistant introduces itself, what it suggests, and
            how it talks. Everything here is per-organization.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Assistant name
          <input
            type="text"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            disabled={!canEdit}
            placeholder={brandName || initial.name}
            maxLength={CHAT_LIMITS.assistantName}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          <span className="text-[11px] text-slate-500">
            Shown in the chat header and avatar. Leave empty to use the brand name.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Persona (system prompt)
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            disabled={!canEdit}
            rows={4}
            maxLength={CHAT_LIMITS.persona}
            placeholder="e.g. You are friendly, concise, and professional. Always address the user formally."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          <span className="text-[11px] text-slate-500">
            Appended to the system prompt of every chat response (max{" "}
            {CHAT_LIMITS.persona} chars).
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Greeting message
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            disabled={!canEdit}
            rows={4}
            maxLength={CHAT_LIMITS.greeting}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          <span className="text-[11px] text-slate-500">
            First message visitors see when they open the chat.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Suggested questions (one per line, up to {CHAT_LIMITS.suggestionMax})
          <textarea
            value={suggestionsText}
            onChange={(e) => setSuggestionsText(e.target.value)}
            disabled={!canEdit}
            rows={6}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          <span className="text-[11px] text-slate-500">
            Quick-tap chips above the chat input. One question per line.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Fallback message
          <textarea
            value={fallbackMessage}
            onChange={(e) => setFallbackMessage(e.target.value)}
            disabled={!canEdit}
            rows={3}
            maxLength={CHAT_LIMITS.fallbackMessage}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:bg-slate-50"
          />
          <span className="text-[11px] text-slate-500">
            Used when the assistant has no information to answer from your
            knowledge base.
          </span>
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {canEdit ? (
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your role does not allow editing settings. Ask an organization owner or admin.
        </div>
      )}
    </form>
  );
}

"use client";

import { useState } from "react";

const roleOptions = [
  "org_owner",
  "org_admin",
  "content_manager",
  "support_agent",
  "support_lead",
  "viewer",
] as const;

type InviteResponse = {
  invitationId: string | null;
  invitedEmail: string;
  role: string;
  expiresAt: string | null;
  inviteToken: string;
  emailDelivery?: {
    delivered: boolean;
    reason?: string;
  };
  note: string;
};

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResponse | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as InviteResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to create invitation.");
      }
      setResult(data as InviteResponse);
      setEmail("");
      setRole("viewer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Invite member</h3>
      <p className="mt-1 text-sm text-slate-600">
        Creates an invitation token in the database (email sending can be wired in n8n next).
      </p>

      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@company.com"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/40 focus:ring"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/40 focus:ring"
        >
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
        >
          {submitting ? "Inviting..." : "Create invite"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>
            Invitation created for <strong>{result.invitedEmail}</strong> as{" "}
            <strong>{result.role}</strong>.
          </p>
          <p className="mt-2">
            Expires (UTC): <strong>{result.expiresAt ?? "unknown"}</strong>
          </p>
          <p className="mt-2 break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-800">
            token: {result.inviteToken}
          </p>
          <p className="mt-2 text-xs text-slate-700">
            {result.emailDelivery?.delivered
              ? "Email webhook delivered to n8n."
              : `Email webhook not delivered${
                  result.emailDelivery?.reason ? `: ${result.emailDelivery.reason}` : "."
                }`}
          </p>
        </div>
      ) : null}
    </div>
  );
}

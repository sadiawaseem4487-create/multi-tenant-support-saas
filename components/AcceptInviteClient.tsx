"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  token: string;
  signedIn: boolean;
};

type AcceptResponse =
  | { ok: true; orgId: string; orgName: string; role: string }
  | { error: string };

export function AcceptInviteClient({ token, signedIn }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orgId: string; orgName: string; role: string } | null>(
    null,
  );

  async function acceptInvite() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as AcceptResponse;
      if (!response.ok || !("ok" in payload && payload.ok)) {
        throw new Error("error" in payload ? payload.error : "Failed to accept invitation.");
      }
      setSuccess({ orgId: payload.orgId, orgName: payload.orgName, role: payload.role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setLoading(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Sign in to accept invitation</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use the same email address that received this invitation.
        </p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
          className="mt-4 inline-flex rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Accept invitation</h2>
      <p className="mt-2 text-sm text-slate-600">
        Click below to join the organization from your invite.
      </p>

      <button
        type="button"
        onClick={acceptInvite}
        disabled={loading}
        className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
      >
        {loading ? "Accepting..." : "Accept invitation"}
      </button>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>
            Joined <strong>{success.orgName}</strong> as <strong>{success.role}</strong>.
          </p>
          <Link
            href={`/admin/members?orgId=${encodeURIComponent(success.orgId)}`}
            className="mt-2 inline-flex text-sm font-medium text-emerald-900 underline underline-offset-4"
          >
            Open organization members
          </Link>
        </div>
      ) : null}
    </div>
  );
}

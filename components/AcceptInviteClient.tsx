"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type InviteDetails = {
  email: string;
  role: string;
  orgName: string;
  orgId: string;
  expiresAt: string;
};

type Props = {
  token: string;
  signedIn: boolean;
  signedInEmails: string[];
  invite: InviteDetails;
};

type AcceptResponse =
  | { ok: true; orgId: string; orgName: string; role: string }
  | { error: string };

function authHref(
  path: "/sign-in" | "/sign-up",
  token: string,
  invitedEmail: string,
): string {
  const redirect = encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`);
  const email = encodeURIComponent(invitedEmail);
  return `${path}?redirect_url=${redirect}&email_address=${email}`;
}

export function AcceptInviteClient({ token, signedIn, signedInEmails, invite }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAccepted = useRef(false);

  const inviteEmail = invite.email.toLowerCase();
  const emailMatches = signedInEmails.some((e) => e.toLowerCase() === inviteEmail);
  const acceptReturnUrl = `/accept-invite?token=${encodeURIComponent(token)}`;

  async function acceptInvite() {
    setLoading(true);
    setError(null);
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
      router.push(`/admin?orgId=${encodeURIComponent(payload.orgId)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!signedIn || !emailMatches || autoAccepted.current) return;
    autoAccepted.current = true;
    void acceptInvite();
  }, [signedIn, emailMatches]);

  const roleLabel = invite.role.replace(/_/g, " ");

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Invitation</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Join {invite.orgName}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You were invited as <strong>{roleLabel}</strong>. Create an account or sign in with{" "}
          <strong>{invite.email}</strong> — then you will be added to the organization automatically.
        </p>
        <p className="mt-2 text-xs text-slate-500">Expires (UTC): {invite.expiresAt}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={authHref("/sign-up", token, invite.email)}
            className="inline-flex rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Create account
          </Link>
          <Link
            href={authHref("/sign-in", token, invite.email)}
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!emailMatches) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-amber-950">Use the invited email</h2>
        <p className="mt-2 text-sm text-amber-900">
          This invitation is for <strong>{invite.email}</strong> ({roleLabel} at{" "}
          <strong>{invite.orgName}</strong>).
        </p>
        <p className="mt-2 text-sm text-amber-900">
          You are signed in as <strong>{signedInEmails.join(", ")}</strong>. Sign out, then sign
          in or create an account with <strong>{invite.email}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <SignOutButton redirectUrl={acceptReturnUrl}>
            <button
              type="button"
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Sign out and continue
            </button>
          </SignOutButton>
          <Link
            href={authHref("/sign-in", token, invite.email)}
            className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100/50"
          >
            Sign in as {invite.email}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Invitation</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">Join {invite.orgName}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as <strong>{invite.email}</strong>. Accept to enter the admin workspace as{" "}
        <strong>{roleLabel}</strong>.
      </p>

      <button
        type="button"
        onClick={acceptInvite}
        disabled={loading}
        className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
      >
        {loading ? "Joining..." : "Accept invitation"}
      </button>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";

type OrgItem = {
  orgId: string;
  orgName: string;
  role: string;
};

type CreateOrgResponse = {
  createdOrgId: string;
  createdSlug: string;
  memberships: OrgItem[];
};

type OrganizationsPanelProps = {
  canCreateOrganization: boolean;
};

export function OrganizationsPanel({ canCreateOrganization }: OrganizationsPanelProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; slug: string } | null>(null);

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as CreateOrgResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create organization.");
      }
      const data = payload as CreateOrgResponse;
      setCreated({ name, slug: data.createdSlug });
      setName("");
      window.location.href = `/admin?orgId=${encodeURIComponent(data.createdOrgId)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Organizations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create a new organization workspace and switch to it from the org dropdown.
        </p>
      </div>

      {canCreateOrganization ? (
        <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Acme Distribution"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/40 focus:ring"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
          >
            {submitting ? "Creating..." : "Create organization"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your role does not allow creating organizations. Ask an organization owner/admin for
          access.
        </div>
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {created ? (
        <p className="text-sm text-emerald-700">
          Organization <strong>{created.name}</strong> created (slug:{" "}
          <code className="rounded bg-emerald-100 px-1">{created.slug}</code>).
        </p>
      ) : null}
    </section>
  );
}

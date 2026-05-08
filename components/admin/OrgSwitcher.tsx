"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type OrgItem = {
  orgId: string;
  orgName: string;
  role: string;
};

type OrgResponse = {
  selectedOrgId: string | null;
  selectedOrgName: string | null;
  memberships: OrgItem[];
};

export function OrgSwitcher() {
  const [data, setData] = useState<OrgResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedOrgId = searchParams.get("orgId");

  useEffect(() => {
    let mounted = true;
    const query = selectedOrgId ? `?orgId=${encodeURIComponent(selectedOrgId)}` : "";
    fetch(`/api/admin/orgs${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!mounted) return;
        if ("error" in payload) {
          setError(payload.error);
          return;
        }
        setData(payload as OrgResponse);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load organizations.");
      });

    return () => {
      mounted = false;
    };
  }, [selectedOrgId]);

  if (error) {
    return <p className="text-xs text-rose-600">{error}</p>;
  }

  if (!data) {
    return <p className="text-xs text-slate-500">Loading organizations...</p>;
  }

  if (!data.memberships.length || !data.selectedOrgId) {
    return <p className="text-xs text-slate-500">No organizations</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Org</span>
      <select
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
        value={data.selectedOrgId}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("orgId", event.target.value);
          window.location.href = `${pathname}?${next.toString()}`;
        }}
      >
        {data.memberships.map((membership) => (
          <option key={membership.orgId} value={membership.orgId}>
            {membership.orgName} ({membership.role})
          </option>
        ))}
      </select>
      <Link
        href={`/admin/members?orgId=${encodeURIComponent(data.selectedOrgId)}`}
        className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
      >
        Members
      </Link>
      <Link
        href={`/admin/knowledge?orgId=${encodeURIComponent(data.selectedOrgId)}`}
        className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
      >
        Knowledge
      </Link>
      <Link
        href="/admin/organizations"
        className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
      >
        Organizations
      </Link>
    </div>
  );
}

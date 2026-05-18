"use client";

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
    return (
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-100" aria-hidden />
    );
  }

  if (!data.memberships.length || !data.selectedOrgId) {
    return <p className="text-sm text-slate-500">No organizations</p>;
  }

  const selected = data.memberships.find((m) => m.orgId === data.selectedOrgId);

  return (
    <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Workspace
      </span>
      <select
        className="w-full min-w-[12rem] max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-200/60 sm:w-auto"
        value={data.selectedOrgId}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("orgId", event.target.value);
          window.location.href = `${pathname}?${next.toString()}`;
        }}
      >
        {data.memberships.map((membership) => (
          <option key={membership.orgId} value={membership.orgId}>
            {membership.orgName} · {membership.role.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {selected ? (
        <span className="hidden text-xs text-slate-500 lg:inline">
          {data.memberships.length} org{data.memberships.length === 1 ? "" : "s"}
        </span>
      ) : null}
    </label>
  );
}

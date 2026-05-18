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

export function OrgSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "inline" }) {
  const [data, setData] = useState<OrgResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedOrgId = searchParams.get("orgId");
  const isSidebar = variant === "sidebar";

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
    return <p className="text-xs text-rose-300">{error}</p>;
  }

  if (!data) {
    return (
      <div
        className={
          isSidebar
            ? "mx-3 h-10 animate-pulse rounded-lg bg-white/10"
            : "h-10 w-48 animate-pulse rounded-lg bg-slate-100"
        }
        aria-hidden
      />
    );
  }

  if (!data.memberships.length || !data.selectedOrgId) {
    return <p className="px-3 text-sm text-slate-400">No organizations</p>;
  }

  const selectClass = isSidebar
    ? "w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-medium text-white shadow-sm focus:border-teal-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
    : "w-full min-w-[12rem] max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-200/60 sm:w-auto";

  return (
    <label className={isSidebar ? "block px-3" : "flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"}>
      <span
        className={
          isSidebar
            ? "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400"
            : "text-[11px] font-semibold uppercase tracking-wider text-slate-500"
        }
      >
        Workspace
      </span>
      <select
        className={selectClass}
        value={data.selectedOrgId}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("orgId", event.target.value);
          window.location.href = `${pathname}?${next.toString()}`;
        }}
      >
        {data.memberships.map((membership) => (
          <option key={membership.orgId} value={membership.orgId} className="text-slate-900">
            {membership.orgName} · {membership.role.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

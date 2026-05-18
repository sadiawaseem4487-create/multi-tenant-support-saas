"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavItem = {
  href: (orgId: string) => string;
  label: string;
  match: (pathname: string) => boolean;
  accent?: "present";
};

const NAV_ITEMS: NavItem[] = [
  {
    href: (orgId) => `/admin?orgId=${encodeURIComponent(orgId)}`,
    label: "Home",
    match: (p) => p === "/admin",
  },
  {
    href: (orgId) => `/admin/present?orgId=${encodeURIComponent(orgId)}`,
    label: "Present",
    match: (p) => p.startsWith("/admin/present"),
    accent: "present",
  },
  {
    href: (orgId) => `/admin/members?orgId=${encodeURIComponent(orgId)}`,
    label: "Members",
    match: (p) => p.startsWith("/admin/members"),
  },
  {
    href: (orgId) => `/admin/knowledge?orgId=${encodeURIComponent(orgId)}`,
    label: "Knowledge",
    match: (p) => p.startsWith("/admin/knowledge"),
  },
  {
    href: (orgId) => `/admin/analytics?orgId=${encodeURIComponent(orgId)}`,
    label: "Analytics",
    match: (p) => p.startsWith("/admin/analytics"),
  },
  {
    href: (orgId) => `/admin/audit?orgId=${encodeURIComponent(orgId)}`,
    label: "Audit",
    match: (p) => p.startsWith("/admin/audit"),
  },
  {
    href: (orgId) => `/admin/settings?orgId=${encodeURIComponent(orgId)}`,
    label: "Settings",
    match: (p) => p.startsWith("/admin/settings"),
  },
  {
    href: () => "/admin/organizations",
    label: "Organizations",
    match: (p) => p.startsWith("/admin/organizations"),
  },
];

export function AdminNav({ orgId }: { orgId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const isPresent = item.accent === "present";
        return (
          <Link
            key={item.label}
            href={item.href(orgId)}
            className={[
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? isPresent
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-teal-700 text-white shadow-sm"
                : isPresent
                  ? "text-indigo-800 hover:bg-indigo-50"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNavWithOrg() {
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get("orgId");
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(queryOrgId);

  useEffect(() => {
    if (queryOrgId) {
      setResolvedOrgId(queryOrgId);
      return;
    }
    let mounted = true;
    fetch("/api/admin/orgs", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!mounted || "error" in payload) return;
        const id = (payload as { selectedOrgId?: string }).selectedOrgId;
        if (id) setResolvedOrgId(id);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [queryOrgId]);

  if (!resolvedOrgId) {
    return <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-50" aria-hidden />;
  }
  return <AdminNav orgId={resolvedOrgId} />;
}

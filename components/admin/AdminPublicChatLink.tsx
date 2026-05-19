"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const APP_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://multi-tenant-support-saas.vercel.app";

type OrgResponse = {
  selectedSiteSlug: string | null;
  error?: string;
};

export function AdminPublicChatLink() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const [siteSlug, setSiteSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    fetch(`/api/admin/orgs${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!mounted) return;
        if ("error" in payload) {
          setSiteSlug(null);
          return;
        }
        setSiteSlug((payload as OrgResponse).selectedSiteSlug ?? null);
      })
      .catch(() => {
        if (mounted) setSiteSlug(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div className="h-9 animate-pulse rounded-lg bg-white/10" aria-hidden />
    );
  }

  if (!siteSlug) {
    return (
      <Link
        href={orgId ? `/admin/settings?orgId=${encodeURIComponent(orgId)}` : "/admin/settings"}
        className="block rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-100 hover:bg-amber-500/20"
      >
        Set site slug to enable public chat
      </Link>
    );
  }

  const href = `${APP_ORIGIN}/site/${siteSlug}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
    >
      Open this org&apos;s chat →
    </a>
  );
}

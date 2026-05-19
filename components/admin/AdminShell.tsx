"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { AdminNavWithOrg } from "@/components/admin/AdminNav";
import { AdminPublicChatLink } from "@/components/admin/AdminPublicChatLink";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";

function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-2 px-3" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      }
    >
      <AdminNavWithOrg layout="sidebar" onNavigate={onNavigate} />
    </Suspense>
  );
}

export function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <>
      <div className="border-b border-white/10 px-4 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">
          Admin console
        </p>
        <p className="mt-1 text-lg font-bold tracking-tight text-white">Operations</p>
      </div>

      <div className="border-b border-white/10 py-4">
        <Suspense fallback={<div className="mx-3 h-10 animate-pulse rounded-lg bg-white/10" />}>
          <OrgSwitcher variant="sidebar" />
        </Suspense>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </p>
        <SidebarNav onNavigate={closeMobile} />
      </div>

      <div className="border-t border-white/10 p-4 space-y-3">
        <Suspense fallback={<div className="h-9 animate-pulse rounded-lg bg-white/10" />}>
          <AdminPublicChatLink />
        </Suspense>
        <Link
          href="/"
          onClick={closeMobile}
          className="flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          Marketing home
        </Link>
        {email ? (
          <p className="truncate px-1 text-xs text-slate-500" title={email}>
            {email}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-slate-900">Operations</p>
            </div>
          </div>
          <AdminUserMenu />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

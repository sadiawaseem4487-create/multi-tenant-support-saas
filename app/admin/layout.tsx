import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { AdminHeaderBar } from "@/components/admin/AdminHeaderBar";
import { ensureTenantAccess } from "@/lib/auth-sync";
import { listMemberships } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Admin | Company console",
  description: "Organization administration",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  let hasMembership = false;

  if (user) {
    try {
      await ensureTenantAccess({
        authSubject: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress,
        displayName: user.fullName ?? user.firstName ?? null,
      });
    } catch (syncError) {
      const existing = await listMemberships(user.id).catch(() => []);
      if (!existing.length) {
        throw syncError;
      }
      console.error("[auth-sync] ensureTenantAccess failed for member with access", syncError);
    }

    const memberships = await listMemberships(user.id);
    hasMembership = memberships.length > 0;
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                Admin console
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                Operations
              </h1>
              {email ? (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  <span className="text-slate-500">Signed in as</span>{" "}
                  <span className="font-medium text-slate-800">{email}</span>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-slate-600">
                  Organization context loads after sign-in.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 self-start sm:pt-1">
              <Link
                href="/"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Public site
              </Link>
              <AdminUserMenu />
            </div>
          </div>
          {user && hasMembership ? (
            <Suspense fallback={null}>
              <AdminHeaderBar />
            </Suspense>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {user && !hasMembership ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
            <h2 className="text-lg font-semibold">No organization access yet</h2>
            <p className="mt-2 text-sm">
              Your account is signed in but is not a member of any organization yet. Ask an
              organization owner to invite you from the Members panel.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

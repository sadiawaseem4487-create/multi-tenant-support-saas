import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { ensureTenantAccess } from "@/lib/auth-sync";
import { listMemberships } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Admin | Company console",
  description: "Organization administration",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  let orgName: string | null = null;
  let roleLabel: string | null = null;
  let hasMembership = false;

  if (user) {
    try {
      await ensureTenantAccess({
        authSubject: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress,
        displayName: user.fullName ?? user.firstName ?? null,
      });
    } catch (syncError) {
      // Do not block admin for users who already have memberships (e.g. invited to multiple orgs).
      const existing = await listMemberships(user.id).catch(() => []);
      if (!existing.length) {
        throw syncError;
      }
      console.error("[auth-sync] ensureTenantAccess failed for member with access", syncError);
    }

    const memberships = await listMemberships(user.id);
    if (memberships.length > 0) {
      hasMembership = true;
      orgName = memberships[0].orgName;
      roleLabel = memberships[0].role;
    }
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Admin console
            </p>
            <h1 className="text-lg font-semibold text-slate-900">Operations</h1>
            {email ? (
              <p className="text-sm text-slate-600 sm:max-w-[36rem]">
                Signed in as {email}
                {orgName ? ` · ${orgName}` : ""}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Organization context loads after sign-in.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4 sm:shrink-0">
            {user && hasMembership ? <OrgSwitcher /> : null}
            <Link
              href="/"
              className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
            >
              Public site
            </Link>
            <AdminUserMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">
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

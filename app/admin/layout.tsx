import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { ensureTenantAccess } from "@/lib/auth-sync";
import { getPrimaryMembership } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Admin | Company console",
  description: "Organization administration",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  let orgName: string | null = null;
  let roleLabel: string | null = null;

  if (user) {
    await ensureTenantAccess({
      authSubject: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress,
      displayName: user.fullName ?? user.firstName ?? null,
    });

    const membership = await getPrimaryMembership(user.id);
    orgName = membership.orgName;
    roleLabel = membership.role;
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Admin console
            </p>
            <h1 className="text-lg font-semibold text-slate-900">Operations</h1>
            {email ? (
              <p className="text-sm text-slate-600">
                Signed in as {email}
                {orgName ? ` · ${orgName}` : ""}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Organization context loads after sign-in.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/members"
              className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
            >
              Members
            </Link>
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
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}

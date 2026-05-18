import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AdminShell } from "@/components/admin/AdminShell";
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Sign in to access the admin console.</p>
        </div>
      </div>
    );
  }

  if (!hasMembership) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h2 className="text-lg font-semibold">No organization access yet</h2>
          <p className="mt-2 text-sm">
            Your account is signed in but is not a member of any organization yet. Ask an
            organization owner to invite you from the Members panel.
          </p>
        </div>
      </div>
    );
  }

  return <AdminShell email={email}>{children}</AdminShell>;
}

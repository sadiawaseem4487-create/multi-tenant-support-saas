import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { MembersTable } from "@/components/admin/MembersTable";

type MemberRow = {
  membershipId: string;
  userId: string;
  authSubject: string | null;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

type InvitationRow = {
  email: string;
  role: string;
  expiresAt: string;
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { orgId } = await searchParams;
  const context = await resolveOrgContext(user.id, orgId);
  try {
    await requireRole(context.orgId, "users:read", user.id);
  } catch {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-amber-900">No access to Members</h2>
          <p className="mt-2 text-sm text-amber-800">
            Your current role in <strong>{context.orgName}</strong> does not include member
            management permission.
          </p>
        </div>
      </section>
    );
  }

  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not set.");
  }

  const members = await sql<MemberRow[]>`
    select
      m.id as "membershipId",
      u.id as "userId",
      u.auth_subject as "authSubject",
      u.email as "email",
      u.display_name as "displayName",
      m.role::text as "role",
      to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "joinedAt"
    from public.memberships m
    join public.users u on u.id = m.user_id
    where m.org_id = ${context.orgId}::uuid
    order by m.created_at asc
  `;

  let canInvite = true;
  try {
    await requireRole(context.orgId, "users:invite", user.id);
  } catch {
    canInvite = false;
  }

  const canManage = context.role === "org_owner" || context.role === "org_admin";

  const pendingInvites = canInvite
    ? await sql<InvitationRow[]>`
        select
          email,
          role::text as "role",
          to_char(expires_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "expiresAt"
        from public.invitations
        where org_id = ${context.orgId}::uuid
          and accepted_at is null
          and expires_at > now()
        order by created_at desc
      `
    : [];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Members</h2>
        <p className="mt-2 text-sm text-slate-600">
          Organization: <span className="font-medium text-slate-800">{context.orgName}</span>
        </p>
      </div>

      {canInvite ? <InviteMemberForm orgId={context.orgId} /> : null}

      <MembersTable
        orgId={context.orgId}
        currentAuthSubject={user.id}
        canManage={canManage}
        members={members}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Pending invitations
          </h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Expires (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendingInvites.map((invite) => (
              <tr key={`${invite.email}-${invite.expiresAt}`}>
                <td className="px-4 py-3 text-sm text-slate-900">{invite.email}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{invite.role}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{invite.expiresAt}</td>
              </tr>
            ))}
            {pendingInvites.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-600" colSpan={3}>
                  No pending invitations.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";

type MemberRow = {
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

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = new URL(request.url).searchParams.get("orgId");
    const context = await resolveOrgContext(userId, orgId);
    await requireRole(context.orgId, "users:read", userId);

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const members = await sql<MemberRow[]>`
      select
        u.email as "email",
        u.display_name as "displayName",
        m.role::text as "role",
        to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "joinedAt"
      from public.memberships m
      join public.users u on u.id = m.user_id
      where m.org_id = ${context.orgId}::uuid
      order by m.created_at asc
    `;

    const pendingInvites = await sql<InvitationRow[]>`
      select
        email,
        role::text as "role",
        to_char(expires_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "expiresAt"
      from public.invitations
      where org_id = ${context.orgId}::uuid
        and accepted_at is null
        and expires_at > now()
      order by created_at desc
    `;

    return NextResponse.json({
      orgId: context.orgId,
      orgName: context.orgName,
      role: context.role,
      members,
      pendingInvites,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

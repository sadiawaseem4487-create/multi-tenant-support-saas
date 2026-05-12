import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, type MembershipRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const ALLOWED_ROLES: MembershipRole[] = [
  "org_owner",
  "org_admin",
  "content_manager",
  "support_agent",
  "support_lead",
  "viewer",
];

type RoleBody = { role?: MembershipRole };

type MembershipLookup = {
  membershipId: string;
  orgId: string;
  userId: string;
  role: MembershipRole;
  userEmail: string;
};

async function loadMembership(membershipId: string): Promise<MembershipLookup | null> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set.");

  const [row] = await sql<MembershipLookup[]>`
    select
      m.id as "membershipId",
      m.org_id as "orgId",
      m.user_id as "userId",
      m.role::text as "role",
      u.email as "userEmail"
    from public.memberships m
    join public.users u on u.id = m.user_id
    where m.id = ${membershipId}::uuid
    limit 1
  `;
  return row ?? null;
}

async function countOwners(orgId: string): Promise<number> {
  const sql = getSql()!;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n
    from public.memberships
    where org_id = ${orgId}::uuid and role = 'org_owner'
  `;
  return row?.n ?? 0;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const { membershipId } = await params;
    const body = (await request.json().catch(() => ({}))) as RoleBody;
    if (!body.role || !ALLOWED_ROLES.includes(body.role)) {
      return jsonError("Valid role is required.", 400);
    }

    const membership = await loadMembership(membershipId);
    if (!membership) return jsonError("Membership not found.", 404);

    const actor = await requireRole(membership.orgId, "users:invite", userId);

    if (actor.role !== "org_owner" && actor.role !== "org_admin") {
      return jsonError(
        "Forbidden: only organization owners/admins can change roles.",
        403,
      );
    }

    if (membership.role === "org_owner" && body.role !== "org_owner") {
      const owners = await countOwners(membership.orgId);
      if (owners <= 1) {
        return jsonError(
          "Cannot demote the last organization owner. Promote another member first.",
          400,
        );
      }
    }

    const sql = getSql()!;
    const [updated] = await sql<{ id: string; role: string }[]>`
      update public.memberships
      set role = ${body.role}::public.membership_role
      where id = ${membershipId}::uuid
      returning id, role::text as "role"
    `;

    await logAudit({
      orgId: membership.orgId,
      actorAuthSubject: userId,
      action: "member.role_changed",
      resourceType: "membership",
      resourceId: membership.membershipId,
      metadata: {
        fromRole: membership.role,
        toRole: updated.role,
        userEmail: membership.userEmail,
      },
    });

    return NextResponse.json({ ok: true, membershipId: updated.id, role: updated.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const { membershipId } = await params;
    const membership = await loadMembership(membershipId);
    if (!membership) return jsonError("Membership not found.", 404);

    const actor = await requireRole(membership.orgId, "users:invite", userId);

    if (actor.role !== "org_owner" && actor.role !== "org_admin") {
      return jsonError(
        "Forbidden: only organization owners/admins can remove members.",
        403,
      );
    }

    if (membership.role === "org_owner") {
      const owners = await countOwners(membership.orgId);
      if (owners <= 1) {
        return jsonError(
          "Cannot remove the last organization owner. Transfer ownership first.",
          400,
        );
      }
    }

    const sql = getSql()!;
    await sql`
      delete from public.memberships where id = ${membershipId}::uuid
    `;

    await logAudit({
      orgId: membership.orgId,
      actorAuthSubject: userId,
      action: "member.removed",
      resourceType: "membership",
      resourceId: membership.membershipId,
      metadata: {
        removedRole: membership.role,
        userEmail: membership.userEmail,
      },
    });

    return NextResponse.json({ ok: true, membershipId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

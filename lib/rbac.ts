import { getSql } from "@/lib/db";

export type MembershipRole =
  | "org_owner"
  | "org_admin"
  | "content_manager"
  | "support_agent"
  | "support_lead"
  | "viewer";

export type Permission =
  | "admin:access"
  | "users:read"
  | "users:invite"
  | "kb:read"
  | "kb:write"
  | "billing:read";

export type MembershipContext = {
  userId: string;
  email: string;
  orgId: string;
  orgName: string;
  role: MembershipRole;
};

const rolePermissions: Record<MembershipRole, Permission[]> = {
  org_owner: ["admin:access", "users:read", "users:invite", "kb:read", "kb:write", "billing:read"],
  org_admin: ["admin:access", "users:read", "users:invite", "kb:read", "kb:write", "billing:read"],
  content_manager: ["admin:access", "kb:read", "kb:write"],
  support_lead: ["admin:access", "kb:read"],
  support_agent: ["admin:access", "kb:read"],
  viewer: ["admin:access", "users:read", "kb:read"],
};

function hasPermission(role: MembershipRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export async function getPrimaryMembership(authSubject: string): Promise<MembershipContext> {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not set.");
  }

  const [row] = await sql<MembershipContext[]>`
    select
      u.id as "userId",
      u.email as "email",
      m.org_id as "orgId",
      o.name as "orgName",
      m.role::text as "role"
    from public.users u
    join public.memberships m on m.user_id = u.id
    join public.orgs o on o.id = m.org_id
    where u.auth_subject = ${authSubject}
    order by m.created_at asc
    limit 1
  `;

  if (!row) {
    throw new Error("No organization membership found for this account.");
  }

  return row;
}

export async function listMemberships(authSubject: string): Promise<MembershipContext[]> {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not set.");
  }

  return sql<MembershipContext[]>`
    select
      u.id as "userId",
      u.email as "email",
      m.org_id as "orgId",
      o.name as "orgName",
      m.role::text as "role"
    from public.users u
    join public.memberships m on m.user_id = u.id
    join public.orgs o on o.id = m.org_id
    where u.auth_subject = ${authSubject}
    order by m.created_at asc
  `;
}

export async function resolveOrgContext(authSubject: string, requestedOrgId?: string | null) {
  const memberships = await listMemberships(authSubject);
  if (!memberships.length) {
    throw new Error("No organization membership found for this account.");
  }

  if (!requestedOrgId) {
    return memberships[0];
  }

  const selected = memberships.find((m) => m.orgId === requestedOrgId);
  if (!selected) {
    throw new Error("Requested organization is not accessible by this account.");
  }
  return selected;
}

export async function requireRole(orgId: string, permission: Permission, authSubject: string) {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not set.");
  }

  const [row] = await sql<MembershipContext[]>`
    select
      u.id as "userId",
      u.email as "email",
      m.org_id as "orgId",
      o.name as "orgName",
      m.role::text as "role"
    from public.users u
    join public.memberships m on m.user_id = u.id
    join public.orgs o on o.id = m.org_id
    where u.auth_subject = ${authSubject}
      and m.org_id = ${orgId}::uuid
    limit 1
  `;

  if (!row) {
    throw new Error("Membership not found for requested organization.");
  }

  if (!hasPermission(row.role, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}" for role "${row.role}".`);
  }

  return row;
}

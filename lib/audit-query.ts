/**
 * Read-side queries over public.audit_logs.
 *
 * Always scoped to a single org_id. The /admin/audit server component is
 * responsible for resolving the caller's org and for RBAC; this module
 * just shapes SQL and the response.
 */

import type { getSql } from "@/lib/db";

type Sql = NonNullable<ReturnType<typeof getSql>>;

export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  actorUserId: string | null;
  actorEmail: string | null;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  totalCount: number;
  pageSize: number;
  page: number;
  totalPages: number;
  distinctActions: string[];
};

export type AuditLogQuery = {
  days?: number;
  action?: string | null;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_DAYS = 365;

export async function loadAuditLog(
  sql: Sql,
  orgId: string,
  query: AuditLogQuery = {},
): Promise<AuditLogPage> {
  const days =
    Number.isFinite(query.days) && (query.days as number) > 0
      ? Math.min(query.days as number, MAX_DAYS)
      : 30;

  const pageSize =
    Number.isFinite(query.pageSize) && (query.pageSize as number) > 0
      ? Math.min(query.pageSize as number, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const page =
    Number.isFinite(query.page) && (query.page as number) >= 0
      ? Math.floor(query.page as number)
      : 0;

  const action = query.action && query.action.trim() ? query.action.trim() : null;
  const offset = page * pageSize;

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.audit_logs
    where org_id = ${orgId}::uuid
      and created_at >= now() - (${days}::int * interval '1 day')
      ${action ? sql`and action = ${action}` : sql``}
  `;

  const rows = await sql<
    {
      id: string;
      createdAt: Date;
      action: string;
      resourceType: string;
      resourceId: string | null;
      metadata: Record<string, unknown> | null;
      actorUserId: string | null;
      actorEmail: string | null;
    }[]
  >`
    select
      al.id,
      al.created_at         as "createdAt",
      al.action,
      al.resource_type      as "resourceType",
      al.resource_id        as "resourceId",
      al.metadata,
      al.actor_user_id      as "actorUserId",
      u.email               as "actorEmail"
    from public.audit_logs al
    left join public.users u on u.id = al.actor_user_id
    where al.org_id = ${orgId}::uuid
      and al.created_at >= now() - (${days}::int * interval '1 day')
      ${action ? sql`and al.action = ${action}` : sql``}
    order by al.created_at desc
    limit ${pageSize}
    offset ${offset}
  `;

  const distinctActions = await sql<{ action: string }[]>`
    select distinct action
    from public.audit_logs
    where org_id = ${orgId}::uuid
      and created_at >= now() - (${days}::int * interval '1 day')
    order by action asc
  `;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      metadata: r.metadata ?? {},
      actorUserId: r.actorUserId,
      actorEmail: r.actorEmail,
    })),
    totalCount: count,
    pageSize,
    page,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
    distinctActions: distinctActions.map((a) => a.action),
  };
}

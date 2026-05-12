import { getSql } from "@/lib/db";

export type AuditAction =
  | "org.created"
  | "org.updated"
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "invitation.accepted"
  | "invitation.revoked"
  | "ingest.started"
  | "ingest.completed"
  | "ingest.failed"
  | "kb_file.deleted";

type LogParams = {
  orgId: string | null;
  actorAuthSubject?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append a row to public.audit_logs. Resolves the actor's user UUID from
 * `auth_subject` when provided. Errors are swallowed and logged to stderr so
 * that an audit failure never breaks a primary admin action.
 */
export async function logAudit(params: LogParams): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  try {
    let actorUserId: string | null = null;
    if (params.actorAuthSubject) {
      const [row] = await sql<{ id: string }[]>`
        select id from public.users where auth_subject = ${params.actorAuthSubject} limit 1
      `;
      actorUserId = row?.id ?? null;
    }

    await sql`
      insert into public.audit_logs
        (org_id, actor_user_id, action, resource_type, resource_id, metadata)
      values (
        ${params.orgId}::uuid,
        ${actorUserId}::uuid,
        ${params.action},
        ${params.resourceType},
        ${params.resourceId ?? null},
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      )
    `;
  } catch (error) {
    console.error("[audit] failed to write audit log", {
      action: params.action,
      orgId: params.orgId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

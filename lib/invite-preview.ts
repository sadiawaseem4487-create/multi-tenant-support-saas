import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";

export type InvitePreview = {
  email: string;
  role: string;
  orgName: string;
  orgId: string;
  expiresAt: string;
};

/** Read invitation metadata from token (does not accept or mutate). */
export async function lookupInviteByToken(token: string): Promise<InvitePreview | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const sql = getSql();
  if (!sql) return null;

  const tokenHash = createHash("sha256").update(trimmed).digest("hex");

  const [row] = await sql<InvitePreview[]>`
    select
      lower(i.email) as email,
      i.role::text as role,
      o.name as "orgName",
      i.org_id as "orgId",
      to_char(i.expires_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "expiresAt"
    from public.invitations i
    join public.orgs o on o.id = i.org_id
    where i.token_hash = ${tokenHash}
      and i.accepted_at is null
      and i.expires_at > now()
    limit 1
  `;

  return row ?? null;
}

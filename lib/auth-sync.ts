import { getSql } from "@/lib/db";

const DEFAULT_BOOTSTRAP_SLUG = "demo-company";
const DEFAULT_BOOTSTRAP_NAME = "Demo organization";

type EnsureParams = {
  authSubject: string;
  email: string | null | undefined;
  displayName: string | null | undefined;
};

/**
 * Upserts `public.users` from Clerk and ensures a membership in the bootstrap org
 * when the user has none (first admin login).
 */
export async function ensureTenantAccess(params: EnsureParams) {
  const sql = getSql();
  if (!sql) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres connection string (e.g. Supabase pooler) to .env.local.",
    );
  }

  const email = params.email?.trim();
  if (!email) {
    throw new Error(
      "Your Clerk account needs a primary email so we can store it in the app database.",
    );
  }

  const displayName = params.displayName?.trim() || null;
  const normalizedEmail = email.toLowerCase();
  const slug = process.env.BOOTSTRAP_ORG_SLUG ?? DEFAULT_BOOTSTRAP_SLUG;
  const orgName = process.env.BOOTSTRAP_ORG_NAME ?? DEFAULT_BOOTSTRAP_NAME;

  await sql.begin(async (tx) => {
    const [bySubject] = await tx<{ id: string }[]>`
      select id
      from public.users
      where auth_subject = ${params.authSubject}
      limit 1
    `;

    const [byEmail] = await tx<{ id: string; authSubject: string | null }[]>`
      select id, auth_subject as "authSubject"
      from public.users
      where lower(email) = ${normalizedEmail}
      limit 1
    `;

    let userRow: { id: string } | undefined;
    if (bySubject) {
      [userRow] = await tx<{ id: string }[]>`
        update public.users
        set
          email = ${email},
          display_name = coalesce(${displayName}, display_name),
          auth_provider = 'clerk',
          updated_at = now()
        where id = ${bySubject.id}::uuid
        returning id
      `;
    } else if (byEmail) {
      [userRow] = await tx<{ id: string }[]>`
        update public.users
        set
          auth_provider = 'clerk',
          auth_subject = ${params.authSubject},
          email = ${email},
          display_name = coalesce(${displayName}, display_name),
          updated_at = now()
        where id = ${byEmail.id}::uuid
        returning id
      `;
    } else {
      [userRow] = await tx<{ id: string }[]>`
        insert into public.users (email, display_name, auth_provider, auth_subject)
        values (${email}, ${displayName}, 'clerk', ${params.authSubject})
        returning id
      `;
    }

    if (!userRow) {
      throw new Error("Failed to upsert application user.");
    }

    const [membershipRow] = await tx<{ n: number }[]>`
      select count(*)::int as n
      from public.memberships
      where user_id = ${userRow.id}
    `;

    if ((membershipRow?.n ?? 0) > 0) {
      return;
    }

    await tx`
      insert into public.orgs (name, slug, plan)
      values (${orgName}, ${slug}, 'free')
      on conflict (slug) do nothing
    `;

    const [org] = await tx<{ id: string }[]>`
      select id from public.orgs where slug = ${slug}
    `;

    if (!org) {
      throw new Error(`Bootstrap org slug "${slug}" is missing after insert.`);
    }

    await tx`
      insert into public.memberships (org_id, user_id, role)
      values (${org.id}, ${userRow.id}, 'org_owner')
      on conflict (org_id, user_id) do nothing
    `;
  });
}

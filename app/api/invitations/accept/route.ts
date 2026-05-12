import { auth, currentUser } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type AcceptPayload = {
  token?: string;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as AcceptPayload;
    const token = payload.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }

    const clerkUser = await currentUser();
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "Signed-in account has no email." }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const normalizedEmail = email.toLowerCase();
    const displayName = clerkUser?.fullName ?? clerkUser?.firstName ?? null;

    const result = await sql.begin(async (tx) => {
      const [invite] = await tx<{
        id: string;
        orgId: string;
        orgName: string;
        role: "org_owner" | "org_admin" | "content_manager" | "support_agent" | "support_lead" | "viewer";
        email: string;
      }[]>`
        select
          i.id,
          i.org_id as "orgId",
          o.name as "orgName",
          i.role::text as "role",
          i.email
        from public.invitations i
        join public.orgs o on o.id = i.org_id
        where i.token_hash = ${tokenHash}
          and i.accepted_at is null
          and i.expires_at > now()
        limit 1
      `;

      if (!invite) {
        throw new Error("Invitation is invalid or expired.");
      }
      if (invite.email.toLowerCase() !== normalizedEmail) {
        throw new Error("Invitation email does not match the signed-in account.");
      }

      const [bySubject] = await tx<{ id: string }[]>`
        select id from public.users where auth_subject = ${userId} limit 1
      `;
      const [byEmail] = await tx<{ id: string }[]>`
        select id from public.users where lower(email) = ${normalizedEmail} limit 1
      `;

      let appUserId: string | null = null;
      if (bySubject) {
        const [updated] = await tx<{ id: string }[]>`
          update public.users
          set
            email = ${email},
            display_name = coalesce(${displayName}, display_name),
            auth_provider = 'clerk',
            updated_at = now()
          where id = ${bySubject.id}::uuid
          returning id
        `;
        appUserId = updated?.id ?? null;
      } else if (byEmail) {
        const [updated] = await tx<{ id: string }[]>`
          update public.users
          set
            auth_subject = ${userId},
            auth_provider = 'clerk',
            display_name = coalesce(${displayName}, display_name),
            updated_at = now()
          where id = ${byEmail.id}::uuid
          returning id
        `;
        appUserId = updated?.id ?? null;
      } else {
        const [created] = await tx<{ id: string }[]>`
          insert into public.users (email, display_name, auth_provider, auth_subject)
          values (${email}, ${displayName}, 'clerk', ${userId})
          returning id
        `;
        appUserId = created?.id ?? null;
      }

      if (!appUserId) {
        throw new Error("Could not create or update user.");
      }

      await tx`
        insert into public.memberships (org_id, user_id, role)
        values (${invite.orgId}::uuid, ${appUserId}::uuid, ${invite.role}::public.membership_role)
        on conflict (org_id, user_id) do update
          set role = excluded.role
      `;

      await tx`
        update public.invitations
        set accepted_at = now()
        where id = ${invite.id}::uuid
      `;

      return {
        invitationId: invite.id,
        orgId: invite.orgId,
        orgName: invite.orgName,
        role: invite.role,
      };
    });

    await logAudit({
      orgId: result.orgId,
      actorAuthSubject: userId,
      action: "invitation.accepted",
      resourceType: "invitation",
      resourceId: result.invitationId,
      metadata: { role: result.role, email: normalizedEmail },
    });

    return NextResponse.json({
      ok: true,
      orgId: result.orgId,
      orgName: result.orgName,
      role: result.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

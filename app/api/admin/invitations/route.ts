import { auth } from "@clerk/nextjs/server";
import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrimaryMembership, requireRole, type MembershipRole } from "@/lib/rbac";
import { getSql } from "@/lib/db";

const allowedRoles: MembershipRole[] = [
  "org_owner",
  "org_admin",
  "content_manager",
  "support_agent",
  "support_lead",
  "viewer",
];

type InvitePayload = {
  email?: string;
  role?: MembershipRole;
};

type InviteWebhookPayload = {
  invitationId: string | null;
  orgId: string;
  orgName: string;
  appBaseUrl: string;
  invitedEmail: string;
  role: MembershipRole;
  inviteToken: string;
  expiresAt: string | null;
  invitedByUserId: string;
  invitedByEmail: string;
};

function getAppBaseUrl(request: Request) {
  const configured =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

async function notifyInviteWebhook(payload: InviteWebhookPayload) {
  const inviteWebhookUrl = process.env.INVITE_WEBHOOK_URL?.trim();
  if (!inviteWebhookUrl) {
    return { delivered: false as const, reason: "INVITE_WEBHOOK_URL not set" };
  }

  const webhookSecret = process.env.WEBHOOK_SECRET?.trim();
  const response = await fetch(inviteWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Invite webhook failed (${response.status}): ${raw.slice(0, 300)}`);
  }

  return { delivered: true as const };
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as InvitePayload;
    const email = body.email?.trim().toLowerCase();
    const role = body.role;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
    }

    const membership = await getPrimaryMembership(userId);
    const actor = await requireRole(membership.orgId, "users:invite", userId);
    const appBaseUrl = getAppBaseUrl(request);

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const [invitation] = await sql<{ id: string; expiresAt: string }[]>`
      with deleted as (
        delete from public.invitations
        where org_id = ${membership.orgId}::uuid
          and lower(email) = ${email}
          and accepted_at is null
      )
      insert into public.invitations (org_id, email, role, token_hash, expires_at, invited_by)
      values (
        ${membership.orgId}::uuid,
        ${email},
        ${role}::public.membership_role,
        ${tokenHash},
        now() + interval '7 days',
        ${actor.userId}::uuid
      )
      returning id, to_char(expires_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "expiresAt"
    `;

    let emailDelivery:
      | { delivered: true; reason?: never }
      | { delivered: false; reason: string } = { delivered: false, reason: "Skipped" };

    try {
      emailDelivery = await notifyInviteWebhook({
        invitationId: invitation?.id ?? null,
        orgId: membership.orgId,
        orgName: membership.orgName,
        appBaseUrl,
        invitedEmail: email,
        role,
        inviteToken: rawToken,
        expiresAt: invitation?.expiresAt ?? null,
        invitedByUserId: actor.userId,
        invitedByEmail: actor.email,
      });
    } catch (webhookError) {
      emailDelivery = {
        delivered: false,
        reason:
          webhookError instanceof Error
            ? webhookError.message
            : "Invite saved, but webhook delivery failed.",
      };
    }

    return NextResponse.json({
      invitationId: invitation?.id ?? null,
      invitedEmail: email,
      role,
      expiresAt: invitation?.expiresAt ?? null,
      inviteToken: rawToken,
      emailDelivery,
      note: "Acceptance flow is next sprint work.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

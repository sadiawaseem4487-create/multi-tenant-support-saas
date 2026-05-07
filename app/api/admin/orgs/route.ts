import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { listMemberships, resolveOrgContext } from "@/lib/rbac";

type CreateOrgPayload = {
  name?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const selected = await resolveOrgContext(userId, orgId);
    const memberships = await listMemberships(userId);

    return NextResponse.json({
      selectedOrgId: selected.orgId,
      selectedOrgName: selected.orgName,
      memberships: memberships.map((m) => ({
        orgId: m.orgId,
        orgName: m.orgName,
        role: m.role,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateOrgPayload;
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const [appUser] = await sql<{ id: string }[]>`
      select id from public.users where auth_subject = ${userId} limit 1
    `;
    if (!appUser) {
      return NextResponse.json({ error: "Application user record was not found." }, { status: 404 });
    }

    const baseSlug = slugify(name) || "organization";
    let createdOrgId: string | null = null;
    let createdSlug: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const suffix = randomBytes(2).toString("hex");
      const slug = `${baseSlug}-${suffix}`;
      const [created] = await sql<{ id: string; slug: string }[]>`
        insert into public.orgs (name, slug, plan)
        values (${name}, ${slug}, 'free')
        on conflict (slug) do nothing
        returning id, slug
      `;
      if (created) {
        createdOrgId = created.id;
        createdSlug = created.slug;
        break;
      }
    }

    if (!createdOrgId) {
      return NextResponse.json(
        { error: "Failed to create organization slug. Please retry." },
        { status: 500 },
      );
    }

    await sql`
      insert into public.memberships (org_id, user_id, role)
      values (${createdOrgId}::uuid, ${appUser.id}::uuid, 'org_owner')
      on conflict (org_id, user_id) do nothing
    `;

    const memberships = await listMemberships(userId);
    return NextResponse.json({
      createdOrgId,
      createdSlug,
      memberships: memberships.map((m) => ({
        orgId: m.orgId,
        orgName: m.orgName,
        role: m.role,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

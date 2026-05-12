import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

type SettingsBody = {
  orgId?: string;
  name?: string;
  siteSlug?: string | null;
  brandName?: string | null;
  brandTagline?: string | null;
  brandLogoUrl?: string | null;
};

type OrgSettingsRow = {
  id: string;
  name: string;
  slug: string;
  siteSlug: string | null;
  plan: string;
  settings: Record<string, unknown> | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const orgId = new URL(request.url).searchParams.get("orgId");
    const context = await resolveOrgContext(userId, orgId);
    await requireRole(context.orgId, "admin:access", userId);

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const [row] = await sql<OrgSettingsRow[]>`
      select id, name, slug, site_slug as "siteSlug", plan, settings
      from public.orgs
      where id = ${context.orgId}::uuid
      limit 1
    `;
    if (!row) return jsonError("Organization not found.", 404);

    return NextResponse.json({
      orgId: row.id,
      name: row.name,
      slug: row.slug,
      siteSlug: row.siteSlug,
      plan: row.plan,
      branding: {
        brandName: (row.settings?.brandName as string | undefined) ?? null,
        brandTagline: (row.settings?.brandTagline as string | undefined) ?? null,
        brandLogoUrl: (row.settings?.brandLogoUrl as string | undefined) ?? null,
      },
      role: context.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const body = (await request.json().catch(() => ({}))) as SettingsBody;
    const context = await resolveOrgContext(userId, body.orgId ?? null);

    const actor = await requireRole(context.orgId, "admin:access", userId);
    if (actor.role !== "org_owner" && actor.role !== "org_admin") {
      return jsonError(
        "Forbidden: only organization owners/admins can change settings.",
        403,
      );
    }

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const name = body.name?.trim();
    if (name !== undefined && (!name || name.length > 120)) {
      return jsonError("Name must be 1-120 characters.", 400);
    }

    let normalizedSiteSlug: string | null | undefined;
    if (body.siteSlug !== undefined) {
      if (body.siteSlug === null || body.siteSlug === "") {
        normalizedSiteSlug = null;
      } else {
        const candidate = slugify(body.siteSlug);
        if (!candidate || candidate.length < 3) {
          return jsonError(
            "Site slug must be at least 3 characters of [a-z 0-9 -].",
            400,
          );
        }
        const [conflict] = await sql<{ id: string }[]>`
          select id from public.orgs
          where site_slug = ${candidate} and id <> ${context.orgId}::uuid
          limit 1
        `;
        if (conflict) {
          return jsonError("That site slug is already in use.", 409);
        }
        normalizedSiteSlug = candidate;
      }
    }

    const brandUpdates: Record<string, string | null> = {};
    if (body.brandName !== undefined) {
      brandUpdates.brandName =
        body.brandName === null ? null : body.brandName.trim().slice(0, 80) || null;
    }
    if (body.brandTagline !== undefined) {
      brandUpdates.brandTagline =
        body.brandTagline === null ? null : body.brandTagline.trim().slice(0, 160) || null;
    }
    if (body.brandLogoUrl !== undefined) {
      const value = body.brandLogoUrl;
      if (value && value.trim()) {
        try {
          new URL(value.trim());
        } catch {
          return jsonError("Brand logo URL must be a valid URL.", 400);
        }
        brandUpdates.brandLogoUrl = value.trim().slice(0, 2048);
      } else {
        brandUpdates.brandLogoUrl = null;
      }
    }

    const [updated] = await sql<OrgSettingsRow[]>`
      update public.orgs
      set
        name = coalesce(${name ?? null}, name),
        site_slug = case when ${normalizedSiteSlug !== undefined}::boolean
                         then ${normalizedSiteSlug ?? null}::text
                         else site_slug end,
        settings = coalesce(settings, '{}'::jsonb) || ${JSON.stringify(brandUpdates)}::jsonb,
        updated_at = now()
      where id = ${context.orgId}::uuid
      returning id, name, slug, site_slug as "siteSlug", plan, settings
    `;

    if (!updated) return jsonError("Organization not found.", 404);

    await logAudit({
      orgId: updated.id,
      actorAuthSubject: userId,
      action: "org.updated",
      resourceType: "org",
      resourceId: updated.id,
      metadata: {
        nameChanged: name !== undefined,
        siteSlugChanged: normalizedSiteSlug !== undefined,
        brandingKeys: Object.keys(brandUpdates),
      },
    });

    return NextResponse.json({
      orgId: updated.id,
      name: updated.name,
      slug: updated.slug,
      siteSlug: updated.siteSlug,
      plan: updated.plan,
      branding: {
        brandName: (updated.settings?.brandName as string | undefined) ?? null,
        brandTagline: (updated.settings?.brandTagline as string | undefined) ?? null,
        brandLogoUrl: (updated.settings?.brandLogoUrl as string | undefined) ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

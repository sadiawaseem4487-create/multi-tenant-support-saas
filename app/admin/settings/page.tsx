import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { resolveOrgContext } from "@/lib/rbac";
import { OrgSettingsForm } from "@/components/admin/OrgSettingsForm";
import { readChatConfig } from "@/lib/chat-config";

type SettingsRow = {
  id: string;
  name: string;
  slug: string;
  siteSlug: string | null;
  plan: string;
  settings: Record<string, unknown> | null;
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { orgId } = await searchParams;
  const context = await resolveOrgContext(user.id, orgId);

  const canEdit = context.role === "org_owner" || context.role === "org_admin";

  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set.");

  const [row] = await sql<SettingsRow[]>`
    select id, name, slug, site_slug as "siteSlug", plan, settings
    from public.orgs
    where id = ${context.orgId}::uuid
    limit 1
  `;
  if (!row) throw new Error("Organization not found.");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Organization settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Branding and public site configuration for{" "}
          <span className="font-medium text-slate-800">{row.name}</span>.
        </p>
      </div>

      <OrgSettingsForm
        orgId={row.id}
        canEdit={canEdit}
        initial={{
          name: row.name,
          slug: row.slug,
          plan: row.plan,
          siteSlug: row.siteSlug,
          brandName: (row.settings?.brandName as string | undefined) ?? "",
          brandTagline: (row.settings?.brandTagline as string | undefined) ?? "",
          brandLogoUrl: (row.settings?.brandLogoUrl as string | undefined) ?? "",
          brandPrimaryColor:
            (row.settings?.brandPrimaryColor as string | undefined) ?? "",
          chat: readChatConfig(
            row.settings?.chat,
            (row.settings?.brandName as string | undefined) ?? row.name,
          ),
        }}
      />
    </section>
  );
}

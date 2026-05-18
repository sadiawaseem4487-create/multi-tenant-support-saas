import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { listMemberships, resolveOrgContext } from "@/lib/rbac";
import { loadAnalytics } from "@/lib/analytics";
import { loadKbStatus } from "@/lib/kb-status";

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
  "https://multi-tenant-support-saas.vercel.app";

type DemoStep = {
  title: string;
  say: string;
  href?: string;
  hrefLabel?: string;
  adminPath?: string;
};

export default async function AdminPresentPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { orgId } = await searchParams;
  const context = await resolveOrgContext(user.id, orgId);
  const orgQuery = `orgId=${encodeURIComponent(context.orgId)}`;

  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set.");

  const [org] = await sql<
    {
      name: string;
      slug: string;
      siteSlug: string | null;
      plan: string;
    }[]
  >`
    select name, slug, site_slug as "siteSlug", plan
    from public.orgs
    where id = ${context.orgId}::uuid
    limit 1
  `;
  if (!org) throw new Error("Organization not found.");

  const kb = await loadKbStatus(sql, context.orgId);
  const week = await loadAnalytics(sql, context.orgId, 7);

  const memberships = await listMemberships(user.id);
  const otherOrgs = await sql<
    { id: string; name: string; siteSlug: string | null; slug: string }[]
  >`
    select id, name, site_slug as "siteSlug", slug
    from public.orgs
    where id = any(${memberships.map((m) => m.orgId)}::uuid[])
    order by name asc
  `;

  const siteSlug = org.siteSlug ?? org.slug;
  const otherTenantSites = otherOrgs
    .filter((o) => o.id !== context.orgId)
    .map((o) => {
      const slug = o.siteSlug ?? o.slug;
      return {
        orgId: o.id,
        name: o.name,
        publicSiteUrl: `${APP_ORIGIN}/site/${slug}`,
        presentUrl: `/admin/present?orgId=${encodeURIComponent(o.id)}`,
      };
    });
  const publicSiteUrl = `${APP_ORIGIN}/site/${siteSlug}`;
  const embedUrl = `${APP_ORIGIN}/embed/${siteSlug}`;
  const embedScript = `<script src="${APP_ORIGIN}/embed.js" data-site-slug="${siteSlug}" async></script>`;

  const steps: DemoStep[] = [
    {
      title: "1. Multi-tenant admin",
      say: "Each company gets its own workspace. Roles control who can manage KB, members, and settings.",
      adminPath: `/admin?${orgQuery}`,
      hrefLabel: "Open admin home",
    },
    {
      title: "2. Branded public chat",
      say:
        siteSlug === "demo-company"
          ? "This demo tenant uses the NovaMart sample knowledge base. Say: each organization has its own URL and KB — switch org in admin to show Art craft vs NovaMart."
          : "Visitors use a branded URL — no login. Answers come only from this org's knowledge base.",
      href: publicSiteUrl,
      hrefLabel: "Open public site",
    },
    {
      title: "3. Ask a real question",
      say: kb.totalChunks > 0
        ? `Try a question your KB can answer (${kb.totalChunks} chunks indexed). Show fallback if you ask something off-topic.`
        : "Upload KB content first — without chunks the bot only returns the fallback message.",
      href: publicSiteUrl,
      hrefLabel: "Open chat",
    },
    {
      title: "4. Knowledge & ingest",
      say: "Documents are chunked per org. Ingest jobs show success/failure in the admin UI.",
      adminPath: `/admin/knowledge?${orgQuery}`,
      hrefLabel: "Knowledge base",
    },
    {
      title: "5. Analytics & audit",
      say: "Every chat turn is logged. Show Analytics, then Audit log for invites and settings changes.",
      adminPath: `/admin/analytics?${orgQuery}`,
      hrefLabel: "Analytics",
    },
    {
      title: "6. Embed on any website",
      say: "One script tag loads a floating widget — still scoped to this tenant.",
      href: embedUrl,
      hrefLabel: "Preview embed",
    },
  ];

  const readiness = [
    { ok: Boolean(org.siteSlug ?? org.slug), label: "Public site slug" },
    { ok: kb.totalChunks > 0, label: "Knowledge indexed" },
    { ok: week.totals.totalMessages > 0, label: "Chat activity logged" },
    { ok: kb.lastSuccessfulIngestAt !== null, label: "Successful ingest" },
  ];
  const readyCount = readiness.filter((r) => r.ok).length;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Presentation mode
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">
          Demo script for {org.name}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Use this 5–7 minute flow when showing the multi-tenant SaaS to a professor,
          client, or investor. All links are scoped to{" "}
          <span className="font-medium">{org.name}</span>.
        </p>
        <p className="mt-3 text-sm font-medium text-slate-800">
          Demo readiness: {readyCount}/{readiness.length}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {readiness.map((r) => (
            <li
              key={r.label}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                r.ok
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {r.ok ? "✓" : "!"} {r.label}
            </li>
          ))}
        </ul>
      </div>


      {otherTenantSites.length > 0 ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Other tenants (isolation demo)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Switch org, open each public site, and ask the same question. Answers should
            differ per tenant.
          </p>
          <ul className="mt-4 space-y-3">
            {otherTenantSites.map((t) => (
              <li
                key={t.orgId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-900">{t.name}</span>
                <a
                  href={t.publicSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
                >
                  Public chat
                </a>
                <Link
                  href={t.presentUrl}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Present script
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Public site</dt>
            <dd>
              <a
                href={publicSiteUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-medium text-teal-800 underline-offset-2 hover:underline"
              >
                {publicSiteUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Embed preview</dt>
            <dd>
              <a
                href={embedUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-medium text-teal-800 underline-offset-2 hover:underline"
              >
                {embedUrl}
              </a>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Embed snippet</dt>
            <dd className="mt-1">
              <code className="block overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
                {embedScript}
              </code>
            </dd>
          </div>
        </dl>
      </div>

      <ol className="space-y-4">
        {steps.map((step) => (
          <li
            key={step.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.say}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.href ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
                >
                  {step.hrefLabel ?? "Open"} →
                </a>
              ) : null}
              {step.adminPath ? (
                <Link
                  href={step.adminPath}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {step.hrefLabel ?? "Admin"} →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Before production (not required for class demo)</p>
        <p className="mt-1 text-amber-800">
          Rotate n8n workflow secrets into Credentials — see{" "}
          <code className="rounded bg-white/80 px-1">docs/N8N_CREDENTIALS_SETUP.md</code>.
          Optional: add <code className="rounded bg-white/80 px-1">SENTRY_DSN</code> in
          Vercel for error alerts.
        </p>
      </div>
    </section>
  );
}

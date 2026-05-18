import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { resolveOrgContext } from "@/lib/rbac";
import { readChatConfig } from "@/lib/chat-config";
import { loadAnalytics } from "@/lib/analytics";

type OrgSnapshot = {
  id: string;
  name: string;
  slug: string;
  siteSlug: string | null;
  plan: string;
  settings: Record<string, unknown> | null;
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatMs(n: number | null): string {
  if (n === null) return "—";
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

type ChecklistItem = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
};

export default async function AdminHomePage({
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

  const [org] = await sql<OrgSnapshot[]>`
    select id, name, slug, site_slug as "siteSlug", plan, settings
    from public.orgs
    where id = ${context.orgId}::uuid
    limit 1
  `;
  if (!org) throw new Error("Organization not found.");

  const [{ chunkCount }] = await sql<{ chunkCount: number }[]>`
    select count(*)::int as "chunkCount"
    from public.documents
    where org_id = ${context.orgId}::uuid
  `;

  const [{ memberCount }] = await sql<{ memberCount: number }[]>`
    select count(*)::int as "memberCount"
    from public.memberships
    where org_id = ${context.orgId}::uuid
  `;

  const today = await loadAnalytics(sql, context.orgId, 1);
  const week = await loadAnalytics(sql, context.orgId, 7);

  const chat = readChatConfig(org.settings?.chat, org.name);
  const defaultChat = readChatConfig(null, org.name);

  const brandCustomized = Boolean(
    (org.settings?.brandName as string | undefined) ||
      (org.settings?.brandTagline as string | undefined) ||
      (org.settings?.brandLogoUrl as string | undefined) ||
      (org.settings?.brandPrimaryColor as string | undefined),
  );
  const chatCustomized =
    chat.assistantName !== defaultChat.assistantName ||
    chat.persona.trim().length > 0 ||
    chat.greeting !== defaultChat.greeting ||
    chat.fallbackMessage !== defaultChat.fallbackMessage ||
    chat.suggestions.join("|") !== defaultChat.suggestions.join("|");
  const checklist: ChecklistItem[] = [
    {
      key: "site_slug",
      label: "Publish a public site slug",
      hint: "Without it, anonymous visitors can't use the chat or the embed widget.",
      done: Boolean(org.siteSlug),
      href: `/admin/settings?${orgQuery}`,
      cta: org.siteSlug ? "Edit" : "Set up",
    },
    {
      key: "brand",
      label: "Customize your branding",
      hint: "Name, tagline, logo, primary color shown to your visitors.",
      done: brandCustomized,
      href: `/admin/settings?${orgQuery}`,
      cta: brandCustomized ? "Edit" : "Customize",
    },
    {
      key: "chat",
      label: "Customize your chatbot's voice",
      hint: "Assistant name, persona, greeting, suggestions, fallback message.",
      done: chatCustomized,
      href: `/admin/settings?${orgQuery}`,
      cta: chatCustomized ? "Edit" : "Customize",
    },
    {
      key: "kb",
      label: "Add knowledge to your KB",
      hint: chunkCount
        ? `${chunkCount} chunk${chunkCount === 1 ? "" : "s"} indexed.`
        : "Without content, the bot can only return the fallback message.",
      done: chunkCount > 0,
      href: `/admin/knowledge?${orgQuery}`,
      cta: chunkCount > 0 ? "Manage" : "Add documents",
    },
    {
      key: "embed",
      label: "Install the embed widget",
      hint: "One-line <script> tag for your customers' websites.",
      done: Boolean(org.siteSlug),
      href: `/admin/settings?${orgQuery}#embed`,
      cta: org.siteSlug ? "Copy snippet" : "Set slug first",
    },
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-teal-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Admin home
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">
          Welcome back, {user.firstName ?? "there"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;re working in <span className="font-medium">{org.name}</span>{" "}
          ({org.slug}) · <span className="font-medium">{context.role}</span> ·
          plan <span className="font-medium">{org.plan}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/present?${orgQuery}`}
            className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Presentation guide →
          </Link>
          {org.siteSlug ? (
            <Link
              href={`/site/${org.siteSlug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-teal-700"
            >
              View public site →
            </Link>
          ) : (
            <Link
              href={`/admin/settings?${orgQuery}`}
              className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200"
            >
              Set a site slug →
            </Link>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            {chunkCount} KB chunk{chunkCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            Setup checklist
          </h3>
          <p className="text-xs text-slate-500">
            {doneCount} / {totalCount} complete
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {checklist.map((item) => (
            <li
              key={item.key}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
                item.done
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    item.done
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 bg-white text-slate-400"
                  }`}
                  aria-hidden
                >
                  {item.done ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      item.done ? "text-emerald-900" : "text-slate-900"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </div>
              </div>
              <Link
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  item.done
                    ? "bg-white text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"
                    : "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                }`}
              >
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Today · questions"
          value={today.totals.totalMessages.toLocaleString()}
          hint={`${week.totals.totalMessages.toLocaleString()} in last 7 days`}
        />
        <StatCard
          label="Today · fallback rate"
          value={
            today.totals.totalMessages > 0
              ? formatPercent(today.totals.fallbackRate)
              : "—"
          }
          tone={today.totals.fallbackRate > 0.25 ? "warn" : "ok"}
          hint={`${today.totals.fallbackMessages} unanswered`}
        />
        <StatCard
          label="Today · avg response"
          value={formatMs(today.totals.avgResponseMs)}
          tone={
            (today.totals.avgResponseMs ?? 0) > 7000
              ? "warn"
              : today.totals.avgResponseMs === null
                ? "muted"
                : "ok"
          }
          hint="End-to-end through n8n"
        />
        <StatCard
          label="Today · visitors"
          value={today.totals.uniqueVisitors.toLocaleString()}
          hint="By hashed IP or user"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Quick actions
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAction
              title="Knowledge"
              subtitle="Add or remove files"
              href={`/admin/knowledge?${orgQuery}`}
              accent="from-teal-500 to-cyan-500"
            />
            <QuickAction
              title="Analytics"
              subtitle="Volume, fallbacks, topics"
              href={`/admin/analytics?${orgQuery}`}
              accent="from-sky-500 to-indigo-500"
            />
            <QuickAction
              title="Members"
              subtitle="Invite teammates"
              href={`/admin/members?${orgQuery}`}
              accent="from-violet-500 to-fuchsia-500"
            />
            <QuickAction
              title="Settings"
              subtitle="Branding & chat behavior"
              href={`/admin/settings?${orgQuery}`}
              accent="from-amber-500 to-rose-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Recent activity
            </h3>
            <Link
              href={`/admin/analytics?${orgQuery}`}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              View all →
            </Link>
          </div>
          {week.recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No chat traffic yet in the last 7 days. Ask a question via{" "}
              {org.siteSlug ? (
                <Link
                  href={`/site/${org.siteSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-700 underline-offset-2 hover:underline"
                >
                  /site/{org.siteSlug}
                </Link>
              ) : (
                "your public site"
              )}{" "}
              and reload.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {week.recent.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="line-clamp-1 max-w-[20rem] text-sm text-slate-800">
                      {r.question}
                    </p>
                    <div className="flex shrink-0 items-center gap-1 text-[11px]">
                      {r.status !== "ok" ? (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800">
                          {r.status}
                        </span>
                      ) : null}
                      {r.wasFallback ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                          fallback
                        </span>
                      ) : null}
                      <span className="text-slate-400">
                        {formatRelative(r.createdAt)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-700"
      : tone === "muted"
        ? "text-slate-400"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function QuickAction({
  title,
  subtitle,
  href,
  accent,
}: {
  title: string;
  subtitle: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${accent} opacity-20 transition group-hover:scale-110 group-hover:opacity-30`}
        aria-hidden
      />
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      <span className="mt-3 inline-block text-xs font-medium text-teal-700 transition group-hover:translate-x-0.5">
        Open →
      </span>
    </Link>
  );
}

import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { resolveOrgContext, requireRole } from "@/lib/rbac";
import { loadAuditLog } from "@/lib/audit-query";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function actionTone(action: string): string {
  if (action.startsWith("org.")) return "bg-sky-100 text-sky-800";
  if (action.startsWith("member.")) return "bg-indigo-100 text-indigo-800";
  if (action.startsWith("invitation.")) return "bg-violet-100 text-violet-800";
  if (action.startsWith("ingest.")) return "bg-teal-100 text-teal-800";
  if (action.startsWith("kb_file.")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-800";
}

function shortenId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    orgId?: string;
    days?: string;
    action?: string;
    page?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { orgId, days: daysParam, action: actionParam, page: pageParam } =
    await searchParams;

  const context = await resolveOrgContext(user.id, orgId);

  try {
    await requireRole(context.orgId, "users:read", user.id);
  } catch {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-amber-900">
            No access to audit log
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Your current role in <strong>{context.orgName}</strong> does not
            include the permission required to view audit events.
          </p>
        </div>
      </section>
    );
  }

  const rawDays = parseInt(daysParam ?? "30", 10);
  const days =
    Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;

  const action = actionParam && actionParam.trim() ? actionParam.trim() : null;

  const rawPage = parseInt(pageParam ?? "0", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;

  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set.");

  const result = await loadAuditLog(sql, context.orgId, {
    days,
    action,
    page,
    pageSize: 25,
  });

  const baseQuery = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    params.set("orgId", context.orgId);
    params.set("days", String(days));
    if (action) params.set("action", action);
    if (page > 0) params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, String(v));
    }
    return `/admin/audit?${params.toString()}`;
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Audit log</h2>
            <p className="mt-1 text-sm text-slate-600">
              Security-relevant events for{" "}
              <span className="font-medium">{context.orgName}</span>: settings
              changes, member updates, invitations, knowledge-base actions, and
              ingest runs. All entries are scoped to this organization.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <a
              href={`/api/admin/audit/export?orgId=${encodeURIComponent(context.orgId)}&days=${days}${action ? `&action=${encodeURIComponent(action)}` : ""}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Export CSV
            </a>
            <div className="flex flex-wrap justify-end gap-1.5">
              {WINDOWS.map((w) => {
                const isActive = w.days === days;
                return (
                  <Link
                    key={w.days}
                    href={baseQuery({ days: w.days, page: null })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {w.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {result.distinctActions.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Filter
            </span>
            <Link
              href={baseQuery({ action: null, page: null })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                !action
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All
            </Link>
            {result.distinctActions.map((a) => {
              const isActive = a === action;
              return (
                <Link
                  key={a}
                  href={baseQuery({ action: a, page: null })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : `${actionTone(a)} hover:opacity-80`
                  }`}
                >
                  {a}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-baseline justify-between border-b border-slate-100 p-4">
          <h3 className="text-base font-semibold text-slate-900">
            {result.totalCount.toLocaleString()} event
            {result.totalCount === 1 ? "" : "s"}
            {action ? (
              <span className="ml-1 text-sm font-normal text-slate-500">
                · filtered to{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  {action}
                </code>
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-slate-500">
            Page {result.page + 1} of {result.totalPages}
          </p>
        </div>

        {result.totalCount === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600">
              No audit events
              {action ? (
                <>
                  {" "}
                  matching <code className="rounded bg-slate-100 px-1">{action}</code>{" "}
                </>
              ) : (
                " "
              )}
              in the last {days} day{days === 1 ? "" : "s"}.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Try changing org settings, inviting a member, or uploading a file —
              activity will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Actor</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Resource</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      <div className="font-medium">
                        {formatRelative(row.createdAt)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatTimestamp(row.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {row.actorEmail ? (
                        <span className="break-all">{row.actorEmail}</span>
                      ) : (
                        <span className="text-slate-400">system</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${actionTone(row.action)}`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {row.resourceType}
                      </div>
                      <code className="text-[11px] text-slate-600">
                        {shortenId(row.resourceId)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <MetadataCell metadata={row.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <div className="text-xs text-slate-500">
              Showing {result.page * result.pageSize + 1}–
              {Math.min(
                (result.page + 1) * result.pageSize,
                result.totalCount,
              )}{" "}
              of {result.totalCount.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              {result.page > 0 ? (
                <Link
                  href={baseQuery({ page: result.page - 1 })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  ← Newer
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">
                  ← Newer
                </span>
              )}
              {result.page + 1 < result.totalPages ? (
                <Link
                  href={baseQuery({ page: result.page + 1 })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Older →
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300">
                  Older →
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetadataCell({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const keys = Object.keys(metadata);
  if (keys.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const summaryKeys = keys.slice(0, 3);
  const formatted = JSON.stringify(metadata, null, 2);

  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center gap-1.5 list-none">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 group-open:hidden">
          {keys.length} field{keys.length === 1 ? "" : "s"}
        </span>
        <span className="hidden rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white group-open:inline">
          hide
        </span>
        <span className="truncate text-[11px] text-slate-500 group-open:hidden">
          {summaryKeys.join(", ")}
          {keys.length > summaryKeys.length ? "…" : ""}
        </span>
      </summary>
      <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
        {formatted}
      </pre>
    </details>
  );
}

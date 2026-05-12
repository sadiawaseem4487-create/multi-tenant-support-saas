import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { resolveOrgContext } from "@/lib/rbac";
import { loadAnalytics } from "@/lib/analytics";

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatMs(n: number | null): string {
  if (n === null) return "—";
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const WINDOWS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; days?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { orgId, days: daysParam } = await searchParams;
  const context = await resolveOrgContext(user.id, orgId);

  const rawDays = parseInt(daysParam ?? "7", 10);
  const days =
    Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : 7;

  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set.");

  const { totals, daily, topQuestions, recent } = await loadAnalytics(
    sql,
    context.orgId,
    days,
  );

  const maxDaily = daily.reduce((acc, d) => Math.max(acc, d.count), 0);

  const orgQuery = `orgId=${encodeURIComponent(context.orgId)}`;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Conversation analytics
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              How <span className="font-medium">{context.orgName}</span>&apos;s
              assistant is being used. All counts are scoped to this
              organization.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WINDOWS.map((w) => {
              const isActive = w.days === days;
              return (
                <Link
                  key={w.days}
                  href={`/admin/analytics?${orgQuery}&days=${w.days}`}
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total questions"
          value={totals.totalMessages.toLocaleString()}
          hint="Tracked across signed-in + public chat"
        />
        <StatCard
          label="Fallback rate"
          value={
            totals.totalMessages > 0 ? formatPercent(totals.fallbackRate) : "—"
          }
          tone={totals.fallbackRate > 0.25 ? "warn" : "ok"}
          hint={`${totals.fallbackMessages} unanswered`}
        />
        <StatCard
          label="Avg response time"
          value={formatMs(totals.avgResponseMs)}
          tone={
            (totals.avgResponseMs ?? 0) > 7000
              ? "warn"
              : totals.avgResponseMs === null
                ? "muted"
                : "ok"
          }
          hint="End-to-end through n8n"
        />
        <StatCard
          label="Unique visitors"
          value={totals.uniqueVisitors.toLocaleString()}
          hint="By hashed IP or user"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Daily volume
          </h3>
          <p className="text-xs text-slate-500">
            {daily.length} day{daily.length === 1 ? "" : "s"}
          </p>
        </div>

        {totals.totalMessages === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            No messages yet in this window. Ask a question via{" "}
            <code className="rounded bg-slate-100 px-1">/site/&lt;slug&gt;</code>{" "}
            or the embed widget and reload this page.
          </p>
        ) : (
          <div className="mt-6 flex items-end gap-2 overflow-x-auto pb-2">
            {daily.map((d) => {
              const heightPct = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="flex min-w-[36px] flex-1 flex-col items-center gap-1"
                  title={`${d.date}: ${d.count} (${d.fallbacks} fallback${d.fallbacks === 1 ? "" : "s"}, ${d.errors} error${d.errors === 1 ? "" : "s"})`}
                >
                  <div className="flex h-32 w-full items-end justify-center">
                    <div
                      className="w-full overflow-hidden rounded-t bg-gradient-to-t from-teal-200 via-teal-400 to-teal-500"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    >
                      {d.fallbacks > 0 ? (
                        <div
                          className="w-full bg-amber-500/90"
                          style={{
                            height: `${Math.min(100, (d.fallbacks / Math.max(1, d.count)) * 100)}%`,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {d.date.slice(5)}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[11px] text-slate-500">
          Teal = answered. Amber overlay = fallback responses (no answer
          found).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Top questions
        </h3>
        {topQuestions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No questions have been asked yet in this window.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Asked</th>
                  <th className="px-3 py-2">Fallback</th>
                  <th className="px-3 py-2">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topQuestions.map((q) => (
                  <tr key={q.questionNormalized}>
                    <td className="max-w-[420px] truncate px-3 py-2 text-slate-800">
                      {q.sampleQuestion}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                        ×{q.count}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {q.fallbackCount > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {q.fallbackCount}/{q.count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatRelative(q.lastAskedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Recent activity
        </h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No recent messages.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="max-w-3xl text-sm font-medium text-slate-800">
                    {r.question}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {r.status !== "ok" ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                        {r.status}
                      </span>
                    ) : null}
                    {r.wasFallback ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                        fallback
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      {r.source}
                    </span>
                    <span className="text-slate-400">
                      {formatMs(r.responseMs)}
                    </span>
                    <span className="text-slate-400">
                      · {formatRelative(r.createdAt)}
                    </span>
                  </div>
                </div>
                {r.answer ? (
                  <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-600">
                    {r.answer}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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

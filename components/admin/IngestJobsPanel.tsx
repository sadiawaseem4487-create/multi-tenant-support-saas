"use client";

import { useState } from "react";

type IngestJob = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  source: string | null;
  error: string | null;
  n8nExecutionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  orgId: string;
  orgName: string;
  canStartIngest: boolean;
  jobs: IngestJob[];
};

export function IngestJobsPanel({ orgId, orgName, canStartIngest, jobs }: Props) {
  const [source, setSource] = useState("");
  const [payloadText, setPayloadText] = useState('{"documentUrl": ""}');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitIngest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStartIngest) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      let payloadObject: Record<string, unknown> = {};
      if (payloadText.trim()) {
        const parsed = JSON.parse(payloadText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Payload must be a JSON object.");
        }
        payloadObject = parsed as Record<string, unknown>;
      }

      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: source.trim() || "manual",
          payload: payloadObject,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to queue ingest job.");
      }

      setMessage(`Ingest job started (job id: ${data.jobId ?? "unknown"}). Refresh to see updates.`);
      setSource("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue ingest job.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Knowledge ingest jobs</h2>
        <p className="mt-2 text-sm text-slate-600">
          Organization: <span className="font-medium text-slate-800">{orgName}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Start ingest</h3>
        {canStartIngest ? (
          <form className="mt-4 space-y-3" onSubmit={submitIngest}>
            <input
              type="text"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Source (e.g. google-drive, manual-upload)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/40 focus:ring"
            />
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/40 focus:ring"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
            >
              {submitting ? "Starting..." : "Start ingest"}
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your role does not allow starting ingest jobs. Ask an owner/admin/content manager.
          </p>
        )}

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Recent jobs
          </h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Job
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Updated (UTC)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3 text-xs text-slate-700">{job.id}</td>
                <td className="px-4 py-3 text-sm text-slate-900">{job.status}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{job.source ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{job.updatedAt}</td>
                <td className="px-4 py-3 text-xs text-rose-700">{job.error ?? "-"}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-600" colSpan={5}>
                  No ingest jobs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

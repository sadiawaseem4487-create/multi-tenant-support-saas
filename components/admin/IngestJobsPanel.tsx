"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type IngestJob = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  source: string | null;
  error: string | null;
  n8nExecutionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type KbDocument = {
  id: string;
  title: string;
  sourceUri: string | null;
  ingestStatus: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  orgId: string;
  orgName: string;
  canStartIngest: boolean;
  jobs: IngestJob[];
  documents: KbDocument[];
};

const SOURCE_PRESETS = [
  { value: "manual-upload", label: "Manual URL" },
  { value: "google-drive", label: "Google Drive (auto)" },
  { value: "web-url", label: "Web URL" },
];

const STATUS_PILL: Record<IngestJob["status"], string> = {
  queued: "bg-slate-100 text-slate-700 ring-slate-200",
  running: "bg-sky-50 text-sky-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function IngestJobsPanel({
  orgId,
  orgName,
  canStartIngest,
  jobs,
  documents,
}: Props) {
  const router = useRouter();
  const [source, setSource] = useState(SOURCE_PRESETS[0].value);
  const [title, setTitle] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submitIngest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStartIngest) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const trimmedTitle = title.trim();
      const trimmedUrl = documentUrl.trim();
      if (!trimmedTitle) {
        throw new Error("Title is required so you can find this document later.");
      }
      if (!trimmedUrl) {
        throw new Error("Document URL is required.");
      }
      try {
        new URL(trimmedUrl);
      } catch {
        throw new Error("Document URL must be a valid URL (https://...).");
      }

      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          payload: { title: trimmedTitle, documentUrl: trimmedUrl },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to queue ingest job.");
      }

      setMessage(`Ingest started (job ${data.jobId ?? "?"}). Refreshing…`);
      setTitle("");
      setDocumentUrl("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue ingest job.");
    } finally {
      setSubmitting(false);
    }
  }

  function manualRefresh() {
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Knowledge base</h2>
            <p className="mt-1 text-sm text-slate-600">
              Organization: <span className="font-medium text-slate-800">{orgName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={manualRefresh}
            disabled={isPending}
            className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Add knowledge from a URL</h3>
        <p className="mt-1 text-xs text-slate-500">
          Provide a public URL to a PDF, HTML page, or document. The ingest workflow will
          fetch, chunk, and embed it into your organization&apos;s knowledge base.
        </p>
        {canStartIngest ? (
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={submitIngest}>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-1">
              Source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60"
              >
                {SOURCE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
              Document title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Return policy v3"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60"
                maxLength={160}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-3">
              Document URL
              <input
                type="url"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://example.com/policy.pdf"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60"
              />
            </label>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
              >
                {submitting ? "Starting…" : "Start ingest"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your role does not allow starting ingest jobs. Ask an owner / admin / content
            manager.
          </p>
        )}

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Knowledge documents
          </h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Updated (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-4 py-3 text-sm text-slate-900">{doc.title}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {doc.sourceUri ? (
                    <a
                      href={doc.sourceUri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-700 underline-offset-2 hover:underline"
                    >
                      {doc.sourceUri.length > 60 ? `${doc.sourceUri.slice(0, 60)}…` : doc.sourceUri}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{doc.ingestStatus}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{doc.updatedAt}</td>
              </tr>
            ))}
            {documents.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-600" colSpan={4}>
                  No knowledge documents ingested yet. Use the form above to add one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
                <td className="px-4 py-3 text-xs text-slate-600">
                  <code className="font-mono">{job.id.slice(0, 8)}…</code>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_PILL[job.status]}`}
                  >
                    {job.status}
                  </span>
                </td>
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type KbFile = {
  filename: string;
  source: string | null;
  chunkCount: number;
  firstUploadedAt: string | null;
  lastUploadedAt: string | null;
};

type Props = {
  orgId: string;
  canDelete: boolean;
  totalChunks: number;
  uniqueFiles: number;
  files: KbFile[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso.slice(0, 19);
  }
}

const SOURCE_BADGE: Record<string, string> = {
  gdrive: "bg-blue-50 text-blue-700 ring-blue-200",
  "manual-upload": "bg-slate-100 text-slate-700 ring-slate-200",
  "google-drive": "bg-blue-50 text-blue-700 ring-blue-200",
  "web-url": "bg-violet-50 text-violet-700 ring-violet-200",
};

export function KbFilesPanel({
  orgId,
  canDelete,
  totalChunks,
  uniqueFiles,
  files,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onDelete(file: KbFile) {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Delete "${file.filename}" from the knowledge base?\n\n${file.chunkCount} chunk${file.chunkCount === 1 ? "" : "s"} will be permanently removed and the chat will no longer be able to answer from this file.`,
    );
    if (!confirmed) return;

    setError(null);
    const key = `${file.filename}::${file.source ?? ""}`;
    setDeleting(key);
    try {
      const res = await fetch("/api/admin/kb-files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          filename: file.filename,
          source: file.source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Delete failed (${res.status}).`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Files in knowledge base
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {uniqueFiles} file{uniqueFiles === 1 ? "" : "s"} · {totalChunks}{" "}
            chunk{totalChunks === 1 ? "" : "s"} total
          </p>
        </div>
        {!canDelete ? (
          <p className="text-[11px] text-slate-500">
            Your role doesn&apos;t allow deletion. Ask an owner / admin / content
            manager.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              File
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Chunks
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              First uploaded
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Last uploaded
            </th>
            {canDelete ? (
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((file) => {
            const key = `${file.filename}::${file.source ?? ""}`;
            const isDeleting = deleting === key;
            const sourceLabel = file.source ?? "(unknown)";
            const badgeClass =
              (file.source && SOURCE_BADGE[file.source]) ??
              "bg-slate-100 text-slate-700 ring-slate-200";
            return (
              <tr key={key} className="align-top">
                <td className="px-4 py-3 text-sm text-slate-900">
                  <span className="break-all font-medium">{file.filename}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ${badgeClass}`}
                  >
                    {sourceLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                    {file.chunkCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {formatDate(file.firstUploadedAt)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {formatDate(file.lastUploadedAt)}
                </td>
                {canDelete ? (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(file)}
                      disabled={isDeleting}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
          {files.length === 0 ? (
            <tr>
              <td
                className="px-4 py-8 text-center text-sm text-slate-500"
                colSpan={canDelete ? 6 : 5}
              >
                Your knowledge base is empty. Start an ingest job below to add
                content.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

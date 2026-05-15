import type { KbStatusPayload } from "@/lib/kb-status";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ingestHealthTone(status: KbStatusPayload): "ok" | "warn" | "muted" {
  if (status.activeJobCount > 0) return "warn";
  if (status.lastIngestStatus === "failed") return "warn";
  if (status.lastSuccessfulIngestAt) return "ok";
  return "muted";
}

export function KbStatusCard({
  orgName,
  status,
}: {
  orgName: string;
  status: KbStatusPayload;
}) {
  const health = ingestHealthTone(status);
  const healthLabel =
    status.activeJobCount > 0
      ? `${status.activeJobCount} job${status.activeJobCount === 1 ? "" : "s"} running`
      : status.lastIngestStatus === "failed"
        ? "Last ingest failed"
        : status.lastSuccessfulIngestAt
          ? "Pipeline healthy"
          : "No successful ingest yet";

  const healthClass =
    health === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : health === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Knowledge base status
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Indexed content and ingest pipeline for{" "}
            <span className="font-medium">{orgName}</span>.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${healthClass}`}
        >
          {healthLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Vector chunks" value={status.totalChunks.toLocaleString()} />
        <Stat label="Source files" value={status.uniqueFiles.toLocaleString()} />
        <Stat
          label="Last successful ingest"
          value={formatRelative(status.lastSuccessfulIngestAt)}
        />
        <Stat
          label="KB registry rows"
          value={status.kbDocumentCount.toLocaleString()}
        />
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Models (n8n / OpenRouter)
        </p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Chat</dt>
            <dd className="font-mono text-xs text-slate-800">{status.chatModel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Embeddings</dt>
            <dd className="font-mono text-xs text-slate-800">
              {status.embeddingModel}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-slate-500">
          Override via <code className="rounded bg-white px-1">CHAT_MODEL</code> /{" "}
          <code className="rounded bg-white px-1">EMBEDDING_MODEL</code> on Vercel if
          you change models in n8n.
        </p>
      </div>

      {status.lastIngestStatus === "failed" && status.lastIngestError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Last ingest error ({formatRelative(status.lastIngestAt)}):{" "}
          <span className="font-medium">{status.lastIngestError}</span>
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

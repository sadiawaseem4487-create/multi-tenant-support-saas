/**
 * Knowledge-base and ingest pipeline status for one org (Sprint 4 ops dashboard).
 */

import type { getSql } from "@/lib/db";

type Sql = NonNullable<ReturnType<typeof getSql>>;

export type KbStatusPayload = {
  totalChunks: number;
  uniqueFiles: number;
  kbDocumentCount: number;
  lastSuccessfulIngestAt: string | null;
  lastIngestStatus: string | null;
  lastIngestAt: string | null;
  lastIngestError: string | null;
  activeJobCount: number;
  chatModel: string;
  embeddingModel: string;
};

const DEFAULT_CHAT_MODEL = "openai/gpt-4.1-mini";
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function loadKbStatus(sql: Sql, orgId: string): Promise<KbStatusPayload> {
  const [{ totalChunks }] = await sql<{ totalChunks: number }[]>`
    select count(*)::int as "totalChunks"
    from public.documents
    where org_id = ${orgId}::uuid
  `;

  const [{ uniqueFiles }] = await sql<{ uniqueFiles: number }[]>`
    select count(distinct coalesce(metadata->>'filename', id::text))::int as "uniqueFiles"
    from public.documents
    where org_id = ${orgId}::uuid
  `;

  const [{ kbDocumentCount }] = await sql<{ kbDocumentCount: number }[]>`
    select count(*)::int as "kbDocumentCount"
    from public.kb_documents
    where org_id = ${orgId}::uuid
  `;

  const [lastSuccess] = await sql<{ updatedAt: Date }[]>`
    select updated_at as "updatedAt"
    from public.ingest_jobs
    where org_id = ${orgId}::uuid
      and status = 'success'
    order by updated_at desc
    limit 1
  `;

  const [lastJob] = await sql<{
    status: string;
    updatedAt: Date;
    error: string | null;
  }[]>`
    select status, updated_at as "updatedAt", error
    from public.ingest_jobs
    where org_id = ${orgId}::uuid
    order by updated_at desc
    limit 1
  `;

  const successAt = lastSuccess?.updatedAt?.getTime() ?? 0;
  const lastJobAt = lastJob?.updatedAt?.getTime() ?? 0;
  const lastFailureIsStale =
    lastJob?.status === "failed" &&
    successAt > 0 &&
    successAt >= lastJobAt;

  const [{ activeJobCount }] = await sql<{ activeJobCount: number }[]>`
    select count(*)::int as "activeJobCount"
    from public.ingest_jobs
    where org_id = ${orgId}::uuid
      and status in ('queued', 'running')
  `;

  return {
    totalChunks,
    uniqueFiles,
    kbDocumentCount,
    lastSuccessfulIngestAt: lastSuccess?.updatedAt?.toISOString() ?? null,
    lastIngestStatus: lastFailureIsStale ? "success" : (lastJob?.status ?? null),
    lastIngestAt: lastFailureIsStale
      ? (lastSuccess?.updatedAt?.toISOString() ?? null)
      : (lastJob?.updatedAt?.toISOString() ?? null),
    lastIngestError: lastFailureIsStale ? null : (lastJob?.error ?? null),
    activeJobCount,
    chatModel: process.env.CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL,
    embeddingModel:
      process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

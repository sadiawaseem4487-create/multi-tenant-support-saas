import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { IngestJobsPanel } from "@/components/admin/IngestJobsPanel";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";

type IngestJobRow = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  source: string | null;
  error: string | null;
  n8nExecutionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type KbDocumentRow = {
  id: string;
  title: string;
  sourceUri: string | null;
  ingestStatus: string;
  createdAt: string;
  updatedAt: string;
};

export default async function AdminKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { orgId } = await searchParams;
  const context = await resolveOrgContext(user.id, orgId);

  let canRead = true;
  try {
    await requireRole(context.orgId, "kb:read", user.id);
  } catch {
    canRead = false;
  }

  if (!canRead) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-amber-900">No access to Knowledge</h2>
          <p className="mt-2 text-sm text-amber-800">
            Your current role in <strong>{context.orgName}</strong> does not include knowledge-base
            permissions.
          </p>
        </div>
      </section>
    );
  }

  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not set.");
  }

  const jobs = await sql<IngestJobRow[]>`
    select
      id,
      status::text as "status",
      source,
      error,
      n8n_execution_id as "n8nExecutionId",
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') as "updatedAt"
    from public.ingest_jobs
    where org_id = ${context.orgId}::uuid
    order by created_at desc
    limit 25
  `;

  const documents = await sql<KbDocumentRow[]>`
    select
      id,
      title,
      source_uri as "sourceUri",
      ingest_status as "ingestStatus",
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "createdAt",
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') as "updatedAt"
    from public.kb_documents
    where org_id = ${context.orgId}::uuid
    order by updated_at desc
    limit 25
  `;

  let canStartIngest = true;
  try {
    await requireRole(context.orgId, "kb:write", user.id);
  } catch {
    canStartIngest = false;
  }

  return (
    <IngestJobsPanel
      orgId={context.orgId}
      orgName={context.orgName}
      canStartIngest={canStartIngest}
      jobs={jobs}
      documents={documents}
    />
  );
}

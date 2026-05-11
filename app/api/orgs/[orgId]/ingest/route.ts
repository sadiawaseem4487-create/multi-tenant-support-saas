import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

type IngestRequestBody = {
  source?: string;
  payload?: Record<string, unknown>;
};

type IngestJobRow = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  source: string | null;
  createdAt: string;
};

type IngestJobListRow = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  source: string | null;
  error: string | null;
  n8nExecutionId: string | null;
  createdAt: string;
  updatedAt: string;
};

function isForbiddenError(message: string) {
  return message.startsWith("Forbidden:") || message.includes("missing permission");
}

export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    await requireRole(orgId, "kb:read", userId);

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const rows = await sql<IngestJobListRow[]>`
      select
        id,
        status::text as "status",
        source,
        error,
        n8n_execution_id as "n8nExecutionId",
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
        to_char(updated_at at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') as "updatedAt"
      from public.ingest_jobs
      where org_id = ${orgId}::uuid
      order by created_at desc
      limit 25
    `;

    return NextResponse.json({ jobs: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    if (isForbiddenError(message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    await requireRole(orgId, "kb:write", userId);

    const body = (await request.json().catch(() => ({}))) as IngestRequestBody;
    const source = typeof body.source === "string" ? body.source.trim() || "manual" : "manual";
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : {};

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const correlationId = crypto.randomUUID();
    const [job] = await sql<IngestJobRow[]>`
      insert into public.ingest_jobs (org_id, status, source, payload)
      values (
        ${orgId}::uuid,
        'queued',
        ${source},
        ${JSON.stringify({ ...payload, requestedBy: userId, correlationId })}::jsonb
      )
      returning
        id,
        status::text as "status",
        source,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') as "createdAt"
    `;

    try {
      const ingestWebhookUrl = process.env.INGEST_WEBHOOK_URL;
      const webhookSecret = process.env.WEBHOOK_SECRET?.trim();
      if (!ingestWebhookUrl) {
        throw new Error("INGEST_WEBHOOK_URL is not configured.");
      }

      let upstream: Response;
      try {
        upstream = await fetch(ingestWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
          },
          body: JSON.stringify({
            job_id: job.id,
            org_id: orgId,
            source,
            payload,
            correlation_id: correlationId,
            requested_by: userId,
          }),
          cache: "no-store",
        });
      } catch (fetchError) {
        const cause =
          fetchError instanceof Error && "cause" in fetchError && fetchError.cause
            ? ` (${(fetchError.cause as { code?: string; message?: string }).code ?? ""} ${
                (fetchError.cause as { code?: string; message?: string }).message ?? ""
              })`
            : "";
        throw new Error(
          `Network call to ingest webhook failed: ${
            fetchError instanceof Error ? fetchError.message : "unknown"
          }${cause}`,
        );
      }

      if (!upstream.ok) {
        const raw = await upstream.text().catch(() => "");
        const errorText = raw ? raw.slice(0, 1000) : `Webhook failed (${upstream.status}).`;
        throw new Error(`n8n returned HTTP ${upstream.status}: ${errorText}`);
      }

      const responseText = await upstream.text().catch(() => "");
      let executionId: string | null = null;
      try {
        const parsed = responseText
          ? (JSON.parse(responseText) as Record<string, unknown>)
          : null;
        const candidate = parsed?.executionId ?? parsed?.execution_id ?? parsed?.id;
        executionId = typeof candidate === "string" ? candidate : null;
      } catch {
        executionId = null;
      }

      await sql`
        update public.ingest_jobs
        set
          status = 'running',
          n8n_execution_id = ${executionId},
          updated_at = now()
        where id = ${job.id}::uuid
      `;

      return NextResponse.json({
        jobId: job.id,
        status: "running",
        orgId,
        source,
        correlationId,
        n8nExecutionId: executionId,
      });
    } catch (dispatchError) {
      const dispatchMessage =
        dispatchError instanceof Error ? dispatchError.message : "Ingest dispatch failed.";
      await sql`
        update public.ingest_jobs
        set status = 'failed', error = ${dispatchMessage.slice(0, 1000)}, updated_at = now()
        where id = ${job.id}::uuid
      `;
      return NextResponse.json(
        { error: dispatchMessage, jobId: job.id },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    if (isForbiddenError(message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

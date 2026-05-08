import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

type IngestUpdatePayload = {
  status?: "queued" | "running" | "success" | "failed";
  n8nExecutionId?: string;
  error?: string;
};

function isAllowedStatus(value: unknown): value is "queued" | "running" | "success" | "failed" {
  return value === "queued" || value === "running" || value === "success" || value === "failed";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const expectedSecret = process.env.WEBHOOK_SECRET?.trim();
    const incomingSecret = request.headers.get("x-webhook-secret")?.trim();
    if (expectedSecret && incomingSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook call." }, { status: 401 });
    }

    const { jobId } = await params;
    const body = (await request.json().catch(() => ({}))) as IngestUpdatePayload;
    if (!isAllowedStatus(body.status)) {
      return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
    }

    const n8nExecutionId =
      typeof body.n8nExecutionId === "string" && body.n8nExecutionId.trim()
        ? body.n8nExecutionId.trim()
        : null;
    const error =
      typeof body.error === "string" && body.error.trim() ? body.error.trim().slice(0, 2000) : null;

    const rows = await sql<{ id: string; status: string }[]>`
      update public.ingest_jobs
      set
        status = ${body.status}::public.ingest_job_status,
        n8n_execution_id = coalesce(${n8nExecutionId}, n8n_execution_id),
        error = ${error},
        updated_at = now()
      where id = ${jobId}::uuid
      returning id, status::text as "status"
    `;

    if (!rows.length) {
      return NextResponse.json({ error: "Ingest job not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, jobId: rows[0].id, status: rows[0].status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

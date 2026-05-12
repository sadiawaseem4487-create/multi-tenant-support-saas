import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type KbFileRow = {
  filename: string;
  source: string | null;
  chunkCount: number;
  firstUploadedAt: string | null;
  lastUploadedAt: string | null;
};

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const orgIdParam = new URL(request.url).searchParams.get("orgId");
    const context = await resolveOrgContext(userId, orgIdParam);
    await requireRole(context.orgId, "kb:read", userId);

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const rows = await sql<
      {
        filename: string;
        source: string | null;
        chunkCount: string | number;
        firstUploadedAt: string | null;
        lastUploadedAt: string | null;
      }[]
    >`
      select
        coalesce(metadata->>'filename', '(no filename)') as filename,
        metadata->>'source' as source,
        count(*)::int as "chunkCount",
        min(metadata->>'uploaded_at') as "firstUploadedAt",
        max(metadata->>'uploaded_at') as "lastUploadedAt"
      from public.documents
      where org_id = ${context.orgId}::uuid
      group by 1, 2
      order by "lastUploadedAt" desc nulls last, "chunkCount" desc
    `;

    const files: KbFileRow[] = rows.map((r) => ({
      filename: r.filename,
      source: r.source,
      chunkCount: Number(r.chunkCount),
      firstUploadedAt: r.firstUploadedAt,
      lastUploadedAt: r.lastUploadedAt,
    }));

    const [totals] = await sql<{ totalChunks: string | number; uniqueFiles: string | number }[]>`
      select
        count(*)::int as "totalChunks",
        count(distinct (metadata->>'filename'))::int as "uniqueFiles"
      from public.documents
      where org_id = ${context.orgId}::uuid
    `;

    return NextResponse.json({
      orgId: context.orgId,
      totalChunks: Number(totals?.totalChunks ?? 0),
      uniqueFiles: Number(totals?.uniqueFiles ?? 0),
      files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

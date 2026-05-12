import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type DeleteBody = {
  orgId?: string;
  filename?: string;
  source?: string | null;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    const filename = typeof body.filename === "string" ? body.filename : "";
    if (!filename) return jsonError("filename is required.", 400);

    const source =
      typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;

    const context = await resolveOrgContext(userId, body.orgId ?? null);
    await requireRole(context.orgId, "kb:write", userId);

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const deleted = source
      ? await sql<{ id: string }[]>`
          delete from public.documents
          where org_id = ${context.orgId}::uuid
            and coalesce(metadata->>'filename', '(no filename)') = ${filename}
            and metadata->>'source' = ${source}
          returning id
        `
      : await sql<{ id: string }[]>`
          delete from public.documents
          where org_id = ${context.orgId}::uuid
            and coalesce(metadata->>'filename', '(no filename)') = ${filename}
            and metadata->>'source' is null
          returning id
        `;

    const removedCount = deleted.length;

    await logAudit({
      orgId: context.orgId,
      actorAuthSubject: userId,
      action: "kb_file.deleted",
      resourceType: "kb_file",
      resourceId: filename.slice(0, 200),
      metadata: {
        filename,
        source,
        removedChunks: removedCount,
      },
    });

    return NextResponse.json({
      orgId: context.orgId,
      filename,
      source,
      removedChunks: removedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

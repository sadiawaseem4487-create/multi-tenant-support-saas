import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { auditRowsToCsv, loadAuditLogForExport } from "@/lib/audit-query";
import { requireRole, resolveOrgContext } from "@/lib/rbac";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const url = new URL(request.url);
    const orgIdParam = url.searchParams.get("orgId");
    const daysRaw = parseInt(url.searchParams.get("days") ?? "30", 10);
    const days =
      Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;
    const actionParam = url.searchParams.get("action");
    const action =
      actionParam && actionParam.trim() ? actionParam.trim() : null;

    const context = await resolveOrgContext(userId, orgIdParam);
    await requireRole(context.orgId, "users:read", userId);

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const rows = await loadAuditLogForExport(sql, context.orgId, { days, action });
    const csv = auditRowsToCsv(rows);
    const slug = context.orgName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const filename = `audit-${slug}-${days}d.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireRole, resolveOrgContext } from "@/lib/rbac";
import { loadAnalytics } from "@/lib/analytics";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return jsonError("Unauthorized", 401);

    const url = new URL(request.url);
    const orgIdParam = url.searchParams.get("orgId");
    const daysRaw = parseInt(url.searchParams.get("days") ?? "7", 10);
    const days =
      Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 7;

    const context = await resolveOrgContext(userId, orgIdParam);
    await requireRole(context.orgId, "admin:access", userId);

    const sql = getSql();
    if (!sql) return jsonError("DATABASE_URL is not set.", 500);

    const data = await loadAnalytics(sql, context.orgId, days);

    return NextResponse.json({
      orgId: context.orgId,
      windowDays: days,
      ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.startsWith("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

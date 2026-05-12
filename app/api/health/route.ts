import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckResult = { ok: true } | { ok: false; error: string };

async function checkDatabase(): Promise<CheckResult> {
  try {
    const sql = getSql();
    if (!sql) {
      return { ok: false, error: "DATABASE_URL is not set." };
    }
    const rows = await sql<{ ok: number }[]>`select 1 as ok`;
    if (rows[0]?.ok !== 1) {
      return { ok: false, error: "Unexpected database response." };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown database error.",
    };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const db = await checkDatabase();
  const overall = db.ok;

  return NextResponse.json(
    {
      status: overall ? "ok" : "degraded",
      checks: { database: db },
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    { status: overall ? 200 : 503 },
  );
}

export async function HEAD() {
  const db = await checkDatabase();
  return new NextResponse(null, { status: db.ok ? 200 : 503 });
}

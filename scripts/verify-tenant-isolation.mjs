#!/usr/bin/env node
// Tenant isolation smoke test.
//
// Connects to DATABASE_URL and asserts four invariants about the new
// tenant-aware match_documents RPC:
//
//   1. The function signature includes tenant_org_id uuid default null.
//   2. Calling match_documents with tenant_org_id => NULL returns ZERO rows
//      (fail-closed contract).
//   3. Calling with a real org's UUID returns >0 rows when that org has
//      chunks, and only rows whose embedded org_id matches.
//   4. Calling with a random UUID that does NOT correspond to any org returns
//      ZERO rows.
//
// Usage:
//   node --env-file=.env.local scripts/verify-tenant-isolation.mjs
//
// Exits non-zero on any failure so CI / pre-deploy hooks can gate on it.

import postgres from "postgres";
import { randomUUID } from "node:crypto";

const PASS = "  PASS";
const FAIL = "  FAIL";

let failures = 0;

function assertOk(condition, label, detail = "") {
  if (condition) {
    console.log(`${PASS} ${label}`);
  } else {
    failures++;
    console.log(`${FAIL} ${label}`);
    if (detail) console.log(`         ${detail}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    console.log("Tenant isolation smoke test");
    console.log("---------------------------");

    // ------------------------------------------------------------------
    // 1. Function signature includes tenant_org_id
    // ------------------------------------------------------------------
    const fnRows = await sql`
      select pg_get_function_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'match_documents'
    `;
    const hasTenantArg = fnRows.some((r) => /tenant_org_id\s+uuid/i.test(r.args));
    assertOk(
      hasTenantArg,
      "match_documents signature includes tenant_org_id uuid",
      hasTenantArg ? "" : `Got: ${fnRows.map((r) => r.args).join(" | ") || "<no rows>"}`,
    );

    if (!hasTenantArg) {
      console.log("\nThe tenant-aware migration (0003) is not applied yet.");
      console.log("Run: npm run db:migrate");
      process.exit(1);
    }

    // ------------------------------------------------------------------
    // Need a real embedding vector to pass into the function. Borrow one
    // from any existing chunk. If the documents table is empty, we can
    // only test the fail-closed branch.
    // ------------------------------------------------------------------
    const sampleRows = await sql`
      select embedding::text as embedding_text, org_id
      from public.documents
      where embedding is not null and org_id is not null
      limit 1
    `;

    if (sampleRows.length === 0) {
      console.log(
        "\nNo embedded chunks found with a non-null org_id. Skipping retrieval tests.",
      );
      console.log("Ingest at least one document, then re-run.");
      // Still run the fail-closed test using a zero vector.
      const zeroVec = `[${Array.from({ length: 1536 }, () => 0).join(",")}]`;
      const [{ n }] = await sql`
        select count(*)::int as n
        from public.match_documents(
          ${zeroVec}::vector(1536), 5, '{}'::jsonb, null
        )
      `;
      assertOk(n === 0, "fail-closed: null tenant_org_id returns zero rows", `got n=${n}`);
      return;
    }

    const embedding = sampleRows[0].embedding_text;
    const realOrgId = sampleRows[0].org_id;

    // ------------------------------------------------------------------
    // 2. fail-closed: null tenant_org_id returns zero rows
    // ------------------------------------------------------------------
    const [{ n: nullN }] = await sql`
      select count(*)::int as n
      from public.match_documents(
        ${embedding}::vector(1536), 5, '{}'::jsonb, null
      )
    `;
    assertOk(nullN === 0, "fail-closed: null tenant_org_id returns zero rows", `got n=${nullN}`);

    // ------------------------------------------------------------------
    // 3. real org returns >0 rows AND all rows belong to that org
    // ------------------------------------------------------------------
    const realRows = await sql`
      select id, content
      from public.match_documents(
        ${embedding}::vector(1536), 5, '{}'::jsonb, ${realOrgId}::uuid
      )
    `;
    assertOk(realRows.length > 0, `tenant ${realOrgId} returns >0 rows`, `got ${realRows.length}`);

    // Cross-check: every returned id belongs to the requested org.
    if (realRows.length > 0) {
      const ids = realRows.map((r) => r.id);
      const wrongOrg = await sql`
        select count(*)::int as n
        from public.documents
        where id = any(${ids}) and org_id <> ${realOrgId}::uuid
      `;
      assertOk(
        wrongOrg[0].n === 0,
        "every returned row belongs to the requested tenant",
        `${wrongOrg[0].n} rows had the wrong org_id`,
      );
    }

    // ------------------------------------------------------------------
    // 4. random non-existent UUID returns zero rows
    // ------------------------------------------------------------------
    const fakeOrgId = randomUUID();
    const [{ n: fakeN }] = await sql`
      select count(*)::int as n
      from public.match_documents(
        ${embedding}::vector(1536), 5, '{}'::jsonb, ${fakeOrgId}::uuid
      )
    `;
    assertOk(
      fakeN === 0,
      "random non-existent tenant_org_id returns zero rows",
      `got n=${fakeN}`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("---------------------------");
  if (failures === 0) {
    console.log("All checks passed.");
  } else {
    console.log(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

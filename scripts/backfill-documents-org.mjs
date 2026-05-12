#!/usr/bin/env node
// Backfill org_id on existing public.documents rows that were ingested before
// tenant scoping was added (Sprint 2). Without this, the new tenant-aware
// match_documents RPC returns zero rows for those legacy chunks.
//
// Usage (pick ONE):
//   # Stamp all NULL-org rows with the demo org's UUID
//   node --env-file=.env.local scripts/backfill-documents-org.mjs <uuid>
//
//   # Stamp all NULL-org rows with the org whose slug = <slug>
//   node --env-file=.env.local scripts/backfill-documents-org.mjs --slug demo-company
//
//   # Dry run (count only)
//   node --env-file=.env.local scripts/backfill-documents-org.mjs --slug demo-company --dry-run

import postgres from "postgres";

function parseArgs(argv) {
  const args = { dryRun: false, slug: null, orgId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--slug") args.slug = argv[++i];
    else if (!args.orgId) args.orgId = a;
  }
  return args;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  if (!args.orgId && !args.slug) {
    console.error("Usage: backfill-documents-org.mjs <uuid> | --slug <slug> [--dry-run]");
    process.exit(1);
  }
  if (args.orgId && !UUID_RE.test(args.orgId)) {
    console.error(`Not a valid UUID: ${args.orgId}`);
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    let targetOrgId = args.orgId;
    let targetLabel = args.orgId;
    if (args.slug) {
      const rows = await sql`
        select id, name, slug from public.orgs where slug = ${args.slug} limit 1
      `;
      if (rows.length === 0) {
        console.error(`No org found with slug='${args.slug}'.`);
        process.exit(1);
      }
      targetOrgId = rows[0].id;
      targetLabel = `${rows[0].name} (slug=${rows[0].slug}, id=${rows[0].id})`;
    }

    const [{ orphan_count }] = await sql`
      select count(*)::int as orphan_count
      from public.documents
      where org_id is null
    `;

    console.log(`Found ${orphan_count} document chunk(s) with org_id IS NULL.`);
    if (orphan_count === 0) {
      console.log("Nothing to backfill. Exiting.");
      return;
    }
    console.log(`Target org: ${targetLabel}`);

    if (args.dryRun) {
      console.log("Dry run; no rows updated. Re-run without --dry-run to apply.");
      return;
    }

    const result = await sql`
      update public.documents
      set org_id = ${targetOrgId}::uuid
      where org_id is null
    `;
    console.log(`Updated ${result.count} row(s).`);

    const [{ remaining }] = await sql`
      select count(*)::int as remaining from public.documents where org_id is null
    `;
    console.log(`Remaining NULL-org rows: ${remaining}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
// Apply SQL migrations from db/migrations/ in filename order.
//
// Usage:
//   node --env-file=.env.local scripts/migrate.mjs           # apply pending (excludes optional)
//   node --env-file=.env.local scripts/migrate.mjs status    # show what's pending/applied
//   node --env-file=.env.local scripts/migrate.mjs mark FILE # record FILE as applied without running
//   node --env-file=.env.local scripts/migrate.mjs apply --include-optional   # also apply optional ones (RLS)
//
// Tracker:
//   public._schema_migrations(filename text primary key, applied_at timestamptz)
//
// Bootstrap:
//   If the tracker table is empty but public.orgs exists, the baseline
//   migrations (0001, 0002) are auto-marked as applied. This lets you adopt
//   the runner on a database where 0001 + 0002 were applied manually.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");

// Migrations that are NOT applied by default. Use --include-optional to apply.
const OPTIONAL = new Set(["0004_row_level_security.sql"]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Did you run with --env-file=.env.local?");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    await sql`
      create table if not exists public._schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const trackerRows = await sql`select filename from public._schema_migrations`;
    if (trackerRows.length === 0) {
      const [{ t }] = await sql`select to_regclass('public.orgs') as t`;
      if (t) {
        console.log("Detected pre-existing baseline (public.orgs exists).");
        console.log("Auto-marking 0001_baseline.sql + 0002_alter_vectors.sql as applied.");
        await sql`
          insert into public._schema_migrations(filename) values
            ('0001_baseline.sql'),
            ('0002_alter_vectors.sql')
          on conflict do nothing
        `;
      }
    }

    const applied = new Set(
      (await sql`select filename from public._schema_migrations`).map((r) => r.filename),
    );
    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const cmd = process.argv[2] ?? "apply";

    if (cmd === "status") {
      console.log("Migration status:");
      for (const f of allFiles) {
        const optional = OPTIONAL.has(f);
        let state;
        if (applied.has(f)) state = "applied";
        else if (optional) state = "pending (optional, skipped by default)";
        else state = "pending";
        console.log(`  ${f.padEnd(40)} ${state}`);
      }
      return;
    }

    if (cmd === "mark") {
      const name = process.argv[3];
      if (!name) {
        console.error("Usage: mark <filename>");
        process.exit(1);
      }
      if (!allFiles.includes(name)) {
        console.error(`No such migration file: ${name}`);
        console.error(`Known files: ${allFiles.join(", ")}`);
        process.exit(1);
      }
      await sql`
        insert into public._schema_migrations(filename) values (${name})
        on conflict do nothing
      `;
      console.log(`Marked ${name} as applied.`);
      return;
    }

    if (cmd !== "apply") {
      console.error(`Unknown command: ${cmd}`);
      console.error("Valid commands: apply, status, mark");
      process.exit(1);
    }

    const includeOptional = process.argv.includes("--include-optional");
    const pending = allFiles.filter(
      (f) => !applied.has(f) && (includeOptional || !OPTIONAL.has(f)),
    );

    if (pending.length === 0) {
      console.log("No pending migrations.");
      if (!includeOptional) {
        const skipped = allFiles.filter((f) => !applied.has(f) && OPTIONAL.has(f));
        if (skipped.length > 0) {
          console.log(
            `(${skipped.length} optional migration(s) available with --include-optional: ${skipped.join(", ")})`,
          );
        }
      }
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);
    for (const f of pending) {
      process.stdout.write(`  ${f}... `);
      const body = await readFile(join(MIGRATIONS_DIR, f), "utf8");
      try {
        await sql.unsafe(body);
        await sql`insert into public._schema_migrations(filename) values (${f})`;
        console.log("ok");
      } catch (err) {
        console.log("FAILED");
        console.error(err);
        console.error(`\nMigration ${f} failed. Database is unchanged for this file.`);
        console.error("Inspect the SQL, fix the issue, and re-run.");
        process.exit(1);
      }
    }
    console.log("Done.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Ingest KB markdown for every preset org (demo-company + art-craft-87b0).
 * Use when Google Drive only has NovaMart PDFs and other tenants need hosted /kb/*.md.
 *
 *   npm run ingest:all-demos
 *   npm run ingest:all-demos -- --dry-run
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRESETS = [
  {
    slug: "demo-company",
    title: "NovaMart Knowledge Base",
    url: "https://multi-tenant-support-saas.vercel.app/kb/demo-company/nova-mart-knowledge-base.md",
  },
  {
    slug: "art-craft-87b0",
    title: "Art Craft Knowledge Base",
    url: "https://multi-tenant-support-saas.vercel.app/kb/art-craft-87b0/art-craft-knowledge-base.md",
  },
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

function runOne(preset) {
  return new Promise((resolve, reject) => {
    const args = [
      "run",
      "ingest:kb-url",
      "--",
      "--slug",
      preset.slug,
      "--url",
      preset.url,
      "--title",
      preset.title,
    ];
    if (dryRun) args.push("--dry-run");

    const child = spawn("npm", args, {
      stdio: "inherit",
      cwd: path.join(scriptDir, ".."),
      shell: true,
    });
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${preset.slug} exited ${code}`)),
    );
  });
}

async function main() {
  console.log(dryRun ? "Dry run — both orgs\n" : "Ingesting all demo org KBs…\n");
  for (const preset of PRESETS) {
    console.log(`\n=== ${preset.slug} (${preset.title}) ===`);
    await runOne(preset);
  }
  console.log("\nAll preset orgs processed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Fetch a KB markdown URL (or local file), chunk, embed via OpenRouter, insert into public.documents.
 * Use when n8n webhook ingest is still a status-only stub without URL fetch/chunk nodes.
 *
 *   OPENROUTER_API_KEY=... node --env-file=.env.local scripts/ingest-kb-url.mjs \
 *     --slug art-craft-87b0 \
 *     --url https://multi-tenant-support-saas.vercel.app/kb/art-craft-87b0/art-craft-knowledge-base.md \
 *     --title "Art Craft Knowledge Base"
 */

import { readFile } from "node:fs/promises";
import postgres from "postgres";

const CHUNK_SIZE = 1000;
const OVERLAP = 150;
const EMBED_MODEL = "openai/text-embedding-3-small";

function parseArgs(argv) {
  const args = { slug: null, orgId: null, url: null, file: null, title: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slug = argv[++i];
    else if (a === "--org-id") args.orgId = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--file") args.file = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

function chunkText(raw) {
  const step = CHUNK_SIZE - OVERLAP;
  const chunks = [];
  for (let i = 0; i < raw.length; i += step) {
    const chunk = raw.slice(i, i + CHUNK_SIZE).trim();
    if (chunk.length > 50) chunks.push(chunk);
  }
  return chunks;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res.text();
}

async function embedTexts(apiKey, texts) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://multi-tenant-support-saas.vercel.app",
      "X-Title": "company-chat-ui-ingest",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter embeddings HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  const parsed = JSON.parse(body);
  const data = parsed?.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error("Unexpected embeddings response shape.");
  }
  return data
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding);
}

async function main() {
  const args = parseArgs(process.argv);
  const dbUrl = process.env.DATABASE_URL;
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!apiKey && !args.dryRun) {
    console.error("OPENROUTER_API_KEY is not set.");
    process.exit(1);
  }
  if (!args.slug && !args.orgId) {
    console.error("Provide --slug <site_slug> or --org-id <uuid>.");
    process.exit(1);
  }
  if (!args.url && !args.file) {
    console.error("Provide --url <https://...> or --file <path>.");
    process.exit(1);
  }

  let raw;
  const sourceUri = args.url ?? `file://${args.file}`;
  if (args.file) {
    raw = await readFile(args.file, "utf8");
  } else {
    raw = await fetchText(args.url);
  }

  const chunks = chunkText(raw);
  console.log(`Loaded ${raw.length} chars → ${chunks.length} chunk(s).`);

  if (args.dryRun) {
    console.log("Dry run; no embeddings or DB writes.");
    return;
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 10 });
  try {
    let orgId = args.orgId;
    let orgName = args.orgId;
    if (args.slug) {
      const rows = await sql`
        select id, name from public.orgs where site_slug = ${args.slug} limit 1
      `;
      if (rows.length === 0) {
        throw new Error(`No org with site_slug='${args.slug}'.`);
      }
      orgId = rows[0].id;
      orgName = rows[0].name;
    }

    const title =
      args.title?.trim() ||
      `KB ingest ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

    const [kbDoc] = await sql`
      insert into public.kb_documents (org_id, title, source_uri, ingest_status)
      values (${orgId}::uuid, ${title}, ${sourceUri}, 'running')
      returning id
    `;

    const [job] = await sql`
      insert into public.ingest_jobs (org_id, status, source, payload)
      values (
        ${orgId}::uuid,
        'running',
        'web-url',
        ${JSON.stringify({ title, documentUrl: sourceUri, script: "ingest-kb-url.mjs" })}::jsonb
      )
      returning id
    `;

    const filename = args.file ? args.file.split("/").pop() : new URL(sourceUri).pathname.split("/").pop();
    const uploadedAt = new Date().toISOString();
    let inserted = 0;

    const BATCH = 16;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embedTexts(apiKey, batch);
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const metadata = {
          source: "web-url",
          filename: filename || "knowledge-base.md",
          chunk_index: chunkIndex,
          uploaded_at: uploadedAt,
          kb_document_id: kbDoc.id,
        };
        await sql`
          insert into public.documents (content, metadata, embedding, org_id)
          values (
            ${batch[j]},
            ${sql.json(metadata)},
            ${JSON.stringify(embeddings[j])}::vector(1536),
            ${orgId}::uuid
          )
        `;
        inserted++;
      }
      process.stdout.write(`\rInserted ${inserted}/${chunks.length} chunks…`);
    }
    console.log(`\nDone: ${inserted} chunk(s) for org "${orgName}" (${orgId}).`);

    await sql`
      update public.kb_documents
      set ingest_status = 'ready', updated_at = now()
      where id = ${kbDoc.id}::uuid
    `;
    await sql`
      update public.ingest_jobs
      set status = 'success', updated_at = now()
      where id = ${job.id}::uuid
    `;
    console.log(`kb_documents.id=${kbDoc.id} ingest_jobs.id=${job.id}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();

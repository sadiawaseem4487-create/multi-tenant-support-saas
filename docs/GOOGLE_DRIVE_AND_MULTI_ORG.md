# Google Drive (one NovaMart file) + switching organizations

**Your setup:** One Google Drive folder with **one PDF** (NovaMart).  
**Goal:** Demo chat uses that PDF; **Art craft** (and others) use **different** knowledge — without mixing companies.

**Last updated:** 2026-05-22

---

## How switching works (simple mental model)

| What you switch | How |
|-----------------|-----|
| **Which company the chat answers for** | Open that company’s public URL (not a toggle in n8n) |
| **Which KB the chat searches** | Rows in `documents` with matching `org_id` |
| **Where new KB content comes from** | Per org: Drive **or** URL **or** `npm run ingest:kb-url` |

You do **not** turn “NovaMart mode” on/off in n8n. One chat webhook (`company-chat`) reads `org_id` from the request and searches only that org’s chunks.

| Organization | Public chat URL | Where KB should live |
|--------------|-----------------|----------------------|
| Demo / NovaMart | `/site/demo-company` | Google Drive PDF **or** `/kb/demo-company/...md` |
| Art craft | `/site/art-craft-87b0` | **Not** the NovaMart Drive file — use URL/script ingest |

---

## Part A — Fix n8n (required clicks)

Open workflow **Ingest Webhook with Status Callbacks** in n8n Cloud.

### A1 — Chat: **Create Embedding1** (fixes empty/wrong embeddings)

Your app sends **`question`**, not `message`. Open **Create Embedding1** → Body (JSON):

```json
={{
  {
    "model": "openai/text-embedding-3-small",
    "input": String(
      $json.body?.question ||
      $json.body?.message ||
      $json.question ||
      $json.message ||
      ""
    ).trim()
  }
}}
```

(If your node uses “Body Parameters”, set `input` to the same expression.)

### A2 — Chat: **Search Similar Chunks** (you likely have this)

Confirm body parameter:

| Name | Value |
|------|--------|
| `tenant_org_id` | `={{ $('Webhook').first().json.body.org_id }}` |

Remove `company_name` if it is still there.

### A3 — Drive: **Create a row** — stamp Demo org (NovaMart PDF only)

Because your Drive folder is **only NovaMart**, every chunk from Drive belongs to **Demo organization**.

Open **Create a row** (Supabase, after Drive **Merge**) → **Add field**:

| Field | Value |
|-------|--------|
| `org_id` | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |

Keep `content`, `metadata`, `embedding` as they are.

**Re-ingest:** Drop the PDF again (or delete old rows with `org_id` null and re-run Drive).

```sql
-- Optional: fix old Drive rows missing org_id
update public.documents
set org_id = '2e8e41c1-ce80-4de0-b125-ec3b1497fef5'::uuid
where org_id is null;
```

### A4 — Ingest webhook: **Set Ingest Context** → `webhookSecret`

Replace hardcoded hex with (match Vercel `WEBHOOK_SECRET`):

```text
={{ $env.WEBHOOK_SECRET }}
```

Or paste current Vercel value if you do not use n8n env vars.

### A5 — Save + Publish

Workflow must be **Active / Published**.

**Vercel env (must match paths):**

| Variable | n8n path |
|----------|----------|
| `N8N_WEBHOOK_URL` | `.../webhook/company-chat` |
| `INGEST_WEBHOOK_URL` | `.../webhook/company-ingest` |

---

## Part B — Art craft (and other orgs) when Drive = NovaMart only

Drive **cannot** serve two companies from **one** PDF in **one** folder unless you duplicate the chain (Part C). For class demo, use **hosted markdown + script** (fastest).

### Option 1 — One command (recommended)

From `~/company-chat-ui`:

```bash
cp .env.example .env.local   # if needed; fill DATABASE_URL + OPENROUTER_API_KEY
npm run ingest:all-demos
```

This ingests:

- Demo → `nova-mart-knowledge-base.md`
- Art craft → `art-craft-knowledge-base.md`

Each run sets `documents.org_id` correctly.

### Option 2 — One org at a time

```bash
npm run ingest:kb-url -- --slug art-craft-87b0 \
  --url https://multi-tenant-support-saas.vercel.app/kb/art-craft-87b0/art-craft-knowledge-base.md \
  --title "Art Craft Knowledge Base"
```

### Option 3 — Admin UI (only after n8n ingest URL pipeline is built)

Admin → switch org → **Knowledge** → paste Art craft document URL → Start ingest.  
Today your **Webhook - Ingest Start** branch may only mark jobs success without indexing — use Option 1 until [N8N_EXACT_CHANGES.md](./N8N_EXACT_CHANGES.md) Change 5 is wired.

---

## Part C — Later: two Google Drive folders (two companies from Drive)

When you want **both** orgs fed from Drive:

1. In Google Drive create:

```text
KB-Ingest/
  demo-company/     ← NovaMart PDFs here
  art-craft-87b0/   ← Art craft PDFs here
```

2. In n8n **duplicate** the whole Drive chain (trigger → … → Create a row).

3. Point each trigger at its subfolder.

4. On each **Create a row**:

| Branch | `org_id` |
|--------|----------|
| Demo | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |
| Art craft | `876b7601-e7d8-40cb-a314-ada04ac3d710` |

Step-by-step: [N8N_EXACT_CHANGES.md](./N8N_EXACT_CHANGES.md) → “Two-folder wiring”.

---

## Part D — Verify both companies work

### 1) Supabase

```sql
select o.name, o.site_slug, count(d.id) as chunks
from public.orgs o
left join public.documents d on d.org_id = o.id
where o.site_slug in ('demo-company', 'art-craft-87b0')
group by o.id, o.name, o.site_slug;
```

Both should have `chunks > 0`.

### 2) Public chat

- https://multi-tenant-support-saas.vercel.app/site/demo-company  
  Ask: *“What is the return window?”* (NovaMart)

- https://multi-tenant-support-saas.vercel.app/site/art-craft-87b0  
  Ask something only in Art craft KB (workshops / crafts)

Answers must **differ** and match each file.

### 3) n8n execution

Run test on **Webhook** with Art craft `org_id` (see [N8N_EXACT_CHANGES.md](./N8N_EXACT_CHANGES.md)). **Search Similar Chunks** must return rows when Art craft has chunks.

---

## Summary

| Source | Organization | Action |
|--------|--------------|--------|
| **Google Drive (1 PDF)** | Demo / NovaMart only | Add `org_id` = Demo UUID on **Create a row** |
| **Hosted `/kb/...md` + script** | Art craft (and extras) | `npm run ingest:all-demos` |
| **Public chat** | Switch by URL | `/site/demo-company` vs `/site/art-craft-87b0` |
| **n8n chat** | All orgs, one workflow | `tenant_org_id` = `body.org_id` + fix **Create Embedding1** `question` |

---

## Org UUIDs (copy-paste)

| Organization | `org_id` |
|--------------|----------|
| Demo organization | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |
| Art craft | `876b7601-e7d8-40cb-a314-ada04ac3d710` |

If your Supabase IDs differ, run:

```sql
select id, name, site_slug from public.orgs order by name;
```

Use those UUIDs in n8n instead.

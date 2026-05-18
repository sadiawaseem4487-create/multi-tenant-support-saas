# Knowledge base — one file per organization

Each tenant’s chatbot only answers from **`public.documents` rows with that org’s `org_id`**.  
Add content by **ingesting a file per org** (this folder + admin UI).

## Prepared files (in repo)

| Organization | Admin org switcher | Site slug | KB file in repo | Production URL for ingest |
|--------------|-------------------|-----------|-----------------|---------------------------|
| Demo organization | Demo organization | `demo-company` | `public/kb/demo-company/nova-mart-knowledge-base.md` | `https://multi-tenant-support-saas.vercel.app/kb/demo-company/nova-mart-knowledge-base.md` |
| Art craft | Art craft | `art-craft-87b0` | `public/kb/art-craft-87b0/art-craft-knowledge-base.md` | `https://multi-tenant-support-saas.vercel.app/kb/art-craft-87b0/art-craft-knowledge-base.md |

Local dev URL pattern: `http://localhost:3000/kb/<site-slug>/<filename>.md`

> **Demo org note:** You may already have chunks from `NovaMart_Knowledge_Base.pdf`. Ingesting the `.md` URL again adds more chunks (same topics). For a clean demo you can delete the old file in **Knowledge → KB files** first, or keep both.

---

## How to ingest (per org)

1. Deploy the app (so `/kb/...` URLs are reachable), or run `npm run dev` locally.
2. Sign in → **Admin** → select the **correct organization** in the org dropdown.
3. Open **Knowledge**.
4. Fill **Add knowledge from a URL**:
   - **Title:** e.g. `NovaMart Knowledge Base` or `Art Craft Knowledge Base`
   - **Document URL:** copy from the table above for that org
   - **Source:** `manual-upload` or `web-url`
5. Click submit → wait until job status is **success** (refresh).
6. Test public chat: `/site/<site-slug>` — ask a question that appears in that markdown file.

---

## Ingest form — exact values

### Demo organization (NovaMart-style retail)

| Field | Value |
|-------|--------|
| Title | `NovaMart Knowledge Base (MD)` |
| Document URL | `https://multi-tenant-support-saas.vercel.app/kb/demo-company/nova-mart-knowledge-base.md` |
| Source | `web-url` |

**Test questions:** “What is NovaMart?”, “What is the return window?”, “What payment methods are accepted?”

### Art craft (crafts & workshops)

| Field | Value |
|-------|--------|
| Title | `Art Craft Knowledge Base` |
| Document URL | `https://multi-tenant-support-saas.vercel.app/kb/art-craft-87b0/art-craft-knowledge-base.md` |
| Source | `web-url` |

**Test questions:** “What workshops do you offer?”, “How long does shipping take to Finland?”, “Can I reschedule a workshop?”

Ask the **same** question on both `/site/demo-company` and `/site/art-craft-87b0` — answers should **differ** (proves tenant isolation).

---

## Add a new organization

1. **Admin → Organizations** — create org (or use bootstrap).
2. **Admin → Settings** — set **Site slug** (e.g. `acme-support`).
3. Copy template:
   ```bash
   mkdir -p public/kb/acme-support
   cp public/kb/_template/knowledge-base-template.md public/kb/acme-support/acme-knowledge-base.md
   ```
4. Edit the markdown (company name, policies, FAQs).
5. Commit & deploy.
6. Ingest: `https://<your-app>/kb/acme-support/acme-knowledge-base.md` while that org is selected in admin.

---

## Other ways to add KB data

| Method | When to use |
|--------|-------------|
| **URL ingest** (above) | Markdown hosted in `public/kb/` or any public HTTPS URL |
| **Google Drive** (n8n) | Auto-ingest when files land in a folder — set `org_id` in workflow |
| **PDF** | Upload to Drive or host PDF URL if n8n workflow supports PDF extract |

---

## Where data is stored (Supabase)

| What | Table | Scoped by |
|------|--------|-----------|
| Text chunks + embeddings | `public.documents` | `org_id` |
| Ingest run history | `public.ingest_jobs` | `org_id` |
| File registry row | `public.kb_documents` | `org_id` |

Nothing in Vercel env vars holds KB text — only URLs and n8n process the file.

---

## Program office copy

Original NovaMart source also lives at:

`~/company costumer service/NovaMart_Knowledge_Base.md` (and `.pdf`)

The copy under `public/kb/demo-company/` is kept in sync for deployable ingest URLs.

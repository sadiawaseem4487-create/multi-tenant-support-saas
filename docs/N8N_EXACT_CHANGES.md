# Exact n8n changes (your workflow: “Ingest Webhook with Status Callbacks”)

Do these in **n8n Cloud** → open the workflow → **Save** → toggle **Published / Active** when done.

**Google Drive has only NovaMart?** Read **[GOOGLE_DRIVE_AND_MULTI_ORG.md](./GOOGLE_DRIVE_AND_MULTI_ORG.md)** — Drive = Demo org; Art craft via `npm run ingest:all-demos`.

Copy **`WEBHOOK_SECRET`** from **Vercel** (Settings → Environment Variables). Use the **same** value everywhere below (not an old value from an exported JSON file).

**Your org IDs (Supabase):**

| Organization | `org_id` (UUID) |
|--------------|-----------------|
| Demo organization (NovaMart KB) | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |
| Art craft | `876b7601-e7d8-40cb-a314-ada04ac3d710` |

---

## Change 0 — Chat: **Create Embedding1** must read `question` (required)

Next.js sends `question` in the webhook body. Your node may only read `message` / `chatInput` → empty embedding → bad retrieval.

Open **Create Embedding1** → set body `input` to:

```text
={{ String($json.body?.question || $json.body?.message || $json.question || $json.message || "").trim() }}
```

Or use JSON body mode:

```json
={{
  {
    "model": "openai/text-embedding-3-small",
    "input": String($json.body?.question || $json.body?.message || $json.question || $json.message || "").trim()
  }
}}
```

---

## Change 1 — Google Drive → stamp `org_id` on every chunk (required)

**Problem today:** node **Create a row** saves `content`, `metadata`, `embedding` but **not `org_id`**, so chat cannot find chunks per company.

### Option A — One Drive folder = Demo org only (simplest)

Use this if **all PDFs** in your watched folder should belong to **Demo / NovaMart**.

1. Open node **Create a row** (Supabase, after **Merge** on the **top row**).
2. **Table:** `documents` (unchanged).
3. Under **Fields to Send**, click **Add Field**:

| Field Name | Field Value |
|------------|-------------|
| `org_id` | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |

4. Leave existing fields: `content`, `metadata`, `embedding`.
5. **Execute step** on **Create a row** (with test data upstream) or drop a small PDF in Drive and check Supabase:

```sql
select org_id, metadata->>'filename', count(*)
from public.documents
group by 1, 2;
```

New rows should show `org_id = 2e8e41c1-...`, not `NULL`.

### Option B — Two subfolders = two companies (recommended for your demo)

See **[Two-folder wiring (step-by-step)](#two-folder-wiring-step-by-step)** below for click-by-click instructions.

**Important:** Customers in production would connect **their own** Google account (their credential in n8n), not your personal Drive. Your Drive = **platform demo only**.

---

## Two-folder wiring (step-by-step)

Goal: PDF in `demo-company` → chunks for **Demo** chat only. PDF in `art-craft-87b0` → chunks for **Art craft** only.

### Step 1 — Google Drive folders (5 min)

In the same Google account connected to n8n (**Google Drive account 3**):

1. Create a parent folder, e.g. **`KB-Ingest`**.
2. Inside it, create two subfolders (names matter for you, not for code):

```text
KB-Ingest/
  demo-company/        ← put NovaMart PDFs here
  art-craft-87b0/      ← put Art craft PDFs here
```

3. Upload at least one **PDF** into each subfolder (your workflow uses **Extract from File → PDF**).

> n8n watches **one folder per trigger**. A file in `demo-company` does **not** fire a trigger on the parent folder alone—you must point each trigger at the **subfolder**.

### Step 2 — Duplicate the ingest chain in n8n (15 min)

You already have this chain (top row):

`Google Drive Trigger` → `Download File` → `Extract from File` → `Code in JavaScript` → `Create Embedding` → `Merge` → `Create a row`

**Do this:**

1. Select all nodes from **Google Drive Trigger** through **Create a row** (top row).
2. **Copy** (Ctrl+C) and **Paste** (Ctrl+V) below or above—n8n creates a second copy.
3. Rename for clarity:

| Original (rename to) | Copy (rename to) |
|----------------------|------------------|
| Google Drive Trigger | **GDrive Trigger — Demo** |
| *(paste copy)* | **GDrive Trigger — Art craft** |

Rename the rest on each branch: `Download File (Demo)`, `Download File (Art)`, etc. (optional but helps).

### Step 3 — Point each trigger at its subfolder

**Node: GDrive Trigger — Demo**

| Setting | Value |
|---------|--------|
| Trigger On | Specific Folder |
| Event | File Created |
| Folder to Watch | Select **`KB-Ingest/demo-company`** in the picker |

**Node: GDrive Trigger — Art craft**

| Setting | Value |
|---------|--------|
| Folder to Watch | Select **`KB-Ingest/art-craft-87b0`** |

Credential: same **Google Drive account 3** on both triggers.

### Step 4 — Stamp `org_id` on each branch

On **each** branch, open **Create a row** (Supabase) and add field **`org_id`**:

**Create a row (Demo branch)**

| Field | Value |
|-------|--------|
| `org_id` | `2e8e41c1-ce80-4de0-b125-ec3b1497fef5` |
| `content` | `={{$json.chunk}}` *(unchanged)* |
| `metadata` | *(unchanged)* |
| `embedding` | `={{$json.data[0].embedding}}` *(unchanged)* |

**Create a row (Art craft branch)**

| Field | Value |
|-------|--------|
| `org_id` | `876b7601-e7d8-40cb-a314-ada04ac3d710` |
| *(other fields same as Demo branch)* | |

You do **not** need a separate **Set** node if you use a **fixed UUID** on each **Create a row**.

### Step 5 — Wiring diagram (both branches)

```text
[DEMO subfolder]
  GDrive Trigger — Demo
    → Download File (Demo)
    → Extract from File (Demo)
    → Code in JavaScript (Demo)
    → Create Embedding (Demo)
    → Merge (Demo)
    → Create a row (Demo)     org_id = 2e8e41c1-...

[ART subfolder]
  GDrive Trigger — Art craft
    → Download File (Art)
    → Extract from File (Art)
    → Code in JavaScript (Art)
    → Create Embedding (Art)
    → Merge (Art)
    → Create a row (Art)        org_id = 876b7601-...
```

The two branches are **independent**. They do not connect to each other.

### Step 6 — Save, publish, test

1. **Save** workflow.
2. **Publish** / activate workflow.
3. Drop a **new** small PDF into `demo-company` only.
4. In n8n **Executions**, open the run for **GDrive Trigger — Demo** (should be green).
5. In Supabase:

```sql
select org_id, metadata->>'filename', left(content, 40)
from public.documents
order by id desc
limit 5;
```

New rows must show `org_id` = Demo UUID, not NULL.

6. Open https://multi-tenant-support-saas.vercel.app/site/demo-company and ask something **in that PDF**.
7. Repeat with a PDF in `art-craft-87b0` and test https://multi-tenant-support-saas.vercel.app/site/art-craft-87b0 .

### Step 7 — Chat row (still required)

Even with Drive fixed, chat must use **tenant_org_id** on **Search Similar Chunks** (see [Change 2](#change-2--chat-row-tenant-scoped-search-required)).

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Trigger never runs | Workflow not Published; wrong folder selected; file not PDF |
| Execution fails on Extract | File is not PDF—convert or change Extract node |
| Chunks in DB but chat empty | **Search Similar Chunks** missing `tenant_org_id` |
| Wrong company answers | `org_id` on **Create a row** is the wrong UUID for that branch |
| Both companies get same KB | Both branches use the same `org_id`—fix Step 4 |

### Option A recap — one folder only (Demo)

If you only need **Demo** from Drive: keep **one** trigger on a single folder and only add on **Create a row**:

`org_id` = `2e8e41c1-ce80-4de0-b125-ec3b1497fef5`

Use **URL / script ingest** for Art craft (`npm run ingest:kb-url` or hosted markdown).

### Google Drive Trigger settings (verify)

Node **Google Drive Trigger**:

| Setting | Value |
|---------|--------|
| Trigger On | Specific Folder |
| Event | File Created |
| Folder | Your ingest folder (today: ID `1q42su5Wq1grcvclicvu5F6M6o9gHETW9` or pick folder in UI) |
| Credential | Google Drive account 3 (your account) |

**File types:** **Extract from File** is set to **PDF**. For `.md` / `.docx`, change operation or add another extract node.

---

## Change 2 — Chat row: tenant-scoped search (required)

**Problem today:** node **Search Similar Chunks** sends `company_name` = `NovaCompany`. The database expects **`tenant_org_id`** (UUID). Without this, retrieval is wrong or empty.

1. Open **Search Similar Chunks** (HTTP Request → Supabase RPC).
2. **Method:** POST  
   **URL:** `https://yxsblmpcuqvbwkmcwkkk.supabase.co/rest/v1/rpc/match_documents`  
   *(keep your project URL if different)*

3. **Body Parameters** — **remove** parameter named `company_name`.

4. **Add / keep** these body parameters:

| Name | Value |
|------|--------|
| `query_embedding` | `={{ $json.data[0].embedding }}` |
| `match_count` | `4` |
| `filter` | `={{ {} }}` or `{}` |
| `tenant_org_id` | `={{ $('Webhook').first().json.body.org_id }}` |

5. **Headers:** use **Supabase Service** credential (see `N8N_CREDENTIALS_SETUP.md` Part B) — remove plaintext `apikey` / `Authorization` from the node when credential is wired.

6. **Test:** Execute **Webhook** (chat) test payload:

```json
{
  "question": "What workshops do you offer?",
  "org_id": "876b7601-e7d8-40cb-a314-ada04ac3d710",
  "org_name": "Art craft",
  "company_name": "NovaCompany",
  "correlation_id": "test-123"
}
```

Then run downstream nodes. **Search Similar Chunks** should return rows only for Art craft.

---

## Change 3 — Invite webhook: fix field mapping (if invites still wrong)

Open **Set Invite Data** and set **exactly**:

| Field name | Expression (value) |
|------------|-------------------|
| `invitationId` | `={{ $('Webhook - Invite').first().json.body.invitationId }}` |
| `orgId` | `={{ $('Webhook - Invite').first().json.body.orgId }}` |
| `orgName` | `={{ $('Webhook - Invite').first().json.body.orgName }}` |
| `invitedEmail` | `={{ $('Webhook - Invite').first().json.body.invitedEmail }}` |
| `role` | `={{ $('Webhook - Invite').first().json.body.role }}` |
| `inviteToken` | `={{ $('Webhook - Invite').first().json.body.inviteToken }}` |
| `expiresAt` | `={{ $('Webhook - Invite').first().json.body.expiresAt }}` |
| `invitedByUserId` | `={{ $('Webhook - Invite').first().json.body.invitedByUserId }}` |
| `invitedByEmail` | `={{ $('Webhook - Invite').first().json.body.invitedByEmail }}` |
| `inviteLink` | `={{ $('Webhook - Invite').first().json.body.appBaseUrl + '/accept-invite?token=' + $('Webhook - Invite').first().json.body.inviteToken }}` |

**Do not** map `invitationId` from `invitedEmail` or `orgId` from `orgName`.

---

## Change 4 — Webhook secret = Vercel (all branches)

Use the **current** `WEBHOOK_SECRET` from Vercel in **both** places (plain text is fine on free plan; no Variables required).

### 4a — Invite branch

Node **IF Secret Valid?**:

| Left value | Operator | Right value |
|------------|----------|-------------|
| `={{ $json.incomingSecret }}` | equals | *paste Vercel `WEBHOOK_SECRET`* |

### 4b — Ingest branch

Node **Set Ingest Context** → field **`webhookSecret`**:

| Field | Value |
|-------|--------|
| `webhookSecret` | *paste same Vercel `WEBHOOK_SECRET`* |

Nodes **Callback Running**, **Callback Success**, **Callback Failed** use:

`={{ $('Set Ingest Context').item.json.webhookSecret }}`

for header **`X-Webhook-Secret`** (already wired — just ensure `Set Ingest Context` is correct).

### 4c — Chat branch (recommended)

Chat **Webhook** currently goes straight to **Create Embedding1** with **no** secret check.

**Optional but recommended:** insert **Set Secret** + **IF Secret Valid?** (copy from invite row) between **Webhook** and **Create Embedding1**:

- **Set Secret** → `incomingSecret` = `={{ ($json.headers["x-webhook-secret"] || "").trim() }}`
- **IF** → equals Vercel `WEBHOOK_SECRET`
- **False** → **Respond to Webhook** with 401 `{"error":"unauthorized"}`
- **True** → **Create Embedding1**

---

## Change 5 — Ingest webhook: real URL ingest (optional, for Admin “Start ingest”)

**Problem today:** **Webhook - Ingest Start** only updates job status (**Callback Running → Success**) and does **not** fetch `payload.documentUrl`, chunk, or embed.

To make **Admin → Knowledge → Start ingest** actually index a URL, insert nodes **after Set Ingest Context** and **before Callback Success**:

```text
Set Ingest Context
  → Callback Running (PATCH status=running)
  → HTTP Request: GET documentUrl
  → Code: chunk text (same logic as "Code in JavaScript" on Drive row)
  → Create Embedding (OpenRouter, reuse existing node pattern)
  → Supabase Create a row with org_id = {{ $('Set Ingest Context').item.json.orgId }}
  → IF Failed? → Callback Success / Callback Failed
```

### 5a — HTTP Request “Fetch document URL”

| Setting | Value |
|---------|--------|
| Method | GET |
| URL | `={{ $('Set Ingest Context').item.json['payload (JSON type) '].documentUrl }}` |

If payload is a string, add a **Code** node first to parse JSON from `payload` field on the ingest context item.

**Simpler expression** if payload is object in body (stored in Set Ingest Context):

Parse in **Code** node:

```javascript
const ctx = $('Set Ingest Context').first().json;
const payload = typeof ctx.payload === 'string' ? JSON.parse(ctx.payload) : (ctx.payload || {});
const url = payload.documentUrl;
if (!url) throw new Error('payload.documentUrl missing');
const res = await fetch(url);
const text = await res.text();
return [{ json: { ...ctx, rawText: text, documentUrl: url } }];
```

Then chunk `rawText` in the next Code node (copy chunk loop from **Code in JavaScript**).

### 5b — Supabase insert on URL ingest path

| Field | Value |
|-------|--------|
| `org_id` | `={{ $('Set Ingest Context').item.json.orgId }}` |
| `content` | chunk text |
| `embedding` | from Create Embedding |
| `metadata` | `{ source: 'web-url', filename: '...', chunk_index: n }` |

Until Change 5 is done, use **`npm run ingest:kb-url`** or hosted markdown URLs (Art craft already ingested this way).

---

## Change 6 — OpenRouter & Supabase credentials (security)

Follow **`docs/N8N_CREDENTIALS_SETUP.md`**:

1. **Create Embedding**, **Create Embedding1**, **Generate Answer** → Header Auth credential **OpenRouter** (delete manual `Authorization` header).
2. **Search Similar Chunks** → Custom Auth **Supabase Service** (delete plaintext keys in node).

---

## Quick test checklist

| Test | How | Pass? |
|------|-----|-------|
| Drive ingest | Drop PDF in watched folder | n8n execution green; Supabase `documents.org_id` set |
| Demo chat | `/site/demo-company` — NovaMart question | Answer from KB, not generic fallback |
| Art craft chat | `/site/art-craft-87b0` — workshop question | Different answer from Demo |
| Invite | Admin → invite email | Email arrives; accept link works |
| Admin ingest | Start ingest with public KB URL | Chunks increase (after Change 5) or use CLI script |

---

## What to say when audience asks about Google Drive

> “This folder is **our** operations Drive for demos. Each **customer** would use **their own** Drive account or upload URLs in admin—not files in my personal folder. Technically we tag every chunk with a **company ID** in the database so answers stay separate.”

---

## Webhook URLs (must match Vercel)

| Vercel env var | n8n node | Path |
|----------------|----------|------|
| `N8N_WEBHOOK_URL` | **Webhook** (chat row) | `company-chat` |
| `INGEST_WEBHOOK_URL` | **Webhook - Ingest Start** | `company-ingest` |
| `INVITE_WEBHOOK_URL` | **Webhook - Invite** | `company-invite` |

Production base: `https://n8workflow.app.n8n.cloud/webhook/…`

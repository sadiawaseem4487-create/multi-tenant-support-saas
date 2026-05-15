# n8n credentials and variables (Task 2)

Move secrets out of workflow JSON into n8n **Credentials** and **Variables** so exports are safe and Vercel secret rotation does not break invites again.

**Prerequisites:** Admin access to n8n Cloud, current `WEBHOOK_SECRET` from Vercel, new OpenRouter key and Supabase service role key if rotating leaked keys.

---

## Part A — OpenRouter (3 nodes)

### A1. Create credential

1. n8n → **Credentials** → **Add credential** → **Header Auth**.
2. Name: `OpenRouter`.
3. Header name: `Authorization`
4. Header value: `Bearer <YOUR_OPENROUTER_API_KEY>`
5. **Save**.

### A2. Wire into nodes

For each node: **Create Embedding**, **Create Embedding1**, **Generate Answer**:

1. Open the node → **Authentication** → **Generic Credential Type** → **Header Auth** → select **OpenRouter**.
2. Under **Header Parameters**, **delete** the manual `Authorization` row (trash icon).
3. Keep `Content-Type`, `HTTP-Referer`, `X-Title`.
4. **Execute step** → expect HTTP 200 (or a valid API response).
5. **Save** workflow.

---

## Part B — Supabase RPC (Search Similar Chunks)

### B1. Create credential

1. **Credentials** → **Add credential** → **Custom Auth**.
2. Name: `Supabase Service`.
3. JSON (replace with your service role key):

```json
{
  "headers": {
    "apikey": "<SUPABASE_SERVICE_ROLE_KEY>",
    "Authorization": "Bearer <SUPABASE_SERVICE_ROLE_KEY>"
  }
}
```

4. **Save**.

### B2. Wire into node

1. Open **Search Similar Chunks**.
2. **Authentication** → **Custom Auth** → **Supabase Service**.
3. Delete manual `apikey` and `Authorization` header rows; keep `Content-Type`.
4. Confirm body parameters (no `company_name`):

| Parameter | Value |
|-----------|--------|
| `query_embedding` | `={{$json.data[0].embedding}}` |
| `match_count` | `4` |
| `filter` | `={{ {} }}` |
| `tenant_org_id` | `={{$json.tenant_org_id \|\| $('Webhook').item.json.body.org_id}}` |

5. **Execute step** with a test chat payload → chunks returned.
6. **Save** workflow.

---

## Part C — Webhook secret (2 nodes + Vercel)

Use the **same** hex string as Vercel `WEBHOOK_SECRET`.

### C1. Free / Starter plan (no Variables tab)

n8n **Variables** require **Pro**. Paste the secret directly in **two** nodes:

| Node | Field | Value |
|------|--------|--------|
| **IF Secret Valid?** | Condition **right** value | Full Vercel `WEBHOOK_SECRET` hex (plain text, no `={{ }}`) |
| **Set Ingest Context** | `webhookSecret` | Same hex |

When you rotate the secret later, update **both** nodes **and** Vercel, then redeploy.

### C2. Pro plan (optional — single source of truth)

1. n8n → **Variables** → **Add variable** → Key: `WEBHOOK_SECRET` → paste Vercel value.
2. **IF Secret Valid?** right value: `={{ $vars.WEBHOOK_SECRET }}`
3. **Set Ingest Context** `webhookSecret`: `={{ $vars.WEBHOOK_SECRET }}`

### C3. Vercel

Vercel → Project → **Environment Variables** → `WEBHOOK_SECRET` must match exactly → **Redeploy**.

---

## Part D — Verify

1. **Invite:** `/admin/members` → invite test email → no `401 Unauthorized webhook secret`; email arrives.
2. **Chat:** `/site/<slug>` → question → answer (not constant fallback).
3. **Ingest:** start job from `/admin/knowledge` → job reaches `success` or `failed` with error in UI.
4. **Export workflow** → open JSON → search must find **no** `sk-or-`, `sb_secret_`, or full webhook hex.

---

## Part E — Rotate leaked keys (if not done yet)

| Secret | Where to rotate |
|--------|------------------|
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) — revoke old, update credential |
| Supabase service role | Supabase → Settings → API → reset service role → update credential |
| Webhook secret | `openssl rand -hex 32` → update both n8n nodes + Vercel (+ Variable if Pro) → redeploy |

See also: [WEBHOOK_SECURITY_ROTATION.md](./WEBHOOK_SECURITY_ROTATION.md).

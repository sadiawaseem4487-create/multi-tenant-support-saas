# Ingest retry and failure handling (S4-3)

How ingest jobs move through states, what to do when they fail, and how n8n retries fit in.

## Job lifecycle

```
queued → running → success
                 ↘ failed
```

| Status | Meaning |
|--------|---------|
| `queued` | Next.js created `ingest_jobs` row and called n8n |
| `running` | n8n **Callback Running** PATCH received |
| `success` | n8n **Callback Success** PATCH received |
| `failed` | n8n **Callback Failed** PATCH or Next.js marked failed on dispatch error |

UI: `/admin/knowledge` — **Ingest jobs** table and **KB status** card (last error, active jobs).

## Where failures surface

1. **Admin UI** — failed row shows `error` text; KB status card shows last ingest error.
2. **`public.ingest_jobs`** — `status`, `error`, `n8n_execution_id`.
3. **`public.audit_logs`** — `ingest.started`, `ingest.completed`, `ingest.failed` (when wired).
4. **n8n Executions** — open failed run → node that errored (red).

## n8n built-in retry

On any node: **Settings** → **Retry On Fail**:

- **Max tries:** 3
- **Wait between tries:** 1000–5000 ms

Recommended for: **Download File**, **Create Embedding**, **Callback Running/Success/Failed** (transient network).

Avoid infinite retry on **Webhook** triggers (duplicates jobs). Prefer failing fast and marking job `failed` via callback.

## Manual retry (operator)

1. Fix root cause (Drive auth, OpenRouter quota, Supabase key, wrong `org_id` in payload).
2. `/admin/knowledge` → start ingest again with same source URL/title.
3. Or re-drop file in Google Drive if using Drive trigger.

## Dead-letter pattern (manual today)

There is no separate DLQ table. Treat **failed** ingest jobs as the queue:

```sql
select id, org_id, status, error, created_at, updated_at
from public.ingest_jobs
where status = 'failed'
order by updated_at desc
limit 20;
```

Re-run after fix; old failed rows remain for audit.

## Callback contract (must not change)

`PATCH /api/internal/ingest-jobs/:jobId`

Headers:

- `Content-Type: application/json`
- `X-Webhook-Secret: <same as WEBHOOK_SECRET>`

Body examples:

```json
{ "status": "running", "n8nExecutionId": "12345" }
```

```json
{ "status": "success", "n8nExecutionId": "12345" }
```

```json
{ "status": "failed", "n8nExecutionId": "12345", "error": "Human-readable message" }
```

If callback returns **401**, check `Set Ingest Context.webhookSecret` matches Vercel `WEBHOOK_SECRET`.

## Checklist after an incident

- [ ] n8n execution log reviewed
- [ ] `ingest_jobs.error` matches user-visible message
- [ ] Supabase `documents` has new chunks for org (if success path)
- [ ] Chat smoke test on `/site/<slug>` for that org
- [ ] Rotate credentials if failure was auth-related

## Related docs

- [N8N_CREDENTIALS_SETUP.md](./N8N_CREDENTIALS_SETUP.md)
- [WEBHOOK_SECURITY_ROTATION.md](./WEBHOOK_SECURITY_ROTATION.md)
- Program office: `docs/n8n/INGEST_WORKFLOW.md`

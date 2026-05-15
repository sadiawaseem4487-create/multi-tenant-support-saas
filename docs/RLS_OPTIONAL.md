# Optional Row-Level Security (defense-in-depth)

RLS adds a second tenant boundary in Postgres. The app already scopes every query by `org_id`; RLS is **optional** and not required for Sprint 2 closure.

## When to apply

- You want defense-in-depth if a future query forgets `org_id`.
- You accept that n8n (service role) and migrations bypass RLS by design.

## How to apply

From `company-chat-ui` with `DATABASE_URL` in `.env.local`:

```bash
npm run db:migrate:rls
```

This applies `db/migrations/0004_row_level_security.sql` (same intent as program office `schema-v0.3-row-level-security.sql`).

Check status:

```bash
npm run db:migrate:status
```

## Verify (after apply)

1. App still works: sign in, `/admin`, chat, ingest.
2. n8n chat + ingest still work (service role bypasses RLS).
3. In Supabase SQL editor, confirm policies exist:

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename;
```

## Roll back

See commented `DROP POLICY` / `DISABLE ROW LEVEL SECURITY` block at the bottom of `0004_row_level_security.sql`.

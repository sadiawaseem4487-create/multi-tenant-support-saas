# Webhook Security and Key Rotation

This document defines how webhook authentication is handled between Next.js and n8n, and how to rotate secrets safely without downtime.

## Current implementation

- Outbound webhooks from Next.js include `X-Webhook-Secret` when `WEBHOOK_SECRET` is set.
- Internal ingest status callback endpoint (`PATCH /api/internal/ingest-jobs/:jobId`) validates `X-Webhook-Secret`.
- Current protected webhook paths:
  - `POST /api/chat` -> `N8N_WEBHOOK_URL`
  - `POST /api/orgs/:orgId/ingest` -> `INGEST_WEBHOOK_URL`
  - `POST /api/admin/invitations` -> `INVITE_WEBHOOK_URL`
  - `PATCH /api/internal/ingest-jobs/:jobId` (n8n -> Next.js callback)

## Secret policy

- Use separate secrets for each environment (local/staging/production).
- Never reuse exposed or shared secrets.
- Store secrets only in environment variables (never in repo).
- Minimum length: 32+ random bytes (hex string recommended).

## Rotation policy (global key)

Rotate `WEBHOOK_SECRET` every 60-90 days, or immediately after suspected exposure.

### Zero-downtime rotation steps

1. Generate a new random secret.
2. Update n8n workflows/credentials to use the new secret.
3. Update Next.js environment variable `WEBHOOK_SECRET` in deployment platform.
4. Redeploy Next.js.
5. Run smoke tests:
   - Chat request succeeds.
   - Invite email webhook succeeds.
   - Ingest start succeeds.
   - Ingest callback updates job status.
6. Remove any old secret from password manager notes and temporary tooling.

## Recommended next hardening (future)

- Move from shared secret to HMAC signatures (`X-Webhook-Signature` + timestamp).
- Add replay protection window (5 minutes).
- Optionally support per-org webhook keys (`orgs.settings.webhook_key_id` + secret vault mapping).

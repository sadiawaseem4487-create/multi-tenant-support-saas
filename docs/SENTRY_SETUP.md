# Sentry setup (S4-1)

Error reporting for the Next.js app. **Disabled by default** until you set a DSN.

## 1. Create a Sentry project

1. Sign in at [sentry.io](https://sentry.io).
2. **Create project** → platform **Next.js**.
3. Copy the **DSN** (looks like `https://…@….ingest.sentry.io/…`).

## 2. Configure Vercel

| Variable | Scope | Value |
|----------|--------|--------|
| `SENTRY_DSN` | Production, Preview | Your DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Same DSN if you want client-side errors in Sentry |

Redeploy after saving.

Local: add `SENTRY_DSN=…` to `.env.local`.

## 3. Verify

1. Deploy with DSN set.
2. Trigger a test error (temporary `throw new Error("sentry test")` in a dev-only route, or use Sentry’s “Send test event” in project settings).
3. Open Sentry → **Issues** — event should appear within ~1 minute.

## What is instrumented

- Server components and API routes via `instrumentation.ts` + `onRequestError`
- Client via `sentry.client.config.ts`
- Root UI errors via `app/global-error.tsx`

No DSN → Sentry does not initialize (zero overhead).

## Optional: source maps

For readable stack traces in production, configure Sentry’s Next.js plugin (`withSentryConfig`) and `SENTRY_AUTH_TOKEN` in CI. Not required for basic error capture.

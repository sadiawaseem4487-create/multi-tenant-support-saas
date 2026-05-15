import type * as Sentry from "@sentry/nextjs";

type SentryInitOptions = Parameters<typeof Sentry.init>[0];

/**
 * Returns Sentry init options when a DSN is configured; otherwise null (no-op).
 * Set SENTRY_DSN on the server; optionally NEXT_PUBLIC_SENTRY_DSN for client errors.
 */
export function getSentryOptions(): SentryInitOptions | null {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return null;

  const isProd = process.env.NODE_ENV === "production";

  return {
    dsn,
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: isProd ? 0.1 : 1,
    enabled: true,
  };
}

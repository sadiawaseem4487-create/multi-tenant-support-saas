/**
 * Chat-message logging.
 *
 * Each call to /api/chat writes one row to public.chat_messages so the
 * /admin/analytics dashboard can show per-org volume, fallback rate, top
 * questions, and recent activity. Writes are best-effort: any DB failure is
 * logged and swallowed so a logging outage cannot break end-user chat.
 */

import { createHash } from "crypto";
import { getSql } from "@/lib/db";

export type ChatLogStatus = "ok" | "error" | "rate_limited";
export type ChatLogSource = "authenticated" | "site_slug" | "api";

export type ChatLogEntry = {
  orgId: string;
  question: string;
  answer?: string | null;
  wasFallback?: boolean;
  responseMs?: number | null;
  status?: ChatLogStatus;
  source?: ChatLogSource;
  correlationId?: string | null;
  visitorIp?: string | null;
  userAuthSubject?: string | null;
  errorMessage?: string | null;
};

/**
 * Lowercase, strip punctuation, collapse whitespace; truncate. Used as the
 * "top questions" grouping key — two questions that differ only in
 * punctuation/casing should aggregate together.
 */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * SHA-256 of the visitor IP with a per-app prefix, truncated to 32 chars.
 * Lets us see "is this 3 visitors or 1 visitor asking 3 questions" without
 * storing the raw IP.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(`mts:chat:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Heuristic fallback detection: did the LLM return (a normalized form of)
 * the org's configured fallback message? Compares lowercased+trimmed text
 * and considers it a match if the answer fully equals OR contains a
 * substantial prefix of the fallback (≥ 40 chars or full string).
 */
export function detectFallback(
  answer: string | null | undefined,
  fallbackMessage: string | null | undefined,
): boolean {
  if (!answer || !fallbackMessage) return false;
  const a = answer.toLowerCase().trim();
  const f = fallbackMessage.toLowerCase().trim();
  if (!a || !f) return false;
  if (a === f) return true;
  if (a.includes(f)) return true;
  const prefixLen = Math.min(f.length, 60);
  return prefixLen >= 30 && a.startsWith(f.slice(0, prefixLen));
}

export async function logChatMessage(entry: ChatLogEntry): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      insert into public.chat_messages (
        org_id,
        question,
        question_normalized,
        answer,
        was_fallback,
        response_ms,
        status,
        source,
        correlation_id,
        visitor_ip_hash,
        user_auth_subject,
        error_message
      ) values (
        ${entry.orgId}::uuid,
        ${entry.question.slice(0, 4000)},
        ${normalizeQuestion(entry.question)},
        ${entry.answer ? entry.answer.slice(0, 8000) : null},
        ${entry.wasFallback ?? false},
        ${entry.responseMs ?? null},
        ${entry.status ?? "ok"},
        ${entry.source ?? "authenticated"},
        ${entry.correlationId ?? null},
        ${hashIp(entry.visitorIp)},
        ${entry.userAuthSubject ?? null},
        ${entry.errorMessage ? entry.errorMessage.slice(0, 1000) : null}
      )
    `;
  } catch (err) {
    console.error("[chat-log] insert failed", err);
  }
}

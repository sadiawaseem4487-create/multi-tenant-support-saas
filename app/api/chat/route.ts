import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveOrgContext } from "@/lib/rbac";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getSql } from "@/lib/db";
import { readChatConfig, type ChatConfig } from "@/lib/chat-config";
import {
  detectFallback,
  logChatMessage,
  type ChatLogEntry,
  type ChatLogSource,
} from "@/lib/chat-log";

function logAfter(entry: ChatLogEntry) {
  after(async () => {
    await logChatMessage(entry);
  });
}

type PublicOrgRow = {
  id: string;
  name: string;
};

type OrgChatRow = {
  brandName: string | null;
  settings: Record<string, unknown> | null;
};

async function resolveBySiteSlug(slug: string): Promise<PublicOrgRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!normalized) return null;
  const [row] = await sql<PublicOrgRow[]>`
    select id, name from public.orgs where site_slug = ${normalized} limit 1
  `;
  return row ?? null;
}

async function loadChatConfigForOrg(
  orgId: string,
  fallbackName: string,
): Promise<ChatConfig> {
  const sql = getSql();
  if (!sql) return readChatConfig(null, fallbackName);
  const [row] = await sql<OrgChatRow[]>`
    select (settings->>'brandName') as "brandName", settings
    from public.orgs
    where id = ${orgId}::uuid
    limit 1
  `;
  return readChatConfig(
    row?.settings?.chat ?? null,
    row?.brandName ?? fallbackName,
  );
}

type N8nChatResponse = {
  answer?: string;
  Answer?: string;
  error?: string;
};

function extractAnswer(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as N8nChatResponse;
  const a = o.answer ?? o.Answer;
  if (typeof a === "string" && a.trim()) return a.trim();
  return null;
}

const CHAT_RATE_LIMIT = (() => {
  const fromEnv = parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 30;
})();
const CHAT_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const ip = clientIp(req.headers);
  let logQuestion = "";
  let logOrgId: string | null = null;
  let logSource: ChatLogSource = "authenticated";
  let logUserSubject: string | null = null;
  const correlationId = crypto.randomUUID();

  try {
    const { userId } = await auth();
    logUserSubject = userId ?? null;
    const rateKey = userId ? `chat:user:${userId}` : `chat:ip:${ip}`;
    const rate = checkRateLimit(rateKey, CHAT_RATE_LIMIT, CHAT_WINDOW_MS);

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": String(rate.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
          },
        },
      );
    }

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const requestedOrgId = typeof body?.orgId === "string" ? body.orgId : null;
    const requestedSiteSlug =
      typeof body?.siteSlug === "string" && body.siteSlug.trim() ? body.siteSlug.trim() : null;
    logQuestion = message;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const companyName = process.env.COMPANY_NAME ?? "NovaCompany";
    const webhookSecret = process.env.WEBHOOK_SECRET?.trim();

    let orgContext:
      | {
          orgId: string;
          orgName: string;
        }
      | null = null;

    // Public branded sites (/site/[slug], embed) must win over the signed-in user's
    // default admin org — otherwise every tenant chat looks like one company.
    if (requestedSiteSlug) {
      const publicOrg = await resolveBySiteSlug(requestedSiteSlug);
      if (publicOrg) {
        orgContext = { orgId: publicOrg.id, orgName: publicOrg.name };
        logSource = "site_slug";
      }
    } else if (userId) {
      try {
        const resolved = await resolveOrgContext(userId, requestedOrgId);
        orgContext = { orgId: resolved.orgId, orgName: resolved.orgName };
        logSource = "authenticated";
      } catch {
        orgContext = null;
      }
    }
    logOrgId = orgContext?.orgId ?? null;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Server misconfiguration: N8N_WEBHOOK_URL is not set" },
        { status: 500 }
      );
    }

    const chatConfig = orgContext
      ? await loadChatConfigForOrg(orgContext.orgId, orgContext.orgName)
      : null;

    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "X-Webhook-Secret": webhookSecret } : {}),
      },
      body: JSON.stringify({
        question: message,
        company_name: companyName,
        org_id: orgContext?.orgId ?? null,
        org_name: orgContext?.orgName ?? null,
        correlation_id: correlationId,
        ...(chatConfig
          ? {
              chat_config: {
                assistant_name: chatConfig.assistantName,
                persona: chatConfig.persona,
                fallback_message: chatConfig.fallbackMessage,
                language_policy: chatConfig.languagePolicy,
                show_citations: chatConfig.showCitations,
              },
            }
          : {}),
      }),
      cache: "no-store",
    });

    const rawText = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    const elapsedMs = Date.now() - startedAt;

    if (!upstream.ok) {
      let errMsg = `Webhook failed (${upstream.status})`;
      if (
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
      ) {
        errMsg = (parsed as { error: string }).error;
      } else if (rawText) {
        errMsg = rawText.slice(0, 500);
      }
      if (logOrgId) {
        logAfter({
          orgId: logOrgId,
          question: logQuestion,
          answer: null,
          wasFallback: false,
          responseMs: elapsedMs,
          status: "error",
          source: logSource,
          correlationId,
          visitorIp: ip,
          userAuthSubject: logUserSubject,
          errorMessage: errMsg,
        });
      }
      return NextResponse.json({ error: errMsg }, { status: upstream.status });
    }

    const answer = extractAnswer(parsed);
    if (!answer) {
      if (logOrgId) {
        logAfter({
          orgId: logOrgId,
          question: logQuestion,
          answer: null,
          wasFallback: false,
          responseMs: elapsedMs,
          status: "error",
          source: logSource,
          correlationId,
          visitorIp: ip,
          userAuthSubject: logUserSubject,
          errorMessage: "No answer field in webhook response",
        });
      }
      return NextResponse.json(
        { error: "No answer field in webhook response", raw: parsed ?? rawText },
        { status: 502 }
      );
    }

    const wasFallback = chatConfig
      ? detectFallback(answer, chatConfig.fallbackMessage)
      : false;

    if (logOrgId) {
      logAfter({
        orgId: logOrgId,
        question: logQuestion,
        answer,
        wasFallback,
        responseMs: elapsedMs,
        status: "ok",
        source: logSource,
        correlationId,
        visitorIp: ip,
        userAuthSubject: logUserSubject,
      });
    }

    return NextResponse.json({ answer });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (logOrgId && logQuestion) {
      logAfter({
        orgId: logOrgId,
        question: logQuestion,
        responseMs: elapsedMs,
        status: "error",
        source: logSource,
        correlationId,
        visitorIp: ip,
        userAuthSubject: logUserSubject,
        errorMessage: err instanceof Error ? err.message : "Server error",
      });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

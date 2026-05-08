import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveOrgContext } from "@/lib/rbac";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const requestedOrgId = typeof body?.orgId === "string" ? body.orgId : null;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const companyName = process.env.COMPANY_NAME ?? "NovaCompany";
    const webhookSecret = process.env.WEBHOOK_SECRET?.trim();
    const { userId } = await auth();

    let orgContext:
      | {
          orgId: string;
          orgName: string;
        }
      | null = null;
    if (userId) {
      try {
        const resolved = await resolveOrgContext(userId, requestedOrgId);
        orgContext = { orgId: resolved.orgId, orgName: resolved.orgName };
      } catch {
        orgContext = null;
      }
    }

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Server misconfiguration: N8N_WEBHOOK_URL is not set" },
        { status: 500 }
      );
    }

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
        correlation_id: crypto.randomUUID(),
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
      return NextResponse.json({ error: errMsg }, { status: upstream.status });
    }

    const answer = extractAnswer(parsed);
    if (!answer) {
      return NextResponse.json(
        { error: "No answer field in webhook response", raw: parsed ?? rawText },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

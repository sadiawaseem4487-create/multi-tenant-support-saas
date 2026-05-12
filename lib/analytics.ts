/**
 * Analytics aggregations for a single org over a recent N-day window.
 *
 * All queries are filtered by org_id at the SQL level. The /api/admin/analytics
 * route enforces RBAC before calling these; /admin/analytics calls them
 * directly from a server component after resolveOrgContext.
 */

import type { getSql } from "@/lib/db";

type Sql = NonNullable<ReturnType<typeof getSql>>;

export type AnalyticsTotals = {
  totalMessages: number;
  fallbackMessages: number;
  errorMessages: number;
  fallbackRate: number;
  errorRate: number;
  avgResponseMs: number | null;
  uniqueVisitors: number;
};

export type AnalyticsDay = {
  date: string;
  count: number;
  fallbacks: number;
  errors: number;
};

export type AnalyticsTopQuestion = {
  questionNormalized: string;
  sampleQuestion: string;
  count: number;
  fallbackCount: number;
  lastAskedAt: string;
};

export type AnalyticsRecent = {
  id: string;
  question: string;
  answer: string | null;
  wasFallback: boolean;
  responseMs: number | null;
  status: string;
  source: string;
  createdAt: string;
};

export type AnalyticsPayload = {
  totals: AnalyticsTotals;
  daily: AnalyticsDay[];
  topQuestions: AnalyticsTopQuestion[];
  recent: AnalyticsRecent[];
};

export async function loadAnalytics(
  sql: Sql,
  orgId: string,
  windowDays: number,
): Promise<AnalyticsPayload> {
  const days = Math.min(Math.max(1, windowDays), 90);

  const [totalsRow] = await sql<
    {
      totalMessages: string | number;
      fallbackMessages: string | number;
      errorMessages: string | number;
      avgResponseMs: string | number | null;
      uniqueVisitors: string | number;
    }[]
  >`
    select
      count(*)::int as "totalMessages",
      count(*) filter (where was_fallback)::int as "fallbackMessages",
      count(*) filter (where status <> 'ok')::int as "errorMessages",
      avg(response_ms) filter (where response_ms is not null) as "avgResponseMs",
      count(distinct coalesce(visitor_ip_hash, user_auth_subject))::int as "uniqueVisitors"
    from public.chat_messages
    where org_id = ${orgId}::uuid
      and created_at >= now() - (${days}::int * interval '1 day')
  `;

  const totalMessages = Number(totalsRow?.totalMessages ?? 0);
  const fallbackMessages = Number(totalsRow?.fallbackMessages ?? 0);
  const errorMessages = Number(totalsRow?.errorMessages ?? 0);
  const avgResponseMsRaw = totalsRow?.avgResponseMs;
  const avgResponseMs =
    avgResponseMsRaw === null || avgResponseMsRaw === undefined
      ? null
      : Math.round(Number(avgResponseMsRaw));

  const totals: AnalyticsTotals = {
    totalMessages,
    fallbackMessages,
    errorMessages,
    fallbackRate: totalMessages > 0 ? fallbackMessages / totalMessages : 0,
    errorRate: totalMessages > 0 ? errorMessages / totalMessages : 0,
    avgResponseMs,
    uniqueVisitors: Number(totalsRow?.uniqueVisitors ?? 0),
  };

  const dailyRows = await sql<
    {
      date: Date;
      count: string | number;
      fallbacks: string | number;
      errors: string | number;
    }[]
  >`
    with bucket as (
      select generate_series(
        date_trunc('day', now() - (${days - 1}::int * interval '1 day')),
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    )
    select
      bucket.day::date as date,
      coalesce(count(cm.id), 0)::int as count,
      coalesce(count(cm.id) filter (where cm.was_fallback), 0)::int as fallbacks,
      coalesce(count(cm.id) filter (where cm.status <> 'ok'), 0)::int as errors
    from bucket
    left join public.chat_messages cm
      on cm.org_id = ${orgId}::uuid
     and cm.created_at >= bucket.day
     and cm.created_at < bucket.day + interval '1 day'
    group by bucket.day
    order by bucket.day asc
  `;

  const daily: AnalyticsDay[] = dailyRows.map((r) => ({
    date:
      r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10),
    count: Number(r.count),
    fallbacks: Number(r.fallbacks),
    errors: Number(r.errors),
  }));

  const topRows = await sql<
    {
      questionNormalized: string;
      sampleQuestion: string;
      count: string | number;
      fallbackCount: string | number;
      lastAskedAt: Date;
    }[]
  >`
    with bucket as (
      select
        question_normalized,
        question,
        was_fallback,
        created_at,
        row_number() over (
          partition by question_normalized
          order by created_at desc
        ) as rn
      from public.chat_messages
      where org_id = ${orgId}::uuid
        and created_at >= now() - (${days}::int * interval '1 day')
        and length(question_normalized) > 0
    )
    select
      question_normalized as "questionNormalized",
      max(question) filter (where rn = 1) as "sampleQuestion",
      count(*)::int as count,
      count(*) filter (where was_fallback)::int as "fallbackCount",
      max(created_at) as "lastAskedAt"
    from bucket
    group by question_normalized
    order by count desc, max(created_at) desc
    limit 10
  `;

  const topQuestions: AnalyticsTopQuestion[] = topRows.map((r) => ({
    questionNormalized: r.questionNormalized,
    sampleQuestion: r.sampleQuestion,
    count: Number(r.count),
    fallbackCount: Number(r.fallbackCount),
    lastAskedAt:
      r.lastAskedAt instanceof Date
        ? r.lastAskedAt.toISOString()
        : String(r.lastAskedAt),
  }));

  const recentRows = await sql<
    {
      id: string;
      question: string;
      answer: string | null;
      wasFallback: boolean;
      responseMs: number | null;
      status: string;
      source: string;
      createdAt: Date;
    }[]
  >`
    select
      id,
      question,
      answer,
      was_fallback as "wasFallback",
      response_ms as "responseMs",
      status,
      source,
      created_at as "createdAt"
    from public.chat_messages
    where org_id = ${orgId}::uuid
    order by created_at desc
    limit 20
  `;

  const recent: AnalyticsRecent[] = recentRows.map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    wasFallback: r.wasFallback,
    responseMs: r.responseMs,
    status: r.status,
    source: r.source,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
  }));

  return { totals, daily, topQuestions, recent };
}

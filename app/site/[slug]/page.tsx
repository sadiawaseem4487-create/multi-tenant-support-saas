import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { PublicSiteChat } from "@/components/PublicSiteChat";
import { readChatConfig } from "@/lib/chat-config";

type OrgRow = {
  id: string;
  name: string;
  siteSlug: string;
  brandName: string | null;
  brandTagline: string | null;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  settings: Record<string, unknown> | null;
};

async function loadOrgBySlug(slug: string): Promise<OrgRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!normalized) return null;
  const [row] = await sql<OrgRow[]>`
    select
      id,
      name,
      site_slug as "siteSlug",
      (settings->>'brandName') as "brandName",
      (settings->>'brandTagline') as "brandTagline",
      (settings->>'brandLogoUrl') as "brandLogoUrl",
      (settings->>'brandPrimaryColor') as "brandPrimaryColor",
      settings
    from public.orgs
    where site_slug = ${normalized}
    limit 1
  `;
  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await loadOrgBySlug(slug);
  if (!org) {
    return { title: "Not found" };
  }
  const title = `${org.brandName ?? org.name} support`;
  const description = org.brandTagline ?? "Customer support assistant";
  return { title, description };
}

export default async function PublicOrgSite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await loadOrgBySlug(slug);
  if (!org) {
    notFound();
  }

  const brandName = org.brandName ?? org.name;
  const tagline = org.brandTagline ?? "Customer support assistant";
  const initial = brandName.charAt(0).toUpperCase();
  const chatConfig = readChatConfig(org.settings?.chat, brandName);
  const primaryColor = org.brandPrimaryColor?.trim() || null;
  const logoBgStyle = primaryColor ? { background: primaryColor } : undefined;

  return (
    <div className="chat-page-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:max-w-5xl lg:px-8">
          <div className="flex items-center gap-3">
            {org.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.brandLogoUrl}
                alt={`${brandName} logo`}
                className="h-10 w-10 rounded-xl object-cover shadow-md ring-1 ring-slate-200"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-lg font-bold text-white shadow-md"
                style={logoBgStyle}
              >
                {initial}
              </span>
            )}
            <div>
              <p className="text-lg font-semibold text-slate-900">{brandName}</p>
              <p className="text-xs text-slate-500">{tagline}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-white/90 px-6 py-10 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80 sm:px-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How can we help?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Ask {brandName}&apos;s support assistant a question. Answers come straight
            from {brandName}&apos;s official knowledge base.
          </p>
          <div className="mt-8">
            <PublicSiteChat
              siteSlug={org.siteSlug}
              brandName={brandName}
              brandTagline={tagline}
              chatConfig={{
                assistantName: chatConfig.assistantName,
                greeting: chatConfig.greeting,
                suggestions: chatConfig.suggestions,
              }}
              primaryColor={primaryColor}
            />
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-slate-500">
          Powered by{" "}
          <Link href="/" className="underline-offset-2 hover:underline">
            multi-tenant-support-saas
          </Link>
        </p>
      </main>
    </div>
  );
}

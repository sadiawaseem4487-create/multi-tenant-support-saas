import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { SupportChat } from "@/components/SupportChat";
import { readChatConfig, validatePrimaryColor } from "@/lib/chat-config";

type OrgRow = {
  id: string;
  name: string;
  siteSlug: string;
  brandName: string | null;
  brandTagline: string | null;
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
      (settings->>'brandPrimaryColor') as "brandPrimaryColor",
      settings
    from public.orgs
    where site_slug = ${normalized}
    limit 1
  `;
  return row ?? null;
}

export const metadata: Metadata = {
  title: "Support chat",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const { slug } = await params;
  const { color: rawColor } = await searchParams;
  const org = await loadOrgBySlug(slug);
  if (!org) notFound();

  const brandName = org.brandName ?? org.name;
  const tagline = org.brandTagline ?? "Customer support assistant";
  const chatConfig = readChatConfig(org.settings?.chat, brandName);

  const colorOverride = rawColor ? validatePrimaryColor(rawColor) : null;
  const primaryColor =
    (colorOverride && colorOverride.ok ? colorOverride.color : null) ??
    org.brandPrimaryColor?.trim() ??
    null;

  return (
    <div className="flex h-dvh w-full flex-col bg-white">
      <SupportChat
        variant="floating"
        brandName={brandName}
        brandTagline={tagline}
        siteSlug={org.siteSlug}
        chatConfig={{
          assistantName: chatConfig.assistantName,
          greeting: chatConfig.greeting,
          suggestions: chatConfig.suggestions,
        }}
        primaryColor={primaryColor}
      />
    </div>
  );
}

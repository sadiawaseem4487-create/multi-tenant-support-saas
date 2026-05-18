/**
 * Known per-org KB markdown URLs under /public/kb (see public/kb/README.md).
 */

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
  "https://multi-tenant-support-saas.vercel.app";

export type KbIngestPreset = {
  title: string;
  documentUrl: string;
};

const PRESETS: Record<string, KbIngestPreset> = {
  "demo-company": {
    title: "NovaMart Knowledge Base",
    documentUrl: `${APP_ORIGIN}/kb/demo-company/nova-mart-knowledge-base.md`,
  },
  "art-craft-87b0": {
    title: "Art Craft Knowledge Base",
    documentUrl: `${APP_ORIGIN}/kb/art-craft-87b0/art-craft-knowledge-base.md`,
  },
};

export function getKbIngestPreset(siteSlug: string | null | undefined): KbIngestPreset | null {
  if (!siteSlug) return null;
  return PRESETS[siteSlug] ?? null;
}

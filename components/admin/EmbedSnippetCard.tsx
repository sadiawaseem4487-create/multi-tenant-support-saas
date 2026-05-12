"use client";

import { useMemo, useState } from "react";

type Props = {
  siteSlug: string | null;
  appOrigin: string;
  primaryColor: string | null;
};

export function EmbedSnippetCard({ siteSlug, appOrigin, primaryColor }: Props) {
  const [copied, setCopied] = useState(false);
  const [includeColor, setIncludeColor] = useState(false);
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right",
  );

  const snippet = useMemo(() => {
    if (!siteSlug) return "";
    const attrs: string[] = [
      `  src="${appOrigin}/embed.js"`,
      `  data-site-slug="${siteSlug}"`,
    ];
    if (position !== "bottom-right") {
      attrs.push(`  data-position="${position}"`);
    }
    if (includeColor && primaryColor) {
      attrs.push(`  data-primary-color="${primaryColor}"`);
    }
    attrs.push(`  async`);
    return `<script\n${attrs.join("\n")}\n></script>`;
  }, [siteSlug, appOrigin, position, includeColor, primaryColor]);

  async function copy() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Embed on your website
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Paste this snippet anywhere inside your website&apos;s{" "}
          <code className="rounded bg-slate-100 px-1">&lt;body&gt;</code>. A
          floating chat bubble will appear and use your organization&apos;s
          branding, persona, and knowledge base.
        </p>
      </div>

      {!siteSlug ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set a <strong>Site slug</strong> above and save before generating the
          embed snippet. The slug becomes part of the script so the widget
          knows which knowledge base to query.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-700">
              <span className="font-medium">Position</span>
              <select
                value={position}
                onChange={(e) =>
                  setPosition(e.target.value as "bottom-right" | "bottom-left")
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={includeColor}
                onChange={(e) => setIncludeColor(e.target.checked)}
                disabled={!primaryColor}
                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="font-medium">
                Override color with{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">
                  {primaryColor ?? "(none set)"}
                </code>
              </span>
            </label>
          </div>

          <div className="relative">
            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-relaxed text-slate-100">
              <code>{snippet}</code>
            </pre>
            <button
              type="button"
              onClick={copy}
              className="absolute right-2 top-2 rounded-lg bg-slate-700/80 px-3 py-1 text-[11px] font-medium text-white shadow transition hover:bg-slate-600"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <a
              href={`/site/${siteSlug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Preview branded page
            </a>
            <a
              href={`/embed/${siteSlug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Preview widget content
            </a>
            <span>
              Test it on any HTML page before sharing the snippet with your
              team.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

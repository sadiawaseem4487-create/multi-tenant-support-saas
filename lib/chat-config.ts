/**
 * Per-org chat behavior settings. Stored under public.orgs.settings.chat (jsonb).
 *
 * The DB layer trusts callers to pass a well-shaped object; validation lives in
 * the settings API route. The defaults below are used at read-time when an org
 * hasn't customized chat yet, so newly-created tenants still get a usable bot.
 */

export const LANGUAGE_POLICIES = [
  "match-user",
  "english-only",
  "original-language",
] as const;

export type LanguagePolicy = (typeof LANGUAGE_POLICIES)[number];

export type ChatConfig = {
  assistantName: string;
  persona: string;
  greeting: string;
  suggestions: string[];
  fallbackMessage: string;
  languagePolicy: LanguagePolicy;
  showCitations: boolean;
};

export const CHAT_LIMITS = {
  assistantName: 50,
  persona: 2000,
  greeting: 500,
  suggestionMax: 6,
  suggestionLabel: 80,
  fallbackMessage: 500,
} as const;

export const LANGUAGE_POLICY_LABELS: Record<LanguagePolicy, string> = {
  "match-user": "Match the visitor's language",
  "english-only": "Always reply in English",
  "original-language": "Reply in the knowledge base's language",
};

const DEFAULT_FALLBACK =
  "I don't have that information in my knowledge base yet. Please contact support for help.";

export function defaultChatConfig(brandName: string): ChatConfig {
  const name = brandName.trim() || "Support";
  return {
    assistantName: name,
    persona: "",
    greeting: [
      `Hello, and welcome to ${name} support.`,
      "",
      "I'm here to help you find clear answers from our official knowledge base: orders, shipping, returns, payments, accounts, and company policies.",
      "",
      "How can I help you today? Type your question below, or tap a topic to get started.",
    ].join("\n"),
    suggestions: [
      `What is ${name}?`,
      `What are ${name}'s business hours and support availability?`,
      `How can I contact ${name} customer support?`,
      `What is ${name}'s return and refund policy?`,
      `How does a customer place an order with ${name}?`,
      `What payment methods does ${name} accept?`,
    ],
    fallbackMessage: DEFAULT_FALLBACK,
    languagePolicy: "match-user",
    showCitations: false,
  };
}

/** Read a (possibly partial / untyped) chat config from settings JSON. */
export function readChatConfig(
  raw: unknown,
  brandName: string,
): ChatConfig {
  const base = defaultChatConfig(brandName);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v : fallback;

  const suggestions = Array.isArray(r.suggestions)
    ? r.suggestions
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, CHAT_LIMITS.suggestionMax)
    : base.suggestions;

  const languagePolicy: LanguagePolicy =
    typeof r.languagePolicy === "string" &&
    (LANGUAGE_POLICIES as readonly string[]).includes(r.languagePolicy)
      ? (r.languagePolicy as LanguagePolicy)
      : base.languagePolicy;

  return {
    assistantName: str(r.assistantName, base.assistantName),
    persona: typeof r.persona === "string" ? r.persona : "",
    greeting: str(r.greeting, base.greeting),
    suggestions: suggestions.length > 0 ? suggestions : base.suggestions,
    fallbackMessage: str(r.fallbackMessage, base.fallbackMessage),
    languagePolicy,
    showCitations: typeof r.showCitations === "boolean" ? r.showCitations : base.showCitations,
  };
}

export type ChatConfigPatch = Partial<{
  assistantName: string | null;
  persona: string | null;
  greeting: string | null;
  suggestions: string[] | null;
  fallbackMessage: string | null;
}>;

/**
 * Validate + clean a patch coming from the admin form. Returns either a
 * sanitized object (only fields explicitly present in the input) or an error
 * string describing the first validation failure.
 */
export function validateChatPatch(
  input: unknown,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, patch: {} };
  if (typeof input !== "object") {
    return { ok: false, error: "chat must be an object." };
  }
  const p = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if ("assistantName" in p) {
    const v = p.assistantName;
    if (v === null || v === "") out.assistantName = null;
    else if (typeof v !== "string") return { ok: false, error: "assistantName must be a string." };
    else if (v.length > CHAT_LIMITS.assistantName)
      return {
        ok: false,
        error: `assistantName must be at most ${CHAT_LIMITS.assistantName} characters.`,
      };
    else out.assistantName = v.trim();
  }

  if ("persona" in p) {
    const v = p.persona;
    if (v === null || v === "") out.persona = null;
    else if (typeof v !== "string") return { ok: false, error: "persona must be a string." };
    else if (v.length > CHAT_LIMITS.persona)
      return {
        ok: false,
        error: `persona must be at most ${CHAT_LIMITS.persona} characters.`,
      };
    else out.persona = v.trim();
  }

  if ("greeting" in p) {
    const v = p.greeting;
    if (v === null || v === "") out.greeting = null;
    else if (typeof v !== "string") return { ok: false, error: "greeting must be a string." };
    else if (v.length > CHAT_LIMITS.greeting)
      return {
        ok: false,
        error: `greeting must be at most ${CHAT_LIMITS.greeting} characters.`,
      };
    else out.greeting = v;
  }

  if ("suggestions" in p) {
    const v = p.suggestions;
    if (v === null) out.suggestions = null;
    else if (!Array.isArray(v))
      return { ok: false, error: "suggestions must be an array of strings." };
    else {
      const cleaned: string[] = [];
      for (const item of v) {
        if (typeof item !== "string") {
          return { ok: false, error: "Each suggestion must be a string." };
        }
        const trimmed = item.trim();
        if (!trimmed) continue;
        if (trimmed.length > CHAT_LIMITS.suggestionLabel) {
          return {
            ok: false,
            error: `Suggestion text must be at most ${CHAT_LIMITS.suggestionLabel} characters.`,
          };
        }
        cleaned.push(trimmed);
        if (cleaned.length >= CHAT_LIMITS.suggestionMax) break;
      }
      out.suggestions = cleaned;
    }
  }

  if ("fallbackMessage" in p) {
    const v = p.fallbackMessage;
    if (v === null || v === "") out.fallbackMessage = null;
    else if (typeof v !== "string")
      return { ok: false, error: "fallbackMessage must be a string." };
    else if (v.length > CHAT_LIMITS.fallbackMessage)
      return {
        ok: false,
        error: `fallbackMessage must be at most ${CHAT_LIMITS.fallbackMessage} characters.`,
      };
    else out.fallbackMessage = v.trim();
  }

  if ("languagePolicy" in p) {
    const v = p.languagePolicy;
    if (v === null || v === "") out.languagePolicy = null;
    else if (typeof v !== "string" || !(LANGUAGE_POLICIES as readonly string[]).includes(v)) {
      return {
        ok: false,
        error: `languagePolicy must be one of: ${LANGUAGE_POLICIES.join(", ")}.`,
      };
    } else out.languagePolicy = v;
  }

  if ("showCitations" in p) {
    const v = p.showCitations;
    if (typeof v !== "boolean")
      return { ok: false, error: "showCitations must be a boolean." };
    out.showCitations = v;
  }

  return { ok: true, patch: out };
}

/**
 * Validate a primary color string. Accepts #RGB or #RRGGBB (case-insensitive).
 * Returns the normalized lowercased hex, or null for clear, or an error.
 */
export function validatePrimaryColor(
  value: unknown,
): { ok: true; color: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, color: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Primary color must be a string." };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, color: null };
  const m = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) {
    return {
      ok: false,
      error: "Primary color must be a hex value like #0d9488 or #ff0.",
    };
  }
  let hex = m[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return { ok: true, color: `#${hex}` };
}

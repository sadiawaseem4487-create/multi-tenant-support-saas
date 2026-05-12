"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "bot";

type ChatMessage = { role: Role; text: string };

type Suggestion = { label: string; prompt: string };

function getWelcomeMessage(name: string): string {
  return [
    `Hello, and welcome to ${name} support.`,
    "",
    "I'm here to help you find clear answers from our official knowledge base: orders, shipping, returns, payments, accounts, and company policies.",
    "",
    "How can I help you today? Type your question below, or tap a topic to get started.",
  ].join("\n");
}

function getSuggestedQuestions(name: string): Suggestion[] {
  return [
    { label: `What is ${name}?`, prompt: `What is ${name}?` },
    {
      label: "Business hours",
      prompt: `What are ${name}'s business hours and support availability?`,
    },
    {
      label: "Contact support",
      prompt: `How can I contact ${name} customer support?`,
    },
    {
      label: "Return policy",
      prompt: `What is ${name}'s return and refund policy?`,
    },
    {
      label: "Place an order",
      prompt: `How does a customer place an order with ${name}?`,
    },
    {
      label: "Payment methods",
      prompt: `What payment methods does ${name} accept?`,
    },
  ];
}

type Props = {
  brandName: string;
  brandTagline: string;
  /** Use inside floating widget: no outer card chrome, fills panel height */
  variant?: "default" | "floating";
  /** Public site slug; sent to /api/chat to resolve org_id for anonymous visitors. */
  siteSlug?: string;
};

export function SupportChat({
  brandName,
  brandTagline,
  variant = "default",
  siteSlug,
}: Props) {
  const floating = variant === "floating";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: getWelcomeMessage(brandName) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = getSuggestedQuestions(brandName);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          ...(siteSlug ? { siteSlug } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      const reply =
        typeof data?.answer === "string"
          ? data.answer
          : typeof data?.error === "string"
            ? `Sorry, something went wrong: ${data.error}`
            : "Something went wrong. Please try again.";

      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Network error. Check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [siteSlug]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendUserMessage(text);
  }

  function onSuggestionClick(prompt: string) {
    if (loading) return;
    void sendUserMessage(prompt);
  }

  const shell = floating
    ? "flex h-full min-h-0 flex-col bg-transparent"
    : "flex flex-col overflow-hidden rounded-3xl bg-white/95 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur-sm";

  const scrollArea = floating
    ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4"
    : "flex max-h-[min(42vh,380px)] min-h-[200px] flex-col gap-3 overflow-y-auto px-4 py-3 sm:max-h-[min(48vh,440px)] sm:px-5 lg:max-h-[calc(100vh-22rem)]";

  return (
    <div className={shell}>
      {!floating && (
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 via-white to-sky-50/60 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-base font-bold text-white shadow-md ring-2 ring-white/30"
              aria-hidden
            >
              {brandName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{brandName}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/80">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" aria-hidden />
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-600">{brandTagline}</p>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-600">Messages</p>
        </div>
      )}

      <div className={scrollArea}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-teal-600 to-cyan-700 px-3 py-2 text-xs leading-relaxed text-white shadow-md shadow-teal-900/20 sm:text-sm"
                  : "max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200/90 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm sm:text-sm"
              }
            >
              {m.role === "bot" && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 text-[10px] font-bold text-white">
                    AI
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 sm:text-xs">
                    {brandName}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" />
              </span>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={
          floating
            ? "shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4"
            : "shrink-0 border-t border-slate-100 bg-slate-50/80 p-3 sm:p-4"
        }
      >
        <p className="mb-2 text-xs text-slate-600 sm:text-sm">
          Do you want to know about any of these?
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:[-ms-overflow-style:none] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={loading}
              onClick={() => onSuggestionClick(s.prompt)}
              className="max-sm:shrink-0 rounded-full border border-teal-200/80 bg-white px-2.5 py-1.5 text-left text-[10px] font-medium text-teal-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/80 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs"
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-inner outline-none placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 sm:text-sm"
            placeholder="How can we help you today?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            aria-label="Your message"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:from-teal-500 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-slate-500 sm:text-xs">
          Answers from your official knowledge base. For account-specific help, contact
          support.
        </p>
      </div>
    </div>
  );
}

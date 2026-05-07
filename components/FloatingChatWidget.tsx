"use client";

import { useCallback, useEffect, useState } from "react";
import { SupportChat } from "@/components/SupportChat";

type Props = {
  brandName: string;
  brandTagline: string;
};

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function FloatingChatWidget({ brandName, brandTagline }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined" && window.location.hash === "#chat") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#chat") setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] transition-opacity sm:bg-slate-900/15"
          aria-label="Close chat overlay"
          onClick={close}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        <div
          className={`origin-bottom-right transition-all duration-200 ease-out ${
            open
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          {open && (
            <div
              id="floating-chat-panel"
              className="flex max-h-[min(580px,85dvh)] w-[calc(100vw-2.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-black/5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="floating-chat-title"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-700 px-4 py-3 text-white">
                <div className="min-w-0">
                  <p id="floating-chat-title" className="text-sm font-semibold">
                    Chat with {brandName}
                  </p>
                  <p className="truncate text-xs text-teal-100">
                    {brandTagline} · We typically reply in seconds
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-lg p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
                  aria-label="Close chat"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
                <SupportChat
                  brandName={brandName}
                  brandTagline={brandTagline}
                  variant="floating"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 sm:h-16 sm:w-16 ${
            open
              ? "bg-slate-700 text-white shadow-slate-900/30 hover:bg-slate-600"
              : "bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-teal-900/35 hover:shadow-xl"
          }`}
          aria-expanded={open}
          aria-controls="floating-chat-panel"
          aria-label={open ? "Close chat" : "Open chat"}
        >
          {open ? <CloseIcon className="h-7 w-7" /> : <ChatBubbleIcon className="h-7 w-7" />}
        </button>
      </div>
    </>
  );
}

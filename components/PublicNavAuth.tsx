"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function PublicNavAuth() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/admin">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/80 hover:text-teal-900"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/admin"
          className="rounded-full bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
        >
          Console
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}

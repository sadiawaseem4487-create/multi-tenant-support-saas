import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Company support chat",
  description: "RAG chat UI backed by n8n and Supabase",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#0d9488",
    colorText: "#0f172a",
    colorTextSecondary: "#475569",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: "shadow-xl border border-slate-200",
    headerTitle: "text-slate-900",
    headerSubtitle: "text-slate-600",
    formButtonPrimary:
      "bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm transition-colors",
    formFieldInput:
      "rounded-xl border-slate-300 focus:border-teal-500 focus:ring-teal-500/30",
    footerActionLink: "text-teal-700 hover:text-teal-800",
    socialButtonsBlockButton:
      "rounded-xl border-slate-300 hover:bg-slate-50 transition-colors",
  },
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          afterSignOutUrl="/"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

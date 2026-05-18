import { CompanyMarketing } from "@/components/CompanyMarketing";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { PublicNavAuth } from "@/components/PublicNavAuth";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "NovaMart";
const brandTagline =
  process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Customer support assistant";

export default function Home() {
  return (
    <div className="chat-page-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:max-w-5xl lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-lg font-bold text-white shadow-md">
              {brandName.charAt(0).toUpperCase()}
            </span>
            <span className="text-lg font-semibold text-slate-900">{brandName}</span>
          </a>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600 sm:gap-6">
            <a href="#products" className="transition hover:text-teal-700">
              Products
            </a>
            <a href="#why-us" className="hidden transition hover:text-teal-700 sm:inline">
              Why us
            </a>
            <a
              href="#chat"
              className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-800 ring-1 ring-teal-200/80 transition hover:bg-teal-100 sm:px-4"
            >
              Chat
            </a>
            <a
              href="/site/demo-company"
              className="hidden rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-800 ring-1 ring-indigo-200/80 transition hover:bg-indigo-100 sm:inline"
            >
              SaaS demo
            </a>
            <PublicNavAuth />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl lg:px-8 lg:py-10">
        <CompanyMarketing brandName={brandName} />
      </div>

      <FloatingChatWidget brandName={brandName} brandTagline={brandTagline} />
    </div>
  );
}

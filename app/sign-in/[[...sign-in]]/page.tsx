import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-slate-100 px-4 py-12">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          NovaMart Support
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to access your admin console.</p>
      </div>
      <SignIn
        forceRedirectUrl="/admin"
        fallbackRedirectUrl="/admin"
        appearance={{
          elements: {
            rootBox: "mx-auto w-full",
            card: "w-full max-w-md shadow-xl border border-slate-200",
          },
        }}
      />
    </div>
  );
}

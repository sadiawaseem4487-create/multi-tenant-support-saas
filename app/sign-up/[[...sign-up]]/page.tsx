import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; email_address?: string }>;
}) {
  const { redirect_url: redirectUrl, email_address: emailAddress } = await searchParams;
  const afterAuth = redirectUrl?.startsWith("/") ? redirectUrl : "/admin";
  const email = emailAddress?.trim() || undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-slate-100 px-4 py-12">
      <div className="mb-6 max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Organization invite
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">
          {email
            ? `Register with ${email}. After verification you will return to accept the invitation and join your organization.`
            : "Join your organization and access the admin console."}
        </p>
      </div>
      <SignUp
        forceRedirectUrl={afterAuth}
        fallbackRedirectUrl={afterAuth}
        signInForceRedirectUrl={afterAuth}
        signUpForceRedirectUrl={afterAuth}
        initialValues={email ? { emailAddress: email } : undefined}
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

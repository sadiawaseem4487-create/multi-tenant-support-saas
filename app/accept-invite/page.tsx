import { currentUser } from "@clerk/nextjs/server";
import { AcceptInviteClient } from "@/components/AcceptInviteClient";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await currentUser();

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
          <h2 className="text-xl font-semibold">Invitation link is invalid</h2>
          <p className="mt-2 text-sm">
            The token is missing. Please open the full link from your invitation email.
          </p>
        </div>
      </main>
    );
  }

  const signedInEmails = user
    ? [
        user.primaryEmailAddress?.emailAddress,
        ...(user.emailAddresses?.map((e) => e.emailAddress) ?? []),
      ]
        .filter((e): e is string => Boolean(e?.trim()))
        .map((e) => e.trim().toLowerCase())
        .filter((e, i, arr) => arr.indexOf(e) === i)
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <AcceptInviteClient
        token={token}
        signedIn={Boolean(user)}
        signedInEmails={signedInEmails}
      />
    </main>
  );
}

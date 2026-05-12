"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Member = {
  membershipId: string;
  userId: string;
  authSubject: string | null;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

type Props = {
  orgId: string;
  currentAuthSubject: string;
  canManage: boolean;
  members: Member[];
};

const ROLES = [
  "org_owner",
  "org_admin",
  "content_manager",
  "support_lead",
  "support_agent",
  "viewer",
] as const;

export function MembersTable({ currentAuthSubject, canManage, members }: Props) {
  const router = useRouter();
  const [pendingRow, setPendingRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function changeRole(membershipId: string, role: string) {
    setError(null);
    setPendingRow(membershipId);
    try {
      const res = await fetch(`/api/admin/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to change role (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change role.");
    } finally {
      setPendingRow(null);
    }
  }

  async function removeMember(membershipId: string, email: string) {
    if (
      !window.confirm(
        `Remove ${email} from this organization? They will lose access immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    setPendingRow(membershipId);
    try {
      const res = await fetch(`/api/admin/members/${membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to remove member (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      setPendingRow(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              Joined (UTC)
            </th>
            {canManage ? (
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {members.map((member) => {
            const isSelf = member.authSubject === currentAuthSubject;
            const rowBusy = pendingRow === member.membershipId || isPending;
            return (
              <tr key={member.membershipId}>
                <td className="px-4 py-3 text-sm text-slate-900">
                  {member.email}
                  {isSelf ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 ring-1 ring-teal-200/80">
                      you
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {member.displayName ?? "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {canManage && !isSelf ? (
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 disabled:opacity-50"
                      value={member.role}
                      disabled={rowBusy}
                      onChange={(e) => changeRole(member.membershipId, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    member.role
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.joinedAt}</td>
                {canManage ? (
                  <td className="px-4 py-3 text-right text-sm">
                    {!isSelf ? (
                      <button
                        type="button"
                        onClick={() => removeMember(member.membershipId, member.email)}
                        disabled={rowBusy}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
          {members.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-sm text-slate-600" colSpan={canManage ? 5 : 4}>
                No members found in this organization yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { AdminNavWithOrg } from "@/components/admin/AdminNav";

export function AdminHeaderBar() {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-lg bg-slate-100" aria-hidden />}>
          <OrgSwitcher />
        </Suspense>
        <Suspense fallback={<div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-50" />}>
          <AdminNavWithOrg />
        </Suspense>
      </div>
    </div>
  );
}

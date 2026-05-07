import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Welcome</h2>
      <p className="mt-2 max-w-2xl text-slate-600">
        This area will host tenant administration: members and roles, knowledge base and
        ingest jobs, integrations, and billing. Follow the program backlog for delivery
        order.
      </p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-slate-700">
        <li>
          <strong>Now:</strong> Clerk sign-in; your user is synced to Postgres and bootstrapped
          into the org from <code className="rounded bg-slate-100 px-1">BOOTSTRAP_ORG_SLUG</code>{" "}
          (default <code className="rounded bg-slate-100 px-1">demo-company</code>) as{" "}
          <code className="rounded bg-slate-100 px-1">org_owner</code> on first visit.
        </li>
        <li>
          <strong>Next:</strong> RBAC in API routes, invitations, and admin data screens.
        </li>
        <li>
          <strong>Sprint 2:</strong> ingest jobs, signed n8n webhooks, per-tenant vectors.
        </li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Back to public site
        </Link>
      </div>
    </div>
  );
}

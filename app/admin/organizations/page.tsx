import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OrganizationsPanel } from "@/components/admin/OrganizationsPanel";
import { requireRole, resolveOrgContext } from "@/lib/rbac";

export default async function AdminOrganizationsPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const context = await resolveOrgContext(user.id, null);
  let canCreateOrganization = false;
  try {
    await requireRole(context.orgId, "users:invite", user.id);
    canCreateOrganization = true;
  } catch {
    canCreateOrganization = false;
  }

  return <OrganizationsPanel canCreateOrganization={canCreateOrganization} />;
}

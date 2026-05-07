import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listMemberships, resolveOrgContext } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const selected = await resolveOrgContext(userId, orgId);
    const memberships = await listMemberships(userId);

    return NextResponse.json({
      selectedOrgId: selected.orgId,
      selectedOrgName: selected.orgName,
      memberships: memberships.map((m) => ({
        orgId: m.orgId,
        orgName: m.orgName,
        role: m.role,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { renewalDeclaration, user } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;
  const items = await db
    .select({
      id: renewalDeclaration.id,
      fiscalYear: renewalDeclaration.fiscalYear,
      businessName: renewalDeclaration.businessName,
      status: renewalDeclaration.status,
      createdAt: renewalDeclaration.createdAt,
      updatedAt: renewalDeclaration.updatedAt,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(renewalDeclaration)
    .innerJoin(user, eq(renewalDeclaration.userId, user.id))
    .orderBy(desc(renewalDeclaration.updatedAt))
    .limit(500);
  return Response.json({ items });
}

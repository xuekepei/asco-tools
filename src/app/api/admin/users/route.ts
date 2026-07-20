import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { exportCreditAccount, user } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;
  const items = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      exportCredits: exportCreditAccount.balance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(exportCreditAccount, eq(exportCreditAccount.userId, user.id))
    .orderBy(desc(user.createdAt))
    .limit(500);
  return Response.json({ items, viewerRole: access.context.role });
}

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { exportLog, user } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;
  const items = await db
    .select({
      id: exportLog.id,
      format: exportLog.format,
      declarationId: exportLog.declarationId,
      createdAt: exportLog.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(exportLog)
    .innerJoin(user, eq(exportLog.userId, user.id))
    .orderBy(desc(exportLog.createdAt))
    .limit(500);
  return Response.json({ items });
}

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { exportLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const items = await db
    .select()
    .from(exportLog)
    .where(eq(exportLog.userId, currentUser.id))
    .orderBy(desc(exportLog.createdAt))
    .limit(100);
  return Response.json({ items });
}

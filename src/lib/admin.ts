import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";

export type AdminRole = "support" | "admin";

export async function getAdminContext() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const [record] = await db
    .select({ role: user.role, plan: user.plan })
    .from(user)
    .where(eq(user.id, currentUser.id))
    .limit(1);
  if (!record) return null;
  const bootstrapEmails = env.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const role = bootstrapEmails.includes(currentUser.email.toLowerCase())
    ? "admin"
    : record.role;
  if (role !== "admin" && role !== "support") return null;
  return { user: currentUser, role: role as AdminRole, plan: record.plan };
}

export async function requireAdminApi(options?: { write?: boolean }) {
  const context = await getAdminContext();
  if (!context) {
    return {
      error: Response.json({ error: "forbidden" }, { status: 403 }),
    } as const;
  }
  if (options?.write && context.role !== "admin") {
    return {
      error: Response.json({ error: "admin_required" }, { status: 403 }),
    } as const;
  }
  return { context } as const;
}

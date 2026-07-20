import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { adminAuditLog, session, user } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";

const updateUserSchema = z.object({
  role: z.enum(["user", "support", "admin"]),
  emailVerified: z.boolean(),
  banned: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/users/[id]">,
) {
  const access = await requireAdminApi({ write: true });
  if ("error" in access) return access.error;
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const { id } = await context.params;
  if (
    id === access.context.user.id &&
    (parsed.data.role !== "admin" || parsed.data.banned)
  ) {
    return Response.json(
      { error: parsed.data.banned ? "cannot_disable_self" : "cannot_demote_self" },
      { status: 409 },
    );
  }
  const [before] = await db
    .select({
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!before) return Response.json({ error: "not_found" }, { status: 404 });
  await db.transaction(async (transaction) => {
    await transaction
      .update(user)
      .set({
        ...parsed.data,
        banReason: parsed.data.banned ? "管理者により無効化" : null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id));
    if (parsed.data.banned) {
      await transaction.delete(session).where(eq(session.userId, id));
    }
    await transaction.insert(adminAuditLog).values({
      id: randomUUID(),
      actorUserId: access.context.user.id,
      action: "user.account_updated",
      targetType: "user",
      targetId: id,
      metadata: { before, after: parsed.data },
    });
  });
  return Response.json({ id, ...parsed.data });
}

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { renewalDeclaration } from "@/db/schema";
import { declarationSchema } from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/declarations/[id]">,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = declarationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const result = await db
    .update(renewalDeclaration)
    .set({
      fiscalYear: parsed.data.fiscalYear,
      businessName: parsed.data.businessName,
      formData: parsed.data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(renewalDeclaration.id, id),
        eq(renewalDeclaration.userId, currentUser.id),
      ),
    );
  if (result[0].affectedRows === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ id });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/declarations/[id]">,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const result = await db
    .delete(renewalDeclaration)
    .where(
      and(
        eq(renewalDeclaration.id, id),
        eq(renewalDeclaration.userId, currentUser.id),
      ),
    );
  if (result[0].affectedRows === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}

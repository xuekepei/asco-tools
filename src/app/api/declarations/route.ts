import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { renewalDeclaration } from "@/db/schema";
import { declarationSchema } from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await db
    .select()
    .from(renewalDeclaration)
    .where(eq(renewalDeclaration.userId, currentUser.id))
    .orderBy(desc(renewalDeclaration.updatedAt));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = declarationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  const id = randomUUID();
  await db.insert(renewalDeclaration).values({
    id,
    userId: currentUser.id,
    fiscalYear: parsed.data.fiscalYear,
    businessName: parsed.data.businessName,
    formData: parsed.data,
  });
  return Response.json({ id }, { status: 201 });
}

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { renewalDeclaration } from "@/db/schema";
import { declarationSchema } from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";
import { consumeExportCredit, isDevelopmentExportBypass } from "@/lib/export-credits";
import { createPdfExport } from "@/lib/exporters";

const payloadSchema = z.object({
  declarationId: z.string().min(1),
  declaration: declarationSchema,
});

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const [record] = await db
    .select({ id: renewalDeclaration.id })
    .from(renewalDeclaration)
    .where(
      and(
        eq(renewalDeclaration.id, parsed.data.declarationId),
        eq(renewalDeclaration.userId, currentUser.id),
      ),
    )
    .limit(1);
  if (!record) return Response.json({ error: "not_found" }, { status: 404 });
  const buffer = await createPdfExport(parsed.data.declaration);
  const consumption = await consumeExportCredit({
    userId: currentUser.id,
    format: "pdf",
    declarationId: parsed.data.declarationId,
    bypass: isDevelopmentExportBypass(currentUser.email),
  });
  if (!consumption.allowed) return Response.json({ error: "export_credits_required" }, { status: 402 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=annual-renewal.pdf",
    },
  });
}

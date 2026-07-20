import { declarationSchema } from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";
import { consumeExportCredit, isDevelopmentExportBypass } from "@/lib/export-credits";
import { createPdfExport } from "@/lib/exporters";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = declarationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const buffer = await createPdfExport(parsed.data);
  const consumption = await consumeExportCredit({ userId: currentUser.id, format: "pdf", bypass: isDevelopmentExportBypass(currentUser.email) });
  if (!consumption.allowed) return Response.json({ error: "export_credits_required" }, { status: 402 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=annual-renewal.pdf",
    },
  });
}

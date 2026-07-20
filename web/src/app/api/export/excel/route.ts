import { declarationSchema } from "@/domain/declaration";
import { getCurrentUser } from "@/lib/current-user";
import { consumeExportCredit, isDevelopmentExportBypass } from "@/lib/export-credits";
import { createExcelExport } from "@/lib/exporters";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = declarationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const buffer = await createExcelExport(parsed.data);
  const consumption = await consumeExportCredit({ userId: currentUser.id, format: "xlsx", bypass: isDevelopmentExportBypass(currentUser.email) });
  if (!consumption.allowed) return Response.json({ error: "export_credits_required" }, { status: 402 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=annual-renewal.xlsx",
    },
  });
}

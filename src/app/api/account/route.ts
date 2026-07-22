import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { exportCreditAccount, stripeInvoice, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { ensureExportCreditAccount } from "@/lib/export-credits";
import { getExportPacks } from "@/lib/export-packs";
import { getFeatureFlags } from "@/lib/feature-flags";
import { isStripeConfigured } from "@/lib/stripe";

const accountSchema = z.object({
  name: z.string().trim().min(1, "表示名を入力してください").max(255),
});

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureExportCreditAccount(currentUser.id);
  const [records, credits, invoices] = await Promise.all([
    db
      .select({ name: user.name, email: user.email, plan: user.plan })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1),
    db.select({
      balance: exportCreditAccount.balance,
      lifetimePurchased: exportCreditAccount.lifetimePurchased,
      lifetimeUsed: exportCreditAccount.lifetimeUsed,
      complimentaryGranted: exportCreditAccount.complimentaryGranted,
    }).from(exportCreditAccount).where(eq(exportCreditAccount.userId, currentUser.id)).limit(1),
    db
      .select({
        id: stripeInvoice.stripeInvoiceId,
        number: stripeInvoice.number,
        status: stripeInvoice.status,
        amountPaid: stripeInvoice.amountPaid,
        currency: stripeInvoice.currency,
        hostedInvoiceUrl: stripeInvoice.hostedInvoiceUrl,
        invoicePdf: stripeInvoice.invoicePdf,
        createdAt: stripeInvoice.createdAt,
      })
      .from(stripeInvoice)
      .where(eq(stripeInvoice.userId, currentUser.id))
      .orderBy(desc(stripeInvoice.createdAt))
      .limit(12),
  ]);
  const record = records[0];
  return record
    ? Response.json({
        account: record,
        billing: {
          configured: (await getFeatureFlags()).billing && isStripeConfigured(),
          credits: credits[0] ?? { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, complimentaryGranted: 0 },
          packs: getExportPacks().map(({ key, credits, priceId }) => ({ key, credits, available: Boolean(priceId) })),
          invoices,
        },
      })
    : Response.json({ error: "not_found" }, { status: 404 });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  await db
    .update(user)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(user.id, currentUser.id));
  return Response.json({ name: parsed.data.name });
}

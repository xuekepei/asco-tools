import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  adminAuditLog,
  renewalDeclaration,
  exportCreditAccount,
  exportCreditPurchase,
  exportLog,
  stripeInvoice,
  user,
} from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    users,
    usersWithCredits,
    declarations,
    exports,
    recentAudits,
    paidRevenue,
    monthlyRevenue,
    outstanding,
    failedInvoices,
    paidPurchases,
    creditTotals,
  ] =
    await Promise.all([
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(exportCreditAccount).where(sql`${exportCreditAccount.balance} > 0`),
      db.select({ value: count() }).from(renewalDeclaration),
      db.select({ value: count() }).from(exportLog),
      db
        .select({
          id: adminAuditLog.id,
          action: adminAuditLog.action,
          targetType: adminAuditLog.targetType,
          targetId: adminAuditLog.targetId,
          createdAt: adminAuditLog.createdAt,
          actorName: user.name,
          actorEmail: user.email,
        })
        .from(adminAuditLog)
        .innerJoin(user, eq(adminAuditLog.actorUserId, user.id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(20),
      db
        .select({ value: sql<number>`coalesce(sum(${stripeInvoice.amountPaid}), 0)` })
        .from(stripeInvoice)
        .where(eq(stripeInvoice.status, "paid")),
      db
        .select({ value: sql<number>`coalesce(sum(${stripeInvoice.amountPaid}), 0)` })
        .from(stripeInvoice)
        .where(
          and(
            eq(stripeInvoice.status, "paid"),
            gte(stripeInvoice.paidAt, monthStart),
          ),
        ),
      db
        .select({ value: sql<number>`coalesce(sum(${stripeInvoice.amountRemaining}), 0)` })
        .from(stripeInvoice)
        .where(inArray(stripeInvoice.status, ["open", "uncollectible"])),
      db
        .select({ value: count() })
        .from(stripeInvoice)
        .where(eq(stripeInvoice.paymentFailed, true)),
      db.select({ value: count() }).from(exportCreditPurchase).where(eq(exportCreditPurchase.status, "paid")),
      db.select({
        purchased: sql<number>`coalesce(sum(${exportCreditAccount.lifetimePurchased}), 0)`,
        used: sql<number>`coalesce(sum(${exportCreditAccount.lifetimeUsed}), 0)`,
        available: sql<number>`coalesce(sum(${exportCreditAccount.balance}), 0)`,
      }).from(exportCreditAccount),
    ]);
  return Response.json({
    metrics: {
      users: users[0]?.value ?? 0,
      usersWithCredits: usersWithCredits[0]?.value ?? 0,
      declarations: declarations[0]?.value ?? 0,
      exports: exports[0]?.value ?? 0,
      paidRevenue: Number(paidRevenue[0]?.value ?? 0),
      monthlyRevenue: Number(monthlyRevenue[0]?.value ?? 0),
      outstanding: Number(outstanding[0]?.value ?? 0),
      failedInvoices: failedInvoices[0]?.value ?? 0,
      paidPurchases: paidPurchases[0]?.value ?? 0,
      purchasedCredits: Number(creditTotals[0]?.purchased ?? 0),
      usedCredits: Number(creditTotals[0]?.used ?? 0),
      availableCredits: Number(creditTotals[0]?.available ?? 0),
    },
    recentAudits,
    viewerRole: access.context.role,
  });
}

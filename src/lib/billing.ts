import "server-only";

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import {
  exportCreditAccount,
  exportCreditLedger,
  exportCreditPurchase,
  stripeInvoice,
  user,
} from "@/db/schema";
import { ensureExportCreditAccount } from "@/lib/export-credits";
import { getExportPack, type ExportPackKey } from "@/lib/export-packs";

function idOf(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function dateFromUnix(value: number | null | undefined) {
  return value == null ? null : new Date(value * 1000);
}

async function resolveUserId(customerId: string | null, metadataUserId?: string) {
  if (metadataUserId) {
    const [record] = await db.select({ id: user.id }).from(user).where(eq(user.id, metadataUserId)).limit(1);
    if (record) return record.id;
  }
  if (!customerId) return null;
  const [record] = await db.select({ id: user.id }).from(user).where(eq(user.stripeCustomerId, customerId)).limit(1);
  return record?.id ?? null;
}

export async function attachCheckoutCustomer(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const customerId = idOf(session.customer);
  if (!userId || !customerId) return;
  await db.update(user).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(user.id, userId));
}

export async function fulfillExportCreditPurchase(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const customerId = idOf(session.customer);
  const userId = session.metadata?.userId || session.client_reference_id;
  const packKey = session.metadata?.packKey as ExportPackKey | undefined;
  const pack = packKey ? getExportPack(packKey) : undefined;
  if (!customerId || !userId || !pack) throw new Error("invalid_credit_purchase_metadata");

  await ensureExportCreditAccount(userId);
  await db
    .insert(exportCreditPurchase)
    .values({
      id: randomUUID(),
      userId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: idOf(session.payment_intent),
      stripeCustomerId: customerId,
      packKey: pack.key,
      credits: pack.credits,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency?.toLowerCase() ?? "jpy",
      status: "pending",
    })
    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

  await db.transaction(async (transaction) => {
    const [purchase] = await transaction
      .select()
      .from(exportCreditPurchase)
      .where(eq(exportCreditPurchase.stripeCheckoutSessionId, session.id))
      .for("update")
      .limit(1);
    if (!purchase || purchase.status === "paid") return;
    const [account] = await transaction
      .select({ balance: exportCreditAccount.balance })
      .from(exportCreditAccount)
      .where(eq(exportCreditAccount.userId, userId))
      .for("update")
      .limit(1);
    if (!account) throw new Error("credit_account_missing");
    const balanceAfter = account.balance + pack.credits;
    await transaction
      .update(exportCreditAccount)
      .set({
        balance: balanceAfter,
        lifetimePurchased: sql`${exportCreditAccount.lifetimePurchased} + ${pack.credits}`,
        updatedAt: new Date(),
      })
      .where(eq(exportCreditAccount.userId, userId));
    await transaction
      .update(exportCreditPurchase)
      .set({
        stripePaymentIntentId: idOf(session.payment_intent),
        amountTotal: session.amount_total ?? 0,
        currency: session.currency?.toLowerCase() ?? "jpy",
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(exportCreditPurchase.id, purchase.id));
    await transaction.insert(exportCreditLedger).values({
      id: randomUUID(),
      userId,
      type: "purchase",
      delta: pack.credits,
      balanceAfter,
      sourceKey: `purchase:${session.id}`,
      purchaseId: purchase.id,
      description: `${pack.credits}回分を購入`,
    });
  });
}

export async function syncStripeInvoice(invoice: Stripe.Invoice, options: { eventCreated: number; paymentFailed?: boolean }) {
  const customerId = idOf(invoice.customer);
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionId = idOf(subscriptionDetails?.subscription ?? null);
  const metadataUserId = subscriptionDetails?.metadata?.userId || invoice.metadata?.userId;
  const userId = await resolveUserId(customerId, metadataUserId);
  const eventCreatedAt = dateFromUnix(options.eventCreated) ?? new Date();
  const [existing] = await db.select({ lastEventCreatedAt: stripeInvoice.lastEventCreatedAt }).from(stripeInvoice).where(eq(stripeInvoice.stripeInvoiceId, invoice.id)).limit(1);
  if (existing && existing.lastEventCreatedAt > eventCreatedAt) return;
  const tax = invoice.total_taxes?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const values = {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency.toLowerCase(),
    subtotal: invoice.subtotal,
    tax,
    total: invoice.total,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    periodStart: dateFromUnix(invoice.period_start),
    periodEnd: dateFromUnix(invoice.period_end),
    paidAt: dateFromUnix(invoice.status_transitions.paid_at),
    lastEventCreatedAt: eventCreatedAt,
    updatedAt: new Date(),
  };
  await db.insert(stripeInvoice).values({
    id: randomUUID(),
    stripeInvoiceId: invoice.id,
    ...values,
    paymentFailed: options.paymentFailed ?? false,
    createdAt: dateFromUnix(invoice.created) ?? new Date(),
  }).onDuplicateKeyUpdate({ set: {
    ...values,
    ...(options.paymentFailed === undefined ? (invoice.status === "paid" ? { paymentFailed: false } : {}) : { paymentFailed: options.paymentFailed }),
  } });
}

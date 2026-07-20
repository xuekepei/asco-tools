import type Stripe from "stripe";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { stripeWebhookEvent } from "@/db/schema";
import {
  attachCheckoutCustomer,
  fulfillExportCreditPurchase,
  syncStripeInvoice,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_API_KEY) {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const [processed] = await db
    .select({ id: stripeWebhookEvent.id })
    .from(stripeWebhookEvent)
    .where(eq(stripeWebhookEvent.id, event.id))
    .limit(1);
  if (processed) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await attachCheckoutCustomer(event.data.object);
        await fulfillExportCreditPurchase(event.data.object);
        break;
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.updated":
      case "invoice.voided":
        await syncStripeInvoice(event.data.object, { eventCreated: event.created });
        break;
      case "invoice.payment_failed":
        await syncStripeInvoice(event.data.object, {
          eventCreated: event.created,
          paymentFailed: true,
        });
        break;
      default:
        break;
    }

    await db.insert(stripeWebhookEvent).values({
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      stripeCreatedAt: new Date(event.created * 1000),
      processedAt: new Date(),
    });
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}

import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { exportCreditPurchase, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";
import { exportPackKeys, getExportPack } from "@/lib/export-packs";
import { getStripe, stripeErrorResponse } from "@/lib/stripe";

const inputSchema = z.object({ pack: z.enum(exportPackKeys) });

function integrationIdentifier() {
  const suffix = randomBytes(8).toString("base64url").replace(/[^a-z]/gi, "").slice(0, 8).padEnd(8, "x");
  return `ascoffice_web_${suffix}`;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const pack = getExportPack(parsed.data.pack);
  if (!pack?.priceId) return Response.json({ error: "stripe_not_configured" }, { status: 503 });

  const [account] = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    stripeCustomerId: user.stripeCustomerId,
  }).from(user).where(eq(user.id, currentUser.id)).limit(1);
  if (!account) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    const stripe = getStripe();
    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: account.name,
        email: account.email,
        metadata: { userId: account.id },
      }, { idempotencyKey: `customer-${account.id}` });
      customerId = customer.id;
      await db.update(user).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(user.id, account.id));
    }

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: account.id,
      integration_identifier: integrationIdentifier(),
      line_items: [{ price: pack.priceId, quantity: 1 }],
      locale: "ja",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX_ENABLED },
      invoice_creation: {
        enabled: true,
        invoice_data: { metadata: { userId: account.id, packKey: pack.key } },
      },
      metadata: { userId: account.id, packKey: pack.key },
      payment_intent_data: { metadata: { userId: account.id, packKey: pack.key } },
      success_url: `${baseUrl}/dashboard?billing=success`,
      cancel_url: `${baseUrl}/dashboard?billing=canceled`,
    }, {
      idempotencyKey: `checkout-${account.id}-${pack.key}-${Math.floor(Date.now() / 600000)}`,
    });
    await db.insert(exportCreditPurchase).values({
      id: randomUUID(),
      userId: account.id,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customerId,
      packKey: pack.key,
      credits: pack.credits,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency?.toLowerCase() ?? "jpy",
      status: "pending",
    }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
    return Response.json({ url: session.url });
  } catch (error) {
    return stripeErrorResponse(error);
  }
}

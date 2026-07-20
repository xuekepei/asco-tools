import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

let stripeClient: Stripe | undefined;

export function getStripe() {
  if (!env.STRIPE_API_KEY) {
    throw new Error("stripe_not_configured");
  }
  stripeClient ??= new Stripe(env.STRIPE_API_KEY, {
    apiVersion: "2026-06-24.dahlia",
    appInfo: {
      name: "ASCOFFICE 年度更新オンラインサービス",
      url: "https://ascoffice.co.jp/",
    },
  });
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(
    env.STRIPE_API_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_EXPORT_PACK_5_PRICE_ID &&
      env.STRIPE_EXPORT_PACK_20_PRICE_ID &&
      env.STRIPE_EXPORT_PACK_50_PRICE_ID,
  );
}

export function stripeErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "stripe_not_configured") {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  console.error("Stripe request failed", {
    type: error instanceof Error ? error.name : "unknown",
  });
  return Response.json({ error: "stripe_request_failed" }, { status: 502 });
}

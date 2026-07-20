import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";
import { getStripe, stripeErrorResponse } from "@/lib/stripe";

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const [account] = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, currentUser.id))
    .limit(1);
  if (!account?.stripeCustomerId) {
    return Response.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      locale: "ja",
      return_url: `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/dashboard`,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    return stripeErrorResponse(error);
  }
}

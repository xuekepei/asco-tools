import { readFile } from "node:fs/promises";

import Stripe from "stripe";

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function fail(message) {
  console.error(`Stripe verification failed: ${message}`);
  process.exitCode = 1;
}

const localEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const apiKey = localEnv.STRIPE_API_KEY || process.env.STRIPE_API_KEY;
const webhookSecret = localEnv.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
const expectedPacks = [
  ["5", 980, localEnv.STRIPE_EXPORT_PACK_5_PRICE_ID || process.env.STRIPE_EXPORT_PACK_5_PRICE_ID],
  ["20", 2_980, localEnv.STRIPE_EXPORT_PACK_20_PRICE_ID || process.env.STRIPE_EXPORT_PACK_20_PRICE_ID],
  ["50", 5_980, localEnv.STRIPE_EXPORT_PACK_50_PRICE_ID || process.env.STRIPE_EXPORT_PACK_50_PRICE_ID],
];

if (!apiKey) fail("STRIPE_API_KEY is missing");
else if (!/^(sk|rk)_test_/.test(apiKey)) fail("STRIPE_API_KEY is not a test/sandbox key");
if (!webhookSecret) fail("STRIPE_WEBHOOK_SECRET is missing");
else if (!webhookSecret.startsWith("whsec_")) fail("STRIPE_WEBHOOK_SECRET has an invalid format");

for (const [credits, , priceId] of expectedPacks) {
  if (!priceId) fail(`Price ID for the ${credits}-export pack is missing`);
  else if (!priceId.startsWith("price_")) fail(`Price ID for the ${credits}-export pack has an invalid format`);
}

if (process.exitCode) process.exit();

const stripe = new Stripe(apiKey);
const [balance, ...prices] = await Promise.all([
  stripe.balance.retrieve(),
  ...expectedPacks.map(([, , priceId]) => stripe.prices.retrieve(priceId)),
]);

if (balance.livemode !== false) fail("the authenticated Stripe environment is live mode");

for (let index = 0; index < expectedPacks.length; index += 1) {
  const [credits, expectedAmount, expectedPriceId] = expectedPacks[index];
  const price = prices[index];
  const problems = [];
  if (price.id !== expectedPriceId) problems.push("ID mismatch");
  if (price.livemode !== false) problems.push("live mode");
  if (!price.active) problems.push("inactive");
  if (price.type !== "one_time" || price.recurring) problems.push("not one-time");
  if (price.currency.toLowerCase() !== "jpy") problems.push("currency is not JPY");
  if (price.unit_amount !== expectedAmount) problems.push(`amount is not ¥${expectedAmount.toLocaleString("ja-JP")}`);
  if (problems.length) {
    fail(`${credits}-export pack: ${problems.join(", ")}`);
  } else {
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    console.log(`${credits} exports: ¥${expectedAmount.toLocaleString("ja-JP")} one-time, test mode (${price.id}, ${productId})`);
  }
}

if (!process.exitCode) console.log("Stripe export-pack configuration is valid and non-live.");

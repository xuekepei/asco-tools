import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .default(
      "mysql://labor_app:labor_app_password@127.0.0.1:3306/labor_insurance",
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("local-development-secret-change-before-production"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  DEV_PREMIUM_EMAILS: z.string().default(""),
  ADMIN_EMAILS: z.string().default(""),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-5.6-terra"),
  STRIPE_API_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  FREE_EXPORT_CREDITS: z.coerce.number().int().min(0).default(3),
  STRIPE_EXPORT_PACK_5_PRICE_ID: z.string().min(1).optional(),
  STRIPE_EXPORT_PACK_20_PRICE_ID: z.string().min(1).optional(),
  STRIPE_EXPORT_PACK_50_PRICE_ID: z.string().min(1).optional(),
  STRIPE_AUTOMATIC_TAX_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  DEV_PREMIUM_EMAILS: process.env.DEV_PREMIUM_EMAILS,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  STRIPE_API_KEY: process.env.STRIPE_API_KEY || undefined,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
  FREE_EXPORT_CREDITS: process.env.FREE_EXPORT_CREDITS,
  STRIPE_EXPORT_PACK_5_PRICE_ID:
    process.env.STRIPE_EXPORT_PACK_5_PRICE_ID || undefined,
  STRIPE_EXPORT_PACK_20_PRICE_ID:
    process.env.STRIPE_EXPORT_PACK_20_PRICE_ID || undefined,
  STRIPE_EXPORT_PACK_50_PRICE_ID:
    process.env.STRIPE_EXPORT_PACK_50_PRICE_ID || undefined,
  STRIPE_AUTOMATIC_TAX_ENABLED:
    process.env.STRIPE_AUTOMATIC_TAX_ENABLED,
});

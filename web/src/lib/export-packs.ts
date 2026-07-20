import "server-only";

import { env } from "@/lib/env";

export const exportPackKeys = ["credits_5", "credits_20", "credits_50"] as const;
export type ExportPackKey = (typeof exportPackKeys)[number];

export function getExportPacks() {
  return [
    { key: "credits_5" as const, credits: 5, priceId: env.STRIPE_EXPORT_PACK_5_PRICE_ID },
    { key: "credits_20" as const, credits: 20, priceId: env.STRIPE_EXPORT_PACK_20_PRICE_ID },
    { key: "credits_50" as const, credits: 50, priceId: env.STRIPE_EXPORT_PACK_50_PRICE_ID },
  ];
}

export function getExportPack(key: ExportPackKey) {
  return getExportPacks().find((pack) => pack.key === key);
}

import "server-only";

import { db } from "@/db";
import { featureFlag } from "@/db/schema";

/**
 * 管理コンソールから切り替える機能スイッチ。未設定（行なし）や
 * feature_flag テーブル未マイグレーション時はすべて OFF として扱う。
 */
export const featureFlagDefs = [
  { key: "assistant", label: "AI申告助手", description: "申告画面右下のAIアシスタントを表示します" },
  { key: "billing", label: "回数パック購入", description: "Stripe決済による出力回数パックの購入を有効にします" },
] as const;

export type FeatureFlagKey = (typeof featureFlagDefs)[number]["key"];

export async function getFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const flags: Record<FeatureFlagKey, boolean> = { assistant: false, billing: false };
  try {
    const rows = await db.select().from(featureFlag);
    for (const row of rows) {
      if (row.key in flags) flags[row.key as FeatureFlagKey] = row.enabled;
    }
  } catch {
    // テーブル未作成（マイグレーション未適用）の間は全機能 OFF
  }
  return flags;
}

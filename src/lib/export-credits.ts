import "server-only";

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { exportCreditAccount, exportCreditLedger, exportLog } from "@/db/schema";
import { env } from "@/lib/env";

export async function ensureExportCreditAccount(userId: string) {
  const bonus = env.FREE_EXPORT_CREDITS;
  await db.transaction(async (transaction) => {
    await transaction
      .insert(exportCreditAccount)
      .values({
        userId,
        balance: bonus,
        complimentaryGranted: bonus,
      })
      .onDuplicateKeyUpdate({ set: { userId } });
    await transaction
      .insert(exportCreditLedger)
      .values({
        id: randomUUID(),
        userId,
        type: "signup_bonus",
        delta: bonus,
        balanceAfter: bonus,
        sourceKey: `signup:${userId}`,
        description: "新規登録特典",
      })
      .onDuplicateKeyUpdate({ set: { sourceKey: `signup:${userId}` } });
  });
  const [account] = await db
    .select()
    .from(exportCreditAccount)
    .where(eq(exportCreditAccount.userId, userId))
    .limit(1);
  return account;
}

export function isDevelopmentExportBypass(email: string) {
  return env.DEV_PREMIUM_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function consumeExportCredit(options: {
  userId: string;
  format: "xlsx" | "pdf";
  declarationId?: string | null;
  bypass?: boolean;
}) {
  if (options.bypass) {
    await db.insert(exportLog).values({
      id: randomUUID(),
      userId: options.userId,
      declarationId: options.declarationId ?? null,
      format: options.format,
    });
    return { allowed: true as const, remaining: null };
  }

  await ensureExportCreditAccount(options.userId);
  return db.transaction(async (transaction) => {
    const [account] = await transaction
      .select({ balance: exportCreditAccount.balance })
      .from(exportCreditAccount)
      .where(eq(exportCreditAccount.userId, options.userId))
      .for("update")
      .limit(1);
    if (!account || account.balance < 1) {
      return { allowed: false as const, remaining: 0 };
    }
    const exportLogId = randomUUID();
    const remaining = account.balance - 1;
    await transaction
      .update(exportCreditAccount)
      .set({
        balance: remaining,
        lifetimeUsed: sql`${exportCreditAccount.lifetimeUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(exportCreditAccount.userId, options.userId));
    await transaction.insert(exportLog).values({
      id: exportLogId,
      userId: options.userId,
      declarationId: options.declarationId ?? null,
      format: options.format,
    });
    await transaction.insert(exportCreditLedger).values({
      id: randomUUID(),
      userId: options.userId,
      type: "export",
      delta: -1,
      balanceAfter: remaining,
      sourceKey: `export:${exportLogId}`,
      exportLogId,
      description: `${options.format.toUpperCase()}出力`,
    });
    return { allowed: true as const, remaining };
  });
}

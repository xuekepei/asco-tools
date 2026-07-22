import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

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

/**
 * 计费粒度：每份申告书只扣 1 次。首次导出（任意格式）在既有的
 * FOR UPDATE 事务里扣减并写 export_log；此后同一申告书的导出以
 * export_log 中已有记录为凭据免费放行（账户锁串行化并发导出，
 * 不会重复扣减）。
 */
export async function consumeExportCredit(options: {
  userId: string;
  format: "xlsx" | "pdf";
  declarationId: string;
  bypass?: boolean;
}) {
  if (options.bypass) {
    await db.insert(exportLog).values({
      id: randomUUID(),
      userId: options.userId,
      declarationId: options.declarationId,
      format: options.format,
    });
    return { allowed: true as const, remaining: null, charged: false };
  }

  await ensureExportCreditAccount(options.userId);
  return db.transaction(async (transaction) => {
    const [account] = await transaction
      .select({ balance: exportCreditAccount.balance })
      .from(exportCreditAccount)
      .where(eq(exportCreditAccount.userId, options.userId))
      .for("update")
      .limit(1);
    const [alreadyCharged] = await transaction
      .select({ id: exportLog.id })
      .from(exportLog)
      .where(
        and(
          eq(exportLog.userId, options.userId),
          eq(exportLog.declarationId, options.declarationId),
        ),
      )
      .limit(1);
    if (alreadyCharged) {
      await transaction.insert(exportLog).values({
        id: randomUUID(),
        userId: options.userId,
        declarationId: options.declarationId,
        format: options.format,
      });
      return {
        allowed: true as const,
        remaining: account?.balance ?? 0,
        charged: false,
      };
    }
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
      declarationId: options.declarationId,
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
    return { allowed: true as const, remaining, charged: true };
  });
}

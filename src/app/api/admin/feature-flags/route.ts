import { randomUUID } from "node:crypto";

import { z } from "zod";

import { db } from "@/db";
import { adminAuditLog, featureFlag } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin";
import { featureFlagDefs, getFeatureFlags } from "@/lib/feature-flags";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;
  const flags = await getFeatureFlags();
  return Response.json({
    items: featureFlagDefs.map((def) => ({ ...def, enabled: flags[def.key] })),
  });
}

const patchSchema = z.object({
  key: z.enum(featureFlagDefs.map((def) => def.key) as [string, ...string[]]),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const access = await requireAdminApi({ write: true });
  if ("error" in access) return access.error;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  await db.transaction(async (transaction) => {
    await transaction
      .insert(featureFlag)
      .values({ key: parsed.data.key, enabled: parsed.data.enabled })
      .onDuplicateKeyUpdate({ set: { enabled: parsed.data.enabled } });
    await transaction.insert(adminAuditLog).values({
      id: randomUUID(),
      actorUserId: access.context.user.id,
      action: "feature_flag.updated",
      targetType: "feature_flag",
      targetId: parsed.data.key,
      metadata: { enabled: parsed.data.enabled },
    });
  });
  return Response.json({ ok: true });
}

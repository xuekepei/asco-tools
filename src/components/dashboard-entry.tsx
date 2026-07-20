import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  DeclarationWorkspace,
  type Section,
  type WorkspaceView,
} from "@/components/declaration-workspace";
import { db } from "@/db";
import { renewalDeclaration } from "@/db/schema";
import { businessSectionSchema, normalizeDeclaration } from "@/domain/declaration";
import { getAdminContext } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export async function DashboardEntry({ view, section = "business", declarationId }: { view: WorkspaceView; section?: Section; declarationId?: string }) {
  const currentSession = await auth.api.getSession({ headers: await headers() });
  if (!currentSession) redirect("/login");

  let initialDeclaration: { id: string; formData: unknown } | null = null;
  if (view === "editor" && declarationId) {
    const [record] = await db
      .select({ id: renewalDeclaration.id, formData: renewalDeclaration.formData })
      .from(renewalDeclaration)
      .where(
        and(
          eq(renewalDeclaration.id, declarationId),
          eq(renewalDeclaration.userId, currentSession.user.id),
        ),
      )
      .limit(1);
    if (!record) notFound();
    initialDeclaration = record;

    if (section !== "business") {
      const businessResult = businessSectionSchema.safeParse(
        normalizeDeclaration(record.formData),
      );
      if (!businessResult.success) {
        redirect(`/dashboard/declarations/${record.id}/business`);
      }
    }
  }

  const admin = await getAdminContext();
  const routeKey = `${view}:${declarationId ?? "new"}:${section}`;
  return (
    <DeclarationWorkspace
      key={routeKey}
      user={{
        name: currentSession.user.name,
        email: currentSession.user.email,
      }}
      aiEnabled={Boolean(env.OPENAI_API_KEY)}
      isAdmin={Boolean(admin)}
      initialView={view}
      initialSection={section}
      initialDeclaration={initialDeclaration}
    />
  );
}

import { notFound } from "next/navigation";

import { DashboardEntry } from "@/components/dashboard-entry";
import type { Section } from "@/components/declaration-workspace";

const validSections = new Set<Section>([
  "business",
  "wages",
  "rates",
  "review",
]);

export default async function DeclarationStepPage({ params }: PageProps<"/dashboard/declarations/[id]/[step]">) {
  const { id, step } = await params;
  if (!validSections.has(step as Section)) notFound();
  return (
    <DashboardEntry
      view="editor"
      declarationId={id}
      section={step as Section}
    />
  );
}

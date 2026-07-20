import { redirect } from "next/navigation";

export default async function DeclarationPage({ params }: PageProps<"/dashboard/declarations/[id]">) {
  const { id } = await params;
  redirect(`/dashboard/declarations/${id}/business`);
}

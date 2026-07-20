import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminContext } from "@/lib/admin";
import { getCurrentUser } from "@/lib/current-user";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const admin = await getAdminContext();
  if (!admin) redirect("/dashboard");
  return (
    <AdminDashboard
      viewer={{
        id: admin.user.id,
        name: admin.user.name,
        email: admin.user.email,
        role: admin.role,
      }}
    />
  );
}

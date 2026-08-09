import { AppShell } from "@/components/layout/appShell";
import { RequireAuth } from "@/components/auth/require-auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

import Link from "next/link";
import { LayoutDashboard, Users, FileBarChart } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
];

export function AppSidebar() {
  return (
    <aside className="bg-background hidden w-56 shrink-0 border-r md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-4 font-semibold tracking-tight">
        Pokerole
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

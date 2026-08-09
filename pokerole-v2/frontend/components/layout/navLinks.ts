import {
  LayoutDashboard,
  BookOpen,
  Briefcase,
  Swords,
  UserRound,
} from "lucide-react";

export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Pokédex", icon: BookOpen },
  { href: "/relatorios", label: "Movedex", icon: Swords },
  { href: "/meus-pokemon", label: "Meus Pokémon", icon: UserRound },
  { href: "/meu-time", label: "Meu Time", icon: Briefcase },
] as const;

export function getNavIndex(pathname: string) {
  const exact = NAV_LINKS.findIndex((link) => link.href === pathname);
  if (exact >= 0) return exact;
  return NAV_LINKS.findIndex((link) => pathname.startsWith(link.href));
}

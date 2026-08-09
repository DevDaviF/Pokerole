import { LayoutDashboard, BookOpen, Swords, Users, FileBarChart } from "lucide-react";


export const NAV_LINKS = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clientes", label: "Pokédex", icon: BookOpen },
    { href: "/relatorios", label: "Movedex", icon: Swords },
    { href: "/clientes", label: "Meus Pokémon", icon: Users },
    { href: "/relatorios", label: "Meu Time", icon: FileBarChart },
  ] as const;
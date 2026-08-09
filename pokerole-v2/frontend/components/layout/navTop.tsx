"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Moon, PanelTop, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { NAV_LINKS } from "./navLinks";
import { cn } from "@/lib/utils";
import { PokeballMark } from "@/features/autenticacao/pokeball-mark";
import { MobileSwipePager } from "./mobile-swipe-pager";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { logoutAndRedirect } from "@/lib/auth/logout";

type Props = {
  children: React.ReactNode;
  onChangeNavMode?: () => void;
};

export function NavTop({ children, onChangeNavMode }: Props) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Desktop header pill */}
      <header className="pointer-events-none fixed inset-x-0 top-4 z-40 hidden justify-center px-4 md:flex">
        <div className="border-border bg-card/80 pointer-events-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border px-3 py-2 shadow-lg backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-2 pl-1">
            <PokeballMark className="size-8" />
            <span className="text-sm font-semibold">Pokérole</span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-muted-foreground hover:bg-muted hover:text-foreground rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition",
                  pathname === link.href &&
                    "bg-muted text-foreground font-medium",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            {onChangeNavMode && (
              <button
                type="button"
                onClick={onChangeNavMode}
                title="Trocar modo de navegação"
                className="bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition"
              >
                <PanelTop className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={isDark ? "Modo claro" : "Modo escuro"}
              className="bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={logoutAndRedirect}
              title="Sair"
              className="bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo: no mobile desliza entre abas (estilo Meta) */}
      <div className="px-4 pt-6 pb-24 md:pt-24 md:pb-8">
        <MobileSwipePager>{children}</MobileSwipePager>
      </div>

      <MobileBottomNav />
    </div>
  );
}

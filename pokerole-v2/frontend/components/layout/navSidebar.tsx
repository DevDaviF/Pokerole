"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NAV_LINKS } from "./navLinks";
import { cn } from "@/lib/utils";
import { PokeballMark } from "@/features/autenticacao/pokeball-mark";
import { logoutAndRedirect } from "@/lib/auth/logout";

type Props = {
  children: React.ReactNode;
  onChangeNavMode?: () => void;
};

export function NavSidebar({ children, onChangeNavMode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div
      className={cn(
        "flex min-h-dvh",
        isDark ? "bg-[#0a0a0a]" : "bg-[#e8e8e8]",
      )}
    >
      <aside
        className={cn(
          "flex shrink-0 flex-col py-3 transition-[width] duration-200",
          expanded ? "w-[220px] items-stretch px-2.5" : "w-14 items-center",
        )}
      >
        {/* Logo + expandir (não abre modal) */}
        <div
          className={cn(
            "mb-3 flex items-center gap-2",
            expanded ? "justify-between px-1" : "flex-col",
          )}
        >
          <div className="flex items-center gap-2.5">
            <PokeballMark className="size-8 shrink-0" />
            {expanded && (
              <span className="truncate text-[15px] font-semibold tracking-tight">
                Pokérole
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Recolher sidebar" : "Expandir sidebar"}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl transition",
              isDark
                ? "text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                : "text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-800",
            )}
          >
            {expanded ? (
              <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-1",
            expanded ? "items-stretch" : "items-center",
          )}
        >
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition",
                  expanded ? "px-3 py-2.5 text-[13.5px]" : "size-9 justify-center",
                  active
                    ? isDark
                      ? "bg-white/[0.08] font-medium text-white ring-1 ring-white/15"
                      : "bg-black/[0.06] font-medium text-zinc-900 ring-1 ring-black/10"
                    : isDark
                      ? "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
                      : "text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-800",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                {expanded && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: tema + trocar modo (botão à parte) */}
        <div
          className={cn(
            "mt-auto flex gap-1.5 pb-1",
            expanded ? "flex-row items-center px-1" : "flex-col items-center",
          )}
        >
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Modo claro" : "Modo escuro"}
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition",
              isDark
                ? "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
                : "text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-800",
            )}
          >
            {isDark ? (
              <Sun className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Moon className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>

          {onChangeNavMode && (
            <button
              type="button"
              onClick={onChangeNavMode}
              title="Trocar modo de navegação"
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition",
                isDark
                  ? "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
                  : "text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-800",
              )}
            >
              <Settings2 className="size-[18px]" strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={logoutAndRedirect}
            title="Sair"
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition",
              isDark
                ? "text-white/40 hover:bg-white/[0.05] hover:text-rose-300"
                : "text-zinc-500 hover:bg-black/[0.04] hover:text-rose-600",
            )}
          >
            <LogOut className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main
        className={cn(
          "my-2 mr-2 min-w-0 flex-1 overflow-auto rounded-[28px] p-6 md:my-3 md:mr-3",
          "h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)]",
          isDark
            ? "bg-[#141414] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            : "bg-white text-zinc-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
        )}
      >
        {children}
      </main>
    </div>
  );
}

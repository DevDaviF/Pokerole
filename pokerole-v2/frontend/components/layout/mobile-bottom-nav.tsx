"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { getNavIndex, NAV_LINKS } from "./navLinks";
import { cn } from "@/lib/utils";
import { logoutAndRedirect } from "@/lib/auth/logout";

export function MobileBottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(0, getNavIndex(pathname));

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div
        className={cn(
          "pointer-events-auto flex w-fit max-w-full items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur-xl",
          "border-border bg-card/90 text-foreground",
        )}
      >
        {NAV_LINKS.map((link, i) => {
          const Icon = link.icon;
          const active = i === activeIndex;

          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-11 items-center justify-center rounded-2xl transition",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className="size-[22px]"
                strokeWidth={active ? 2.25 : 1.75}
              />
            </Link>
          );
        })}

        <button
          type="button"
          onClick={logoutAndRedirect}
          title="Sair"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-11 items-center justify-center rounded-2xl transition"
        >
          <LogOut className="size-[22px]" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}

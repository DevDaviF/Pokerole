"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "muted" | "ghost" | "pill";
};

export function ThemeToggle({ className, variant = "muted" }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme !== "light";

  // SSR + 1º paint do client idênticos (evita hydration mismatch)
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Alternar tema"
        className={cn(
          "flex size-9 items-center justify-center transition",
          variant === "muted" &&
            "bg-muted text-muted-foreground rounded-full",
          variant === "ghost" && "text-muted-foreground rounded-xl",
          variant === "pill" &&
            "border-border bg-card/80 text-foreground rounded-full border shadow-sm backdrop-blur-xl",
          className,
        )}
      >
        <span className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Modo claro" : "Modo escuro"}
      aria-label={isDark ? "Modo claro" : "Modo escuro"}
      className={cn(
        "flex size-9 items-center justify-center transition",
        variant === "muted" &&
          "bg-muted text-muted-foreground hover:text-foreground rounded-full",
        variant === "ghost" &&
          "text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl",
        variant === "pill" &&
          "border-border bg-card/80 text-foreground rounded-full border shadow-sm backdrop-blur-xl",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

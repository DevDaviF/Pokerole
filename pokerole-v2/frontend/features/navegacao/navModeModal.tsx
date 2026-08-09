"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Navmode } from "@/types/navigation";
import { PokeballMark } from "@/features/autenticacao/pokeball-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";

type Props = {
  open: boolean;
  onConfirm: (mode: Navmode) => void;
  allowDismiss?: boolean;
  onDismiss?: () => void;
  initialMode?: Navmode | null;
};

const STEPS = [
  { id: 1 as const, label: "Login concluído" },
  { id: 2 as const, label: "Selecionar o modo" },
  { id: 3 as const, label: "Entrar no app" },
];

export function NavModeModal({
  open,
  onConfirm,
  allowDismiss = false,
  onDismiss,
  initialMode = null,
}: Props) {
  const alreadyLoggedIn = initialMode !== null;
  const [step, setStep] = useState<1 | 2>(alreadyLoggedIn ? 2 : 1);
  const [selected, setSelected] = useState<Navmode | null>(initialMode);

  useEffect(() => {
    if (!open) return;
    // Já logado / trocando modo → vai direto pros cards
    setStep(initialMode ? 2 : 1);
    setSelected(initialMode);
  }, [open, initialMode]);

  function dismiss() {
    if (allowDismiss) onDismiss?.();
  }

  function handleOpenChange(next: boolean) {
    if (!next) dismiss();
  }

  function goToStep(target: 1 | 2) {
    setStep(target);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-w-4xl gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-4xl sm:rounded-[28px]",
          "border-border bg-card text-card-foreground",
        )}
        onInteractOutside={(e) => {
          if (!allowDismiss) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!allowDismiss) e.preventDefault();
          else dismiss();
        }}
      >
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <ThemeToggle variant="ghost" className="size-8" />
          {allowDismiss && (
            <button
              type="button"
              onClick={dismiss}
              title="Fechar"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full transition"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid min-h-[420px] md:grid-cols-[260px_1fr]">
          <aside className="border-border bg-muted/50 flex flex-col p-6 md:border-r">
            <div className="flex items-center gap-3">
              <PokeballMark className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">
                  Pokérole
                </p>
                <p className="text-muted-foreground text-xs">
                  Escolha de navegação
                </p>
              </div>
            </div>

            <ul className="mt-8 space-y-2">
              {STEPS.map((s) => {
                const isLogin = s.id === 1;
                const isSelect = s.id === 2;
                const isEnter = s.id === 3;
                // 1 sempre concluído · 2 ativo/concluído conforme o passo · 3 só após confirmar
                const done = isLogin || (isSelect && step === 2);
                const active =
                  (isLogin && step === 1) || (isSelect && step === 2);
                const clickable = isLogin || isSelect;

                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={isEnter}
                      onClick={() => {
                        if (isLogin) goToStep(1);
                        if (isSelect) goToStep(2);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                        clickable && "hover:bg-foreground/5",
                        isEnter && "cursor-default opacity-70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full transition",
                          done || active
                            ? "bg-sky-500 text-white"
                            : "bg-muted-foreground/15 text-muted-foreground",
                          active &&
                            "ring-2 ring-sky-500/40 ring-offset-2 ring-offset-background",
                        )}
                      >
                        {done ? (
                          <Check className="size-3.5" strokeWidth={2.5} />
                        ) : (
                          <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          active || done
                            ? "text-foreground font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="text-muted-foreground mt-auto pt-8 text-xs">
              {step === 1
                ? "Quase lá — escolha como quer navegar."
                : "Selecione um modo e confirme para entrar."}
            </p>
          </aside>

          <div className="relative flex flex-col overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage:
                  "radial-gradient(ellipse 70% 60% at 50% 20%, black, transparent)",
              }}
            />

            {step === 1 ? (
              <div className="relative z-10 flex flex-1 flex-col p-6 md:p-8">
                <p className="text-xs font-medium tracking-wider text-sky-500 uppercase">
                  Bem-vindo
                </p>
                <DialogHeader className="mt-3 text-left">
                  <DialogTitle className="text-foreground text-3xl font-semibold tracking-tight">
                    Como você quer navegar?
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground mt-2 max-w-md text-[15px]">
                    Escolha o modo de navegação que você prefere usar no
                    Pokérole. Você pode trocar depois a qualquer momento.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-8 flex flex-1 items-center justify-center">
                  <div className="relative flex size-36 items-center justify-center">
                    <div className="animate-pulse-ring border-accent/25 absolute inset-0 rounded-full border" />
                    <div className="animate-pulse-ring border-primary/30 absolute inset-3 rounded-full border [animation-delay:-2s]" />
                    <PokeballMark className="relative z-10 size-16" />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-6">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-6 rounded-full bg-sky-500" />
                    <span className="bg-muted-foreground/30 size-1.5 rounded-full" />
                  </div>
                  <Button
                    className="rounded-full bg-sky-500 px-6 text-white hover:bg-sky-600"
                    onClick={() => goToStep(2)}
                  >
                    Avançar →
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-1 flex-col p-6 md:p-8">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-foreground text-2xl font-semibold tracking-tight">
                    Selecione o modo
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Toque em um card e confirme
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-6 grid flex-1 gap-4 md:grid-cols-2">
                  <ModeCard
                    active={selected === "top"}
                    title="Navegação superior"
                    description="Header no topo e swiper por gestos no mobile"
                    preview="top"
                    onClick={() => setSelected("top")}
                  />
                  <ModeCard
                    active={selected === "sidebar"}
                    title="Barra lateral"
                    description="Sidebar com área de conteúdo arredondada"
                    preview="sidebar"
                    onClick={() => setSelected("sidebar")}
                  />
                </div>

                <div className="mt-8 flex items-center justify-between">
                  {!alreadyLoggedIn ? (
                    <Button variant="ghost" onClick={() => goToStep(1)}>
                      Voltar
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    className="rounded-full bg-sky-500 px-6 text-white hover:bg-sky-600"
                    disabled={!selected}
                    onClick={() => selected && onConfirm(selected)}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  active,
  title,
  description,
  preview,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  preview: "top" | "sidebar";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-sky-400 bg-sky-500/10"
          : "border-border bg-muted/30 hover:border-foreground/20",
      )}
    >
      <div className="bg-muted relative mb-3 h-28 overflow-hidden rounded-xl p-3">
        {preview === "top" ? (
          <div className="bg-foreground/15 mx-auto h-7 w-[85%] rounded-full" />
        ) : (
          <div className="flex h-full gap-2">
            <div className="bg-foreground/15 w-8 rounded-lg" />
            <div className="bg-foreground/10 flex-1 rounded-2xl" />
          </div>
        )}
        {active && (
          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-sky-500 text-white">
            <Check className="size-3.5" />
          </span>
        )}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </button>
  );
}

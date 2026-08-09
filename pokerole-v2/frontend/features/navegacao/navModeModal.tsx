"use client";

import { useState } from "react";
import { Check, PanelLeft, PanelTop } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Navmode } from "@/types/navigation";

type Props = {
    open: boolean;
    onConfirm: (mode: Navmode) => void;
}

export function NavModeModal({ open, onConfirm}: Props) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selected, setSelected] = useState<Navmode | null>(null);

    return (
        <Dialog open={open}>
            <DialogContent
            showCloseButton={false}
            className="login-theme max-w-3xl gap-0 overflow-hidden border-white/10 bg-[12151d] p-0 text-white sm:max-w-3xl sm:rounded-3xl"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            >
                {step === 1 ? (
                    <div className="grid md:grid-cols-[240px_1fr]">
                        <aside className="border-white/10 bg-[#0f131a] p-6 md:border-r">
                        <p className="text-sm font-semibold text-[#f5d76e]">Pokérole</p>
                        <p className="mt-1 text-xs text-white/50">Escolha de navegação</p>
                         <ul className="mt-6 space-y-3 text-sm text-white/70">
                            <li>✓ Login concluído</li>
                            <li>✓ Selecionar o modo</li>
                            <li className="text-white/35">Entrar no app</li>
                         </ul>
                        </aside>

                        <div className="p-6 md:">
                            <DialogHeader>
                                <DialogTitle className="text-2xl text-white">
                                    Como que você quer navegar?
                                </DialogTitle>
                                <DialogDescription className="text-white/60">
                                    Escolha o modo de navegação que você prefere usar no Pokérole.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-8 flex justify-end">
                                <Button
                                className="rounded-xl bg-[#e11d48] text-white hover:bg-[#be123c]"
                                onClick={() => setStep(2)}
                                >
                                    Avançar →
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 md:p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl text-white">
                                Selecione o modo
                            </DialogTitle>
                            <DialogDescription className="text-white/60">
                            Troque em um card e confirme
                            </DialogDescription>
                        </DialogHeader>


                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <button 
                            type="button"
                            onClick={() => setSelected("top")}
                            className={cn(
                                "rounded-2xl border p-4 text-left transition",
                                selected === "top"
                                ? "border-cyan-400 bg-cyan-400/10"
                                : "border-white/10 bg-white/5 hover:border-white/30",
                            )}
                            >
                                <div className="relative mb-3 flex h-28 items-start justify-center rounded-xl bg-[#0f172a] p-4">
                                    <div className="h-7 w-4/5 rounded-full bg-white/15"/>
                                    <PanelTop className="absolute bottom-3 left-3 size-4 text-white/40"/>
                                    {selected === "top" && (
                                        <span className="absolute top-2 right-2 flex size-6 items-center rounded-full bg-cyan-400 text-black">
                                            <Check className="size-3.5" />
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-sembibold">Navegação superior</h3>
                                <p className="mt-1 text-sm text-white/60">Header com navegação no topo e swiper(navegação por gestos) no mobile</p>
                            </button>

                            <button 
                            type="button"
                            onClick={() => setSelected("sidebar")}
                            className={cn(
                                "rounded-2xl border p-4 text-left transition",
                                selected === "sidebar"
                                ? "border-cyan-400 bg-cyan-400/10"
                                : "border-white/10 bg-white/5 hover:border-white/30",
                            )}
                            >
                                <div className="relative mb-3 flex h-28 gap-2 rounded-xl bg-[#0f172a] p-3">
                                    <div className="w-8 rounded-lg bg-white/10">
                                    <PanelLeft className="absloute bottom-3 left-12 size-4 text-white/40"/>
                                    {selected === "sidebar" && (
                                        <span className="absolute top-2 right-2 flex size-6 items-center rounded-full bg-cyan-400 text-black">
                                            <Check className="size-3.5" />
                                        </span>
                                    )}
                                    </div>
                                    <h3 className="font-sembibold">Barra lateral</h3>
                                    <p className="mt-1 text-sm text-white/60">Sidebar, com área de conteúdo arredondada.</p>
                                </div>
                            </button>
                        </div>

                        <div className="mt-8 flex justify-between">
                            <Button variant="ghost"
                            className="text-white hover:bg-white/10"
                            onClick={() => setStep(1)}
                            >
                                Voltar
                            </Button>
                            <Button
                            className="rounded-xl bg-[#e11d48] text-white hover:bg-[#be123c]"
                            disabled={!selected}
                            onClick={() => selected && onConfirm(selected)}
                            >
                                Confirmar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
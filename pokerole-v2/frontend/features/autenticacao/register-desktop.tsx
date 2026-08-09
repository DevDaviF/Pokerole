"use client";

import Link from "next/link";
import {
  ArrowRight,
  Dice5,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  Swords,
  User,
} from "lucide-react";
import { AuroraBackground } from "./aurora-background";
import { PokeballMark } from "./pokeball-mark";
import type { RegisterViewProps } from "./register-screen";

const FEATURES = [
  { icon: Swords, label: "Monte e evolua seu time de batalha" },
  { icon: Dice5, label: "Role os dados e conduza suas campanhas" },
  { icon: Sparkles, label: "Capture, registre e acompanhe sua Pokédex" },
];

export function RegisterDesktop({
  username,
  email,
  password,
  showPassword,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}: RegisterViewProps) {
  return (
    <main className="login-theme relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-10 lg:p-10">
      <AuroraBackground />

      <section className="relative z-10 grid w-full max-w-5xl grid-cols-2 items-stretch gap-16">
        <aside className="relative flex flex-col justify-between overflow-hidden">
          <div className="animate-pulse-ring absolute -bottom-24 -left-24 h-72 w-72 rounded-full border border-accent/20" />
          <div className="animate-pulse-ring absolute -bottom-16 -left-16 h-56 w-56 rounded-full border border-primary/30 [animation-delay:-2s]" />

          <div className="relative z-10 flex items-center gap-3">
            <PokeballMark
              className="h-10 w-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
              gradientId="pkTopRegisterDesktop"
            />
            <p className="text-lg font-bold tracking-wide text-accent">Pokérole</p>
          </div>

          <div className="relative z-10 max-w-sm">
            <h1 className="text-balance text-4xl leading-tight font-bold text-foreground">
              Crie sua conta, <span className="text-accent">Treinador</span>.
            </h1>
            <p className="text-muted-foreground mt-4 text-pretty leading-relaxed">
              Escolha seu nome, e-mail e senha para começar a jornada.
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="bg-foreground/10 text-accent ring-border flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-foreground/90 text-sm leading-relaxed">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-muted-foreground relative z-10 text-xs">
            Gotta play &apos;em all — sessão registrada com segurança.
          </p>
        </aside>

        <div className="relative mx-auto w-full max-w-sm self-center">
          <div className="mb-6">
            <h2 className="text-foreground text-2xl font-bold">Criar conta</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Preencha os dados para confirmar seu cadastro.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label
                htmlFor="username-desktop"
                className="text-foreground/90 text-sm font-medium"
              >
                Nome de usuário
              </label>
              <div className="group relative">
                <User className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
                <input
                  id="username-desktop"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="ash.ketchum"
                  required
                  className="border-input bg-foreground/[0.04] text-foreground placeholder:text-muted-foreground/70 focus:border-accent/60 focus:bg-foreground/[0.06] focus:ring-accent/30 h-12 w-full rounded-xl border pr-4 pl-10 text-sm outline-none transition focus:ring-2"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email-register-desktop"
                className="text-foreground/90 text-sm font-medium"
              >
                E-mail
              </label>
              <div className="group relative">
                <Mail className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
                <input
                  id="email-register-desktop"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="treinador@pokerole.app"
                  required
                  className="border-input bg-foreground/[0.04] text-foreground placeholder:text-muted-foreground/70 focus:border-accent/60 focus:bg-foreground/[0.06] focus:ring-accent/30 h-12 w-full rounded-xl border pr-4 pl-10 text-sm outline-none transition focus:ring-2"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password-register-desktop"
                className="text-foreground/90 text-sm font-medium"
              >
                Senha
              </label>
              <div className="group relative">
                <Lock className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
                <input
                  id="password-register-desktop"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  required
                  minLength={8}
                  className="border-input bg-foreground/[0.04] text-foreground placeholder:text-muted-foreground/70 focus:border-accent/60 focus:bg-foreground/[0.06] focus:ring-accent/30 h-12 w-full rounded-xl border pr-11 pl-10 text-sm outline-none transition focus:ring-2"
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_oklch(0.62_0.23_25/0.6)] focus-visible:ring-primary/50 group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-wide transition hover:brightness-110 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99]"
            >
              Confirmar cadastro
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <Link
              href="/login"
              className="border-accent/40 text-accent hover:bg-accent/10 focus-visible:ring-accent/40 flex h-12 w-full items-center justify-center rounded-xl border bg-transparent text-sm font-semibold tracking-wide transition focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99]"
            >
              Já tenho conta
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AuroraBackground } from "./aurora-background";
import { PokeballMark } from "./pokeball-mark";
import type { RegisterViewProps } from "./register-screen";

export function RegisterMobile({
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
    <main className="login-theme relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-8">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <PokeballMark
            className="h-14 w-14 drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            gradientId="pkTopRegisterMobile"
          />
          <p className="text-accent mt-3 text-xs font-semibold tracking-widest uppercase">
            Pokérole
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-bold">
            Criar conta
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
            Escolha seu nome, e-mail e senha para começar.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label
              htmlFor="username-mobile"
              className="text-foreground/90 text-sm font-medium"
            >
              Nome de usuário
            </label>
            <div className="group relative">
              <User className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
              <input
                id="username-mobile"
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
              htmlFor="email-register-mobile"
              className="text-foreground/90 text-sm font-medium"
            >
              E-mail
            </label>
            <div className="group relative">
              <Mail className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
              <input
                id="email-register-mobile"
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
              htmlFor="password-register-mobile"
              className="text-foreground/90 text-sm font-medium"
            >
              Senha
            </label>
            <div className="group relative">
              <Lock className="text-muted-foreground group-focus-within:text-accent pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors" />
              <input
                id="password-register-mobile"
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
    </main>
  );
}
